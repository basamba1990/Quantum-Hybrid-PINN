import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ivhxnaxhgfbiqlhgfkik.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ✅ FIX: Backend URL avec fallback chainé
const BACKEND_URLS = [
  process.env.H2_INFERENCE_API_URL,
  process.env.NEXT_PUBLIC_API_URL,
  'https://quantum-pinn-api-qef2.onrender.com'
].filter(Boolean);

// ✅ FIX: Timeout pour cold start Render (jusqu'à 120s)
const BACKEND_TIMEOUT = 120000;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 5000; // 5s entre tentatives

async function callBackendWithRetry(
  endpoint: string,
  payload: any,
  method: string = 'POST'
): Promise<{ ok: boolean; status: number; data: any }> {
  let lastError: any = null;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    for (const baseUrl of BACKEND_URLS) {
      if (!baseUrl) continue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);

      try {
        console.log(`📡 Attempt ${attempt + 1}: ${method} ${baseUrl}${endpoint}`);

        const res = await fetch(`${baseUrl}${endpoint}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeoutId);
        const data = await res.json();

        if (res.ok) {
          return { ok: true, status: res.status, data };
        }

        lastError = new Error(`Backend ${baseUrl} returned ${res.status}`);
        console.warn(`⚠️ ${lastError.message}, trying next backend...`);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        lastError = fetchError;

        if (fetchError.name === 'AbortError') {
          console.warn(`⚠️ Timeout on ${baseUrl} (${BACKEND_TIMEOUT}ms), trying next...`);
        } else {
          console.warn(`⚠️ Connection error on ${baseUrl}: ${fetchError.message}`);
        }
      }
    }

    // Backoff exponentiel entre tentatives (5s, 10s, 20s)
    if (attempt < RETRY_ATTEMPTS - 1) {
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    ok: false,
    status: 503,
    data: { error: lastError?.message || 'All backends unreachable after retries' },
  };
}

// ============================================================================
// POST: Create a new analysis and submit it to the backend queue
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const { projectId, name, transcription, description } = await req.json();

    if (!projectId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, name' },
        { status: 400 }
      );
    }

    // Get current user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract user from Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create analysis record in Supabase with "pending" status
    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert({
        project_id: projectId,
        name: name,
        title: name,
        status: 'pending',
        credibility_score: null,
        results: {
          transcription: transcription,
          description: description,
          createdAt: new Date().toISOString(),
          retryAttempts: 0,
        },
        user_id: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create analysis' },
        { status: 500 }
      );
    }

    // ✅ FIX: Submit job to backend with retry and timeout
    const result = await callBackendWithRetry('/v2/submit-analysis', {
      projectId: projectId,
      analysisId: analysis.id,
      name: name,
      transcription: transcription,
      description: description,
      userId: user.id,
    });

    if (result.ok) {
      console.log(`✅ Analysis ${analysis.id} submitted to queue: ${result.data.jobId}`);

      // Update analysis with job ID and status
      await supabase
        .from('analyses')
        .update({
          status: 'processing',
          results: {
            ...analysis.results,
            jobId: result.data.jobId,
            backendStatus: 'submitted',
          },
        })
        .eq('id', analysis.id);

      return NextResponse.json({
        ...analysis,
        status: 'processing',
        jobId: result.data.jobId,
      }, { status: 201 });
    } else {
      // ✅ FIX: Marquer comme failed au lieu de laisser pending pour toujours
      console.error(`❌ All backend attempts failed for analysis ${analysis.id}`);

      await supabase
        .from('analyses')
        .update({
          status: 'failed',
          credibility_score: 0,
          results: {
            ...analysis.results,
            error: result.data.error,
            backendStatus: 'unreachable',
            failedAt: new Date().toISOString(),
            retryAttempts: RETRY_ATTEMPTS,
          },
        })
        .eq('id', analysis.id);

      // Retourner 201 quand même car l'analyse est créée dans Supabase
      // Le frontend peut proposer un retry
      return NextResponse.json({
        ...analysis,
        status: 'failed',
        error: 'Backend unreachable. Please retry later.',
        retryEndpoint: `/api/analyses/${analysis.id}/retry`,
      }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Failed to create analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Fetch analyses for a project
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId parameter' },
        { status: 400 }
      );
    }

    const { data: analyses, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analyses' },
        { status: 500 }
      );
    }

    // ✅ FIX: Détecter les analyses stuck en pending depuis > 5min et les marquer failed
    const now = new Date();
    for (const analysis of analyses) {
      if (analysis.status === 'pending' && analysis.created_at) {
        const createdAt = new Date(analysis.created_at);
        const stuckMinutes = (now.getTime() - createdAt.getTime()) / 60000;
        if (stuckMinutes > 5) {
          console.warn(`⚠️ Analysis ${analysis.id} stuck in pending for ${stuckMinutes.toFixed(1)}min, marking failed`);
          await supabase
            .from('analyses')
            .update({
              status: 'failed',
              credibility_score: 0,
              results: {
                ...analysis.results,
                error: 'Stuck in pending for > 5 minutes - backend unreachable',
                autoMarkedAt: now.toISOString(),
              },
            })
            .eq('id', analysis.id);
          analysis.status = 'failed';
        }
      }
    }

    return NextResponse.json(analyses);
  } catch (error: any) {
    console.error('Failed to fetch analyses:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
