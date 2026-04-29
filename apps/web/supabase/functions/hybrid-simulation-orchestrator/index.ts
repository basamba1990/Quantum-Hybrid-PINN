import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://esm.sh/zod@3.22.4";

// ============================================================================
// 1. Validation de l'environnement
// ============================================================================
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  API_BASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug","info","warn","error"]).default("info"),
});
const env = envSchema.parse(Deno.env.toObject());

const log = (level: string, msg: string, meta?: Record<string, unknown>) => {
  const levels = { debug:0, info:1, warn:2, error:3 };
  if (levels[level] >= levels[env.LOG_LEVEL]) {
    console[level](JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...meta }));
  }
};

// ============================================================================
// 2. Types et schémas
// ============================================================================
const HybridSimulationRequestSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  jobName: z.string(),
  casePath: z.string(),
  nSteps: z.number().int().positive().default(100),
  timeStep: z.number().positive().default(0.01),
  residualThreshold: z.number().positive().default(0.01),
  fields: z.array(z.string()).default(["U","p","T"]),
});
type HybridSimulationRequest = z.infer<typeof HybridSimulationRequestSchema>;

// ============================================================================
// 3. Clients et helpers
// ============================================================================
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function retryRequest(fn: () => Promise<Response>, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      if (res.ok) return res;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch (e) {
      if (i === retries - 1) throw e;
    }
  }
  throw new Error("Max retries exceeded");
}

// ============================================================================
// 4. Handler principal
// ============================================================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Only POST is supported.' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }

  try {
    const rawBody = await req.text();
    if (!rawBody) throw new Error("Empty body");
    const body = JSON.parse(rawBody);
    const request = HybridSimulationRequestSchema.parse(body);

    log("info", "Starting hybrid simulation", { jobName: request.jobName, projectId: request.projectId });

    // 1. Créer l'entrée en base
    const { data: job, error: insertError } = await supabase
      .from("hybrid_simulations")
      .insert({
        project_id: request.projectId,
        user_id: request.userId,
        job_name: request.jobName,
        case_path: request.casePath,
        status: "pending",
        config: {
          n_steps: request.nSteps,
          time_step: request.timeStep,
          residual_threshold: request.residualThreshold,
          fields: request.fields,
        },
      })
      .select()
      .single();

    if (insertError) {
      log("error", "Failed to insert job", { error: insertError.message });
      throw new Error(`Database error: ${insertError.message}`);
    }
    const jobId = job.id;
    log("info", "Job created", { jobId });

    // 2. Mettre à jour status → running
    await supabase
      .from("hybrid_simulations")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);

    // 3. Appeler le backend FastAPI avec l'ID du job
    const payload = {
      job_id: jobId,   // <-- CRUCIAL : transmet l'ID créé dans Supabase
      job_name: request.jobName,
      case_path: request.casePath,
      n_steps: request.nSteps,
      time_step: request.timeStep,
      residual_threshold: request.residualThreshold,
      fields: request.fields,
    };

    // Lancer l'appel en arrière-plan
    (async () => {
      try {
        const response = await retryRequest(() =>
          fetch(`${env.API_BASE_URL}/hybrid/run-simulation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        const apiResult = await response.json();
        log("info", "Backend response received", { jobId, apiResult });

        await supabase
          .from("hybrid_simulations")
          .update({
            status: apiResult.status === "success" ? "completed" : "failed",
            results: apiResult,
            completed_at: new Date().toISOString(),
            error_message: apiResult.error_message || null,
          })
          .eq("id", jobId);
      } catch (err) {
        log("error", "Backend call failed", { jobId, error: err.message });
        await supabase
          .from("hybrid_simulations")
          .update({
            status: "failed",
            error_message: err.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    })();

    return new Response(
      JSON.stringify({
        status: "success",
        jobId,
        message: `Hybrid simulation job ${jobId} created and started`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    log("error", "Handler error", { error: error.message, stack: error.stack });
    let status = 500;
    if (error instanceof z.ZodError) status = 400;
    return new Response(
      JSON.stringify({ status: "error", message: error.message }),
      {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});
