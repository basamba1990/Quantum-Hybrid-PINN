import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase configuration is missing' },
        { status: 500 }
      );
    }

    const SUPABASE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1/hybrid-simulation-orchestrator`;
    const body = await req.json();

    // Validation basique
    if (!body.job_name || !body.case_path || !body.project_id) {
      return NextResponse.json(
        { error: 'Missing required fields: job_name, case_path, project_id' },
        { status: 400 }
      );
    }

    // Appel à l'Edge Function Supabase avec le token de l'utilisateur
    const response = await fetch(SUPABASE_FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        projectId: body.project_id,
        userId: session.user.id,
        jobName: body.job_name,
        casePath: body.case_path,
        nSteps: body.n_steps || 100,
        timeStep: body.time_step || 0.01,
        residualThreshold: body.residual_threshold || 0.01,
        fields: body.fields || ['U', 'p', 'T'],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Edge function error:', data);
      return NextResponse.json(
        { error: data.message || 'Edge function failed' },
        { status: response.status }
      );
    }

    // Retourner le job_id comme attendu par le composant
    return NextResponse.json({
      job_id: data.jobId,
      status: 'running',
      message: data.message,
      results: {
        iteration: 0,
        cfdTime: 0,
        mlTime: 0,
        residuals: {},
        log: "Initialisation de la simulation hybride...",
        credibilityScore: 0
      }
    });
  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
