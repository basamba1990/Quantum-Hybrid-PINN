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

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // Extraction des valeurs depuis scenario_inputs pour les mapper au top-level attendu par l'API
    const scenarioInputs = body.scenario_inputs || {};
    
    const payload = {
      project_id: body.project_id,
      user_id: session.user.id,
      job_name: body.job_name,
      case_path: body.case_path,
      n_steps: body.n_steps || 100,
      time_step: body.time_step || 0.01,
      residual_threshold: body.residual_threshold || 0.01,
      fields: body.fields || ['U', 'p', 'T'],
      ml_weight: body.ml_weight || 0.5,
      fluid: body.fluid || scenarioInputs.fluid || 'H2',
      // Priorité aux entrées directes, puis aux entrées de scénario, puis aux défauts
      pressure: body.pressure || scenarioInputs.pressure || 80,
      temperature: body.temperature || scenarioInputs.temperature || 300,
      flow_rate: body.flow_rate || scenarioInputs.flowRate || 2.0,
      length: body.length || scenarioInputs.length || 100,
      diameter: body.diameter || scenarioInputs.diameter || 0.5,
      scenario_type: body.scenario_type || "H2_PIPELINE",
      scenario_inputs: scenarioInputs,
    };
    
    const response = await fetch(`${API_URL}/hybrid/run-simulation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('FastAPI error:', data);
      return NextResponse.json(
        { error: data.message || 'Simulation failed' },
        { status: response.status }
      );
    }

    // Format attendu par HybridSimulationPanel
    return NextResponse.json({
      job_id: data.job_id,
      status: 'running',
      message: data.message,
    });
  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
