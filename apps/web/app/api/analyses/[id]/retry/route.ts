import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ivhxnaxhgfbiqlhgfkik.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BACKEND_URLS = [
  process.env.H2_INFERENCE_API_URL,
  process.env.NEXT_PUBLIC_API_URL,
  'https://quantum-pinn-api-qef2.onrender.com'
].filter(Boolean);

const BACKEND_TIMEOUT = 120000;

// ============================================================================
// POST: Retry a stuck pending analysis
// ============================================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: analysisId } = await params;

    // Fetch the analysis
    const { data: analysis, error: fetchError } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (fetchError || !analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Only retry pending/failed analyses
    if (analysis.status === 'completed') {
      return NextResponse.json(
        { message: 'Analysis already completed, nothing to retry' },
        { status: 200 }
      );
    }

    // Retry backend submission
    let success = false;
    let lastError = '';

    for (const baseUrl of BACKEND_URLS) {
      if (!baseUrl) continue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);

      try {
        console.log(`🔄 Retrying analysis ${analysisId} on ${baseUrl}`);

        const res = await fetch(`${baseUrl}/v2/submit-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: analysis.project_id,
            analysisId: analysis.id,
            name: analysis.name || analysis.title,
            transcription: analysis.transcription,
            description: analysis.description,
            userId: analysis.user_id,
          }),
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const jobId = data.jobId || data.job_id;

          await supabase
            .from('analyses')
            .update({
              status: 'processing',
              results: {
                ...(analysis.results || {}),
                jobId: jobId,
                backendStatus: 'resubmitted',
                retriedAt: new Date().toISOString(),
                retryCount: (analysis.results?.retryCount || 0) + 1,
              },
            })
            .eq('id', analysisId);

          return NextResponse.json({
            message: 'Analysis retry submitted successfully',
            jobId,
            status: 'processing',
          });
        } else {
          lastError = `Backend returned ${res.status}`;
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err.name === 'AbortError'
          ? `Timeout on ${baseUrl} after ${BACKEND_TIMEOUT}ms`
          : `Connection error on ${baseUrl}: ${err.message}`;
        console.warn(`⚠️ Retry error: ${lastError}`);
      }
    }

    // All backends failed
    await supabase
      .from('analyses')
      .update({
        status: 'failed',
        results: {
          ...(analysis.results || {}),
          error: lastError,
          backendStatus: 'unreachable',
          failedAt: new Date().toISOString(),
          retryCount: (analysis.results?.retryCount || 0) + 1,
        },
      })
      .eq('id', analysisId);

    return NextResponse.json(
      {
        error: 'Retry failed: all backends unreachable',
        message: 'The backend API is not responding. Please check the Render service status.',
      },
      { status: 503 }
    );
  } catch (error: any) {
    console.error('❌ Retry error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
