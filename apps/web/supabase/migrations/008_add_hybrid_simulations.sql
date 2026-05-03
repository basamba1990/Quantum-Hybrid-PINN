import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://esm.sh/zod@3.22.4";

// ============================================================================
// 1. ENV
// ============================================================================
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  API_BASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug","info","warn","error"]).default("info"),
});
const env = envSchema.parse(Deno.env.toObject());

// ============================================================================
// 2. LOG
// ============================================================================
const log = (level: string, msg: string, meta?: Record<string, unknown>) => {
  const levels = { debug:0, info:1, warn:2, error:3 };
  if (levels[level] >= levels[env.LOG_LEVEL]) {
    console[level](JSON.stringify({
      level,
      msg,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};

// ============================================================================
// 3. VALIDATION
// ============================================================================
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HybridSimulationRequestSchema = z.object({
  projectId: z.string().optional(), // peut être null
  jobName: z.string(),
  casePath: z.string(),
  nSteps: z.number().int().positive().default(100),
  timeStep: z.number().positive().default(0.01),
  residualThreshold: z.number().positive().default(0.01),
  fields: z.array(z.string()).default(["U","p","T"]),
});
type HybridSimulationRequest = z.infer<typeof HybridSimulationRequestSchema>;

// ============================================================================
// 4. CLIENTS
// ============================================================================
const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// 5. RETRY
// ============================================================================
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
// 6. HANDLER
// ============================================================================
serve(async (req: Request) => {

  // CORS
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
    return new Response(JSON.stringify({ error: 'Only POST allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    // ========================================================================
    // 🔐 AUTH (CRITICAL FIX)
    // ========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseUser = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const userId = user.id;

    if (!uuidRegex.test(userId)) {
      throw new Error("Invalid user UUID");
    }

    // ========================================================================
    // BODY
    // ========================================================================
    const rawBody = await req.text();
    if (!rawBody) throw new Error("Empty body");

    const body = JSON.parse(rawBody);
    const request = HybridSimulationRequestSchema.parse(body);

    log("info", "Simulation start", {
      userId,
      jobName: request.jobName
    });

    // ========================================================================
    // PROJECT VALIDATION
    // ========================================================================
    let projectId: string | null = null;

    if (request.projectId && uuidRegex.test(request.projectId)) {
      projectId = request.projectId;
    }

    // ========================================================================
    // INSERT JOB
    // ========================================================================
    const { data: job, error: insertError } = await supabaseAdmin
      .from("hybrid_simulations")
      .insert({
        project_id: projectId,
        user_id: userId,
        job_name: request.jobName,
        case_path: request.casePath,
        status: "running",
        started_at: new Date().toISOString(),
        config: {
          n_steps: request.nSteps,
          time_step: request.timeStep,
          residual_threshold: request.residualThreshold,
          fields: request.fields,
        },
        results: {
          iteration: 0,
          cfdTime: 0,
          mlTime: 0,
          residuals: {},
          log: "Initialisation...",
          credibilityScore: 0
        }
      })
      .select()
      .single();

    if (insertError) {
      log("error", "Insert failed", { error: insertError.message });
      throw new Error(insertError.message);
    }

    const jobId = job.id;

    log("info", "Job created", { jobId });

    // ========================================================================
    // BACKEND CALL (ASYNC)
    // ========================================================================
    (async () => {
      try {
        const response = await retryRequest(() =>
          fetch(`${env.API_BASE_URL}/hybrid/run-simulation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: jobId,
              job_name: request.jobName,
              case_path: request.casePath,
              n_steps: request.nSteps,
              time_step: request.timeStep,
              residual_threshold: request.residualThreshold,
              fields: request.fields,
            }),
          })
        );

        const apiResult = await response.json();

        await supabaseAdmin
          .from("hybrid_simulations")
          .update({
            status: apiResult.status === "success" ? "completed" : "failed",
            results: apiResult,
            completed_at: new Date().toISOString(),
            error_message: apiResult.error_message || null,
          })
          .eq("id", jobId);

      } catch (err) {
        log("error", "Backend failed", { error: err.message });

        await supabaseAdmin
          .from("hybrid_simulations")
          .update({
            status: "failed",
            error_message: err.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    })();

    return new Response(JSON.stringify({
      status: "success",
      jobId
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error) {
    log("error", "Handler error", {
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      status: "error",
      message: error.message
    }), {
      status: error instanceof z.ZodError ? 400 : 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
});
