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

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';
    
    // Extraction des valeurs depuis scenario_inputs pour les mapper au top-level attendu par l'API
    const scenarioInputs = body.scenario_inputs || {};
    
    // **FIX: Validation stricte des paramètres physiques**
    // Aucune valeur par défaut arbitraire ne doit écraser les entrées utilisateur.
    // Si l'utilisateur ne fournit pas une valeur, elle doit être NULL ou undefined,
    // et l'API backend doit gérer les défauts de manière physiquement rigoureuse.
    
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
      fluid: body.fluid || scenarioInputs.fluid || null,
      // **CORRECTION**: Pas de défauts arbitraires. Les valeurs doivent provenir
      // directement de l'utilisateur ou du scénario, jamais de constantes magiques.
      pressure: body.pressure !== undefined ? body.pressure : (scenarioInputs.pressure !== undefined ? scenarioInputs.pressure : null),
      temperature: body.temperature !== undefined ? body.temperature : (scenarioInputs.temperature !== undefined ? scenarioInputs.temperature : null),
      flow_rate: body.flow_rate !== undefined ? body.flow_rate : (scenarioInputs.flowRate !== undefined ? scenarioInputs.flowRate : null),
      length: body.length !== undefined ? body.length : (scenarioInputs.length !== undefined ? scenarioInputs.length : null),
      diameter: body.diameter !== undefined ? body.diameter : (scenarioInputs.diameter !== undefined ? scenarioInputs.diameter : null),
      // ✅ Support des paramètres de compression
      pressure_in: scenarioInputs.pressure_in,
      pressure_out: scenarioInputs.pressure_out,
      temperature_in: scenarioInputs.temperature_in,
      temperature_out: scenarioInputs.temperature_out,
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
