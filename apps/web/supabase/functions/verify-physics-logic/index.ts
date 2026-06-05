// supabase/functions/verify-physics-logic/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";
import jsPDF from "https://esm.sh/jspdf@2.5.1?bundle";
import autoTable from "https://esm.sh/jspdf-autotable";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  H2_INFERENCE_API_URL: z.string().url().default("https://quantum-pinn-api-qef2.onrender.com"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(["debug","info","warn","error"]).default("info"),
});

const env = envSchema.parse(Deno.env.toObject());

const PhysicalParametersSchema = z.object({
  pressure: z.number().positive().optional().nullable(),
  temperature: z.number().min(14).max(800).optional().nullable(),
  velocity: z.number().nonnegative().optional().nullable(),
  efficiency: z.number().min(0).max(100).optional().nullable(),
  power: z.number().nonnegative().optional().nullable(),
  volume: z.number().positive().optional().nullable(),
  mass_flow_rate: z.number().nonnegative().optional().nullable(),
  x: z.number().min(0).max(1).default(0.5).nullable(),
  y: z.number().min(0).max(1).default(0.5).nullable(),
  z: z.number().min(0).max(1).default(0.5).nullable(),
  fluid: z.string().optional().nullable(),
  fluid_type: z.enum(["H2","NH3","CH4","sCO2"]).default("H2").nullable(),
  scenario: z.enum(["storage", "transport", "pipeline"]).default("storage").nullable(),
  enthalpy_delta_h: z.number().optional().nullable(),
  entropy_delta_s: z.number().optional().nullable(),
  gravimetric_density_w: z.number().optional().nullable(),
  equilibrium_pressure: z.number().positive().optional().nullable(),
}).strict();

const VerificationRequestSchema = z.object({
  projectId: z.string().uuid(),
  analysisId: z.string().uuid(),
  transcription: z.string().min(1).max(10000),
  context: z.string().default("hydrogen_storage"),
});

const log = (level: string, msg: string, meta?: Record<string, unknown>) => {
  console[level](JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...meta }));
};

async function extractPhysicalParameters(transcription: string): Promise<z.infer<typeof PhysicalParametersSchema>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert physicist specializing in hydrogen storage and thermodynamics.
Extract all physical parameters from the following text. Return a JSON object with SI units.`,
        },
        { role: "user", content: transcription },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  const data = await response.json();
  return PhysicalParametersSchema.parse(JSON.parse(data.choices[0].message.content));
}

async function callBackendValidate3d(params: any): Promise<any> {
  const response = await fetch(`${env.H2_INFERENCE_API_URL}/v2/validate-3d`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return await response.json();
}

function calculateCredibilityScore(
  extractedParams: z.infer<typeof PhysicalParametersSchema>,
  backendResult: any
) {
  let score = 100;
  const anomalies: string[] = [];

  // 1. Validation des résidus physiques (Backend PINN)
  if (backendResult.residuals) {
    const avgResidual = Object.values(backendResult.residuals as Record<string, number>).reduce((a, b) => a + b, 0) / Object.keys(backendResult.residuals).length;
    if (avgResidual > 0.1) {
      score -= 40;
      anomalies.push(`Résidus physiques élevés (${avgResidual.toExponential(2)}) : Violation potentielle des lois de conservation.`);
    } else if (avgResidual > 0.01) {
      score -= 15;
      anomalies.push(`Résidus physiques modérés (${avgResidual.toExponential(2)}).`);
    }
  }

  // 2. Cohérence Thermodynamique (Van't Hoff pour H2)
  if (extractedParams.pressure && extractedParams.temperature && extractedParams.equilibrium_pressure) {
    const T = extractedParams.temperature;
    const R = 8.314;
    const dH = (extractedParams.enthalpy_delta_h || 30) * 1000;
    const dS = (extractedParams.entropy_delta_s || 130);
    const P_eq_calc = Math.exp(dS / R - dH / (R * T)) * 1e5;
    const dev = Math.abs(extractedParams.equilibrium_pressure - P_eq_calc) / P_eq_calc;
    if (dev > 0.3) {
      score -= 25;
      anomalies.push(`Incohérence thermodynamique : Écart de ${(dev * 100).toFixed(1)}% par rapport à l'équation de Van't Hoff.`);
    }
  }

  return { score: Math.max(0, score), anomalies };
}

serve(async (req) => {
  try {
    const { projectId, analysisId, transcription } = await req.json();
    const extractedParams = await extractPhysicalParameters(transcription);
    const backendResult = await callBackendValidate3d(extractedParams);
    
    const { score, anomalies } = calculateCredibilityScore(extractedParams, backendResult);

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Mise à jour de l'analyse
    await supabase.from("analyses").update({
      status: "completed",
      credibility_score: score,
      physical_anomalies: anomalies,
      extracted_params: extractedParams,
      residuals: backendResult.residuals,
      predictions_3d: backendResult.predictions
    }).eq("id", analysisId);

    return new Response(JSON.stringify({ success: true, score, anomalies }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
