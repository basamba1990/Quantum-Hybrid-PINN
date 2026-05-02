import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration is missing' },
        { status: 500 }
      );
    }

    const SUPABASE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1/hybrid-simulation-orchestrator`;

    const body = await req.json();

    // Validation basique
    if (!body.job_name || !body.case_path) {
      return NextResponse.json(
        { error: 'Missing required fields: job_name, case_path' },
        { status: 400 }
      );
    }

    // Appel à l'Edge Function Supabase
    const response = await fetch(SUPABASE_FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        projectId: body.project_id || 'legacy',
        userId: body.user_id || 'anonymous',
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
        { error: data.error || 'Edge function failed' },
        { status: response.status }
      );
    }

    // Retourner le job_id comme attendu par le composant
    return NextResponse.json({
      job_id: data.jobId,
      status: 'running', // Forcer le statut running pour l'UI
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
