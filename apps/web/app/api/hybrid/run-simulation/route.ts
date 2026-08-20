import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ✅ FIX: Timeout pour cold start Render (jusqu'à 120s au lieu de 30s)
const BACKEND_TIMEOUT = 120000; // 120s pour cold start Render free tier
const RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY = 3000;

async function callBackendWithRetry(
  url: string,
  payload: any
): Promise<{ ok: boolean; status: number; data: any }> {
  let lastError: any = null;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);

    try {
      console.log(`📡 Attempt ${attempt + 1}: POST ${url} (timeout: ${BACKEND_TIMEOUT}ms)`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Quantum-Hybrid-PINN-Frontend/2.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok) {
        return { ok: true, status: response.status, data };
      }

      lastError = new Error(`Backend returned ${response.status}: ${JSON.stringify(data)}`);
      console.warn(`⚠️ ${lastError.message}`);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      lastError = fetchError;

      if (fetchError.name === 'AbortError') {
        console.warn(`⚠️ Timeout on attempt ${attempt + 1} (${BACKEND_TIMEOUT}ms)`);
      } else {
        console.warn(`⚠️ Connection error: ${fetchError.message}`);
      }
    }

    if (attempt < RETRY_ATTEMPTS - 1) {
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    ok: false,
    status: 503,
    data: { error: lastError?.message || 'Backend unreachable after retries' },
  };
}

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

    const API_URL = process.env.H2_INFERENCE_API_URL
      || process.env.NEXT_PUBLIC_API_URL
      || 'https://quantum-pinn-api-qef2.onrender.com';

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
      analysis_id: body.analysis_id,
      user_id: session.user.id,
      job_name: body.job_name,
      case_path: body.case_path,
      n_steps: body.n_steps || 100,
      time_step: body.time_step || 0.01,
      residual_threshold: body.residual_threshold || 0.01,
      fields: body.fields || ['U', 'p', 'T'],
      ml_weight: body.ml_weight || 0.5,

      fluid: body.fluid || scenarioInputs.fluid || 'H2',
      pressure: body.pressure ?? scenarioInputs.pressure ?? scenarioInputs.pressure_in ?? 80,
      temperature: body.temperature ?? scenarioInputs.temperature ?? scenarioInputs.temperature_in ?? 300,
      flow_rate: body.flow_rate ?? scenarioInputs.flowRate ?? 2.0,
      length: body.length ?? scenarioInputs.length ?? 100,
      diameter: body.diameter ?? scenarioInputs.diameter ?? 0.5,

      volume: scenarioInputs.volume,
      ambient_temp: scenarioInputs.ambientTemp,
      depth: scenarioInputs.depth,
      rock_type: scenarioInputs.rockType,
      cargo_type: scenarioInputs.cargoType,
      port_location: scenarioInputs.portLocation,
      ventilation_rate: scenarioInputs.ventilationRate,
      sensor_interval: scenarioInputs.sensorInterval,

      scenario_type: body.scenario_type || "H2_PIPELINE",
      scenario_inputs: scenarioInputs,
    };

    const result = await callBackendWithRetry(
      `${API_URL}/hybrid/run-simulation`,
      payload
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.data.error || 'Backend unreachable',
          details: {
            message: 'Simulation could not be submitted. Backend is unreachable.',
            retryMessage: 'Try again in a few minutes, or use the local PINN solver.',
          },
        },
        { status: 503 }
      );
    }

    const jobId = result.data.job_id || result.data.jobId;
    if (!jobId) {
      console.error('❌ Backend did not return job_id. Response:', result.data);
      return NextResponse.json(
        { error: 'Backend did not return job_id', backendResponse: result.data },
        { status: 500 }
      );
    }

    console.log(`✅ Job created successfully: ${jobId}`);

    return NextResponse.json({
      job_id: jobId,
      status: 'running',
      message: result.data.message || 'Simulation started',
    });
  } catch (error: any) {
    console.error('❌ API route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
