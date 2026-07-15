import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        status: 'pending', // ✅ Start with pending
        credibility_score: null,
        results: {
          transcription: transcription,
          description: description,
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

    // ✅ Submit job to backend queue immediately
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';
    
    try {
      const queueResponse = await fetch(`${backendUrl}/v2/submit-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          analysisId: analysis.id,
          name: name,
          transcription: transcription,
          description: description,
          userId: user.id,
        }),
      });

      if (!queueResponse.ok) {
        console.warn(`Backend queue submission warning: ${queueResponse.status}`);
        // Don't fail - analysis is created, job submission can be retried
      } else {
        const queueData = await queueResponse.json();
        console.log(`✅ Analysis ${analysis.id} submitted to queue with job ID: ${queueData.jobId}`);
        
        // Update analysis with job ID
        await supabase
          .from('analyses')
          .update({ results: { ...analysis.results, jobId: queueData.jobId } })
          .eq('id', analysis.id);
      }
    } catch (backendError) {
      console.error('Backend submission error:', backendError);
      // Don't fail - analysis is created, backend can process it asynchronously
    }

    return NextResponse.json(analysis, { status: 201 });
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

    return NextResponse.json(analyses);
  } catch (error: any) {
    console.error('Failed to fetch analyses:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
