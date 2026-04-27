/**
 * Supabase Edge Function: Hybrid Simulation Orchestrator
 * Orchestrates hybrid CFD-ML simulations by coordinating with the FastAPI backend
 * and managing simulation state in Supabase
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Type definitions
interface HybridSimulationRequest {
  projectId: string;
  userId: string;
  jobName: string;
  casePath: string;
  nSteps: number;
  timeStep: number;
  residualThreshold: number;
  fields: string[];
}

interface HybridSimulationResponse {
  status: 'success' | 'error';
  jobId?: string;
  message: string;
  error?: string;
}

interface SimulationJob {
  id: string;
  project_id: string;
  user_id: string;
  job_name: string;
  case_path: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: Record<string, any>;
  results?: Record<string, any>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const API_BASE_URL = Deno.env.get('API_BASE_URL') || 'http://localhost:8000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Retry logic for API calls
 */
async function retryRequest(
  fn: () => Promise<Response>,
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fn();
      if (response.ok) return response;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Create simulation job in database
 */
async function createSimulationJob(
  request: HybridSimulationRequest
): Promise<SimulationJob> {
  const { data, error } = await supabase
    .from('hybrid_simulations')
    .insert([
      {
        project_id: request.projectId,
        user_id: request.userId,
        job_name: request.jobName,
        case_path: request.casePath,
        status: 'pending',
        config: {
          n_steps: request.nSteps,
          time_step: request.timeStep,
          residual_threshold: request.residualThreshold,
          fields: request.fields,
        },
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  return data as SimulationJob;
}

/**
 * Update job status in database
 */
async function updateJobStatus(
  jobId: string,
  status: string,
  updates?: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from('hybrid_simulations')
    .update({
      status,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error(`Failed to update job ${jobId}:`, error);
  }
}

/**
 * Call FastAPI backend to run hybrid simulation
 */
async function runHybridSimulation(
  jobId: string,
  request: HybridSimulationRequest
): Promise<Record<string, any>> {
  const payload = {
    job_name: request.jobName,
    case_path: request.casePath,
    n_steps: request.nSteps,
    time_step: request.timeStep,
    residual_threshold: request.residualThreshold,
    fields: request.fields,
  };

  const response = await retryRequest(() =>
    fetch(`${API_BASE_URL}/hybrid/run-simulation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Poll job status from FastAPI backend
 */
async function pollJobStatus(
  jobId: string,
  maxAttempts: number = 60,
  interval: number = 5000
): Promise<Record<string, any>> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error(`Error polling job ${jobId}:`, error);
    }

    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Job ${jobId} polling timeout`);
}

/**
 * Main handler function
 */
serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Parse request
    const body = await req.json() as HybridSimulationRequest;

    // Validate required fields
    const required = ['projectId', 'userId', 'jobName', 'casePath'];
    for (const field of required) {
      if (!(field in body)) {
        return new Response(
          JSON.stringify({
            status: 'error',
            message: `Missing required field: ${field}`,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // Set defaults
    const request: HybridSimulationRequest = {
      nSteps: 100,
      timeStep: 0.01,
      residualThreshold: 0.01,
      fields: ['U', 'p', 'T'],
      ...body,
    };

    console.log(`[${new Date().toISOString()}] Starting hybrid simulation:`, request);

    // Create job in database
    const job = await createSimulationJob(request);
    console.log(`Created job: ${job.id}`);

    // Update job status to running
    await updateJobStatus(job.id, 'running', {
      started_at: new Date().toISOString(),
    });

    // Call FastAPI backend
    const apiResponse = await runHybridSimulation(job.id, request);
    console.log(`API response for job ${job.id}:`, apiResponse);

    // Poll for completion (with timeout)
    let finalStatus: Record<string, any> | null = null;
    try {
      finalStatus = await pollJobStatus(job.id, 120, 2000); // 4 minutes max
    } catch (error) {
      console.warn(`Polling timeout for job ${job.id}, continuing with async updates`);
    }

    // Update job with results if available
    if (finalStatus) {
      await updateJobStatus(job.id, finalStatus.status, {
        results: finalStatus.results,
        completed_at:
          finalStatus.status === 'completed' || finalStatus.status === 'failed'
            ? new Date().toISOString()
            : undefined,
        error_message: finalStatus.error_message,
      });
    }

    // Return response
    const response: HybridSimulationResponse = {
      status: 'success',
      jobId: job.id,
      message: `Hybrid simulation job ${job.id} created and started`,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in hybrid-simulation-orchestrator:', error);

    const response: HybridSimulationResponse = {
      status: 'error',
      message: 'Failed to start hybrid simulation',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
