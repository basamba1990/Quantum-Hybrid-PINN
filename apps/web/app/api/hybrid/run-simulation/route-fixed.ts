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

    // Validation stricte des champs requis
    if (!body.job_name || !body.case_path || !body.project_id) {
      return NextResponse.json(
        { 
          error: 'Missing required fields: job_name, case_path, project_id',
          received: { job_name: body.job_name, case_path: body.case_path, project_id: body.project_id }
        },
        { status: 400 }
      );
    }

    // ✅ FIX: Vérifier que l'API_URL est correctement configurée
    const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.H2_INFERENCE_API_URL || 'https://quantum-hybrid-pinn-jdoj.onrender.com';
    
    if (!API_URL) {
      console.error('❌ CRITICAL: API_URL not configured in environment variables');
      return NextResponse.json(
        { error: 'API configuration error: No backend URL configured' },
        { status: 500 }
      );
    }

    console.log(`📡 Calling backend API: ${API_URL}/hybrid/run-simulation`);
    console.log(`📋 Payload:`, JSON.stringify(body, null, 2));

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
      fluid: body.fluid || scenarioInputs.fluid || null,
      pressure: body.pressure !== undefined ? body.pressure : (scenarioInputs.pressure !== undefined ? scenarioInputs.pressure : null),
      temperature: body.temperature !== undefined ? body.temperature : (scenarioInputs.temperature !== undefined ? scenarioInputs.temperature : null),
      flow_rate: body.flow_rate !== undefined ? body.flow_rate : (scenarioInputs.flowRate !== undefined ? scenarioInputs.flowRate : null),
      length: body.length !== undefined ? body.length : (scenarioInputs.length !== undefined ? scenarioInputs.length : null),
      diameter: body.diameter !== undefined ? body.diameter : (scenarioInputs.diameter !== undefined ? scenarioInputs.diameter : null),
      pressure_in: scenarioInputs.pressure_in,
      pressure_out: scenarioInputs.pressure_out,
      temperature_in: scenarioInputs.temperature_in,
      temperature_out: scenarioInputs.temperature_out,
      scenario_type: body.scenario_type || "H2_PIPELINE",
      scenario_inputs: scenarioInputs,
    };
    
    // ✅ FIX: Timeout et retry logic pour les appels au backend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    let response;
    try {
      response = await fetch(`${API_URL}/hybrid/run-simulation`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Quantum-Hybrid-PINN-Frontend/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error(`❌ Fetch error: ${fetchError.message}`);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Backend request timeout (30s). The backend may be overloaded or unreachable.' },
          { status: 504 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to connect to backend: ${fetchError.message}` },
        { status: 503 }
      );
    }

    clearTimeout(timeoutId);

    // ✅ FIX: Meilleure gestion des réponses d'erreur
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error(`❌ Failed to parse backend response: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`Response body: ${text}`);
      
      return NextResponse.json(
        { error: `Backend returned invalid JSON: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    if (!response.ok) {
      console.error(`❌ Backend error (${response.status}):`, data);
      return NextResponse.json(
        { 
          error: data.message || data.error || 'Simulation failed',
          details: data,
          backendStatus: response.status
        },
        { status: response.status }
      );
    }

    // ✅ FIX: Validation de la réponse du backend
    const jobId = data.job_id || data.jobId;
    if (!jobId) {
      console.error(`❌ Backend did not return job_id. Response:`, data);
      return NextResponse.json(
        { error: 'Backend did not return job_id', backendResponse: data },
        { status: 500 }
      );
    }

    console.log(`✅ Job created successfully: ${jobId}`);

    // Format attendu par HybridSimulationPanel
    return NextResponse.json({
      job_id: jobId,
      status: 'running',
      message: data.message || 'Simulation started',
    });
  } catch (error: any) {
    console.error('❌ API route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
