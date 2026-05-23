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

    const body = await req.json();

    if (!body.job_name || !body.case_path || !body.project_id) {
      return NextResponse.json(
        { error: 'Missing required fields: job_name, case_path, project_id' },
        { status: 400 }
      );
    }

    // Appel direct à l'API FastAPI (Render ou local)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${API_URL}/hybrid/run-simulation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: body.project_id,
        user_id: session.user.id,
        job_name: body.job_name,
        case_path: body.case_path,
        n_steps: body.n_steps || 100,
        time_step: body.time_step || 0.01,
        residual_threshold: body.residual_threshold || 0.01,
        fields: body.fields || ['U', 'p', 'T'],
        enable_warp: body.enable_warp || false,
        enable_multiphase: body.enable_multiphase || false,
        enable_shock_capturing: body.enable_shock_capturing || false,
        scenario_type: body.scenario_type || "H2_PIPELINE",
        scenario_inputs: body.scenario_inputs || {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('FastAPI error:', data);
      return NextResponse.json(
        { error: data.message || 'Simulation failed' },
        { status: response.status }
      );
    }

    // Retourne le format attendu par HybridSimulationPanel
    return NextResponse.json({
      job_id: data.job_id,
      status: 'running',
      message: data.message,
      results: {
        iteration: 0,
        cfdTime: 0,
        mlTime: 0,
        residuals: {},
        log: "Initialisation de la simulation hybride...",
        credibilityScore: 0,
        turbulentData: { time: [], tke: [], dissipation: [] }
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
