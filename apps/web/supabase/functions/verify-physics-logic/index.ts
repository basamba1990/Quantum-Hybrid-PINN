// supabase/functions/verify-physics-logic/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { z } from "https://esm.sh/zod@3.22.4"

// ============================================================================
// 1. Configuration & validation d'environnement
// ============================================================================

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  H2_INFERENCE_API_URL: z.string().url().default("https://api.h2-inference.com"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(["debug","info","warn","error"]).default("info"),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  MAX_RETRIES: z.coerce.number().int().min(1).max(5).default(3),
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().default(5),
  SIMULATION_TIMESTEPS: z.coerce.number().int().default(30),
  SIMULATION_DURATION: z.coerce.number().positive().default(10),
})

const env = envSchema.parse(Deno.env.toObject())

// ============================================================================
// 2. Zod schemas (validation stricte)
// ============================================================================

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
}).strict()

const VerificationRequestSchema = z.object({
  projectId: z.string().uuid(),
  analysisId: z.string().uuid(),
  transcription: z.string().min(1).max(10000),
  context: z.string().default("hydrogen_storage"),
})

const PredictionResponseSchema = z.object({
  pressure: z.number(),
  velocity_u: z.number(),
  velocity_v: z.number(),
  velocity_w: z.number(),
  temperature: z.number(),
  density: z.number(),
  time: z.number(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  timestamp: z.string(),
})

// ============================================================================
// 3. Helpers : logging, retry, circuit breaker, cache
// ============================================================================

const log = (level: string, msg: string, meta?: Record<string, unknown>) => {
  const levels = { debug:0, info:1, warn:2, error:3 }
  if (levels[level] >= levels[env.LOG_LEVEL]) {
    console[level](JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...meta }))
  }
}

class CircuitBreaker {
  private failures = 0
  private lastFailure = 0
  private state: "CLOSED" | "OPEN" = "CLOSED"

  async call<T>(fn: () => Promise<T>, endpoint: string): Promise<T> {
    if (this.state === "OPEN" && Date.now() - this.lastFailure < 60000) {
      throw new Error(`Circuit breaker OPEN for ${endpoint}`)
    }
    if (this.state === "OPEN") {
      this.state = "CLOSED"
      this.failures = 0
    }
    try {
      const result = await fn()
      this.failures = 0
      return result
    } catch (err) {
      this.failures++
      this.lastFailure = Date.now()
      if (this.failures >= env.CIRCUIT_BREAKER_THRESHOLD) {
        this.state = "OPEN"
        log("warn", `Circuit breaker OPEN for ${endpoint}`, { failures: this.failures })
      }
      throw err
    }
  }
}

async function withRetry<T>(fn: () => Promise<T>, endpoint: string, maxRetries = env.MAX_RETRIES): Promise<T> {
  let lastError: Error
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxRetries) break
      const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 200, 10000)
      log("warn", `Retry ${attempt}/${maxRetries} for ${endpoint}`, { delay, error: err.message })
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError!
}

class InMemoryCache {
  private store = new Map<string, { value: any; expires: number }>()
  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expires) {
      this.store.delete(key)
      return null
    }
    return entry.value as T
  }
  set(key: string, value: any, ttlSec = env.CACHE_TTL_SECONDS) {
    this.store.set(key, { value, expires: Date.now() + ttlSec * 1000 })
  }
}
const cache = new InMemoryCache()
const openAICircuit = new CircuitBreaker()
const h2Circuit = new CircuitBreaker()

// ============================================================================
// 4. Services externes (OpenAI, H2 Inference)
// ============================================================================

async function extractPhysicalParameters(transcription: string): Promise<z.infer<typeof PhysicalParametersSchema>> {
  return await withRetry(async () => {
    return await openAICircuit.call(async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      try {
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
Extract all physical parameters from the following text. Return a JSON object with:
	- pressure (Pa), temperature (K), velocity (m/s), efficiency (%), power (W), volume (m³), mass_flow_rate (kg/s)
	- x, y, z (coordinates 0-1, default 0.5)
	- fluid, fluid_type ("H2", "NH3", "CH4", "sCO2")
	- scenario ("storage", "transport", "pipeline")
	- enthalpy_delta_h (kJ/mol), entropy_delta_s (J/K/mol), gravimetric_density_w (wt.%), equilibrium_pressure (Pa)
Respond ONLY with valid JSON, no other text.`,
              },
              { role: "user", content: transcription },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`)
        const data = await response.json()
        const parsed = JSON.parse(data.choices[0].message.content)
        return PhysicalParametersSchema.parse(parsed)
      } catch (e) {
        clearTimeout(timeout)
        throw e
      }
    }, "openai")
  }, "openai-extract")
}

async function fetch3DPrediction(point: { time: number; x: number; y: number; z: number }) {
  const cacheKey = `pinn:${point.time}:${point.x}:${point.y}:${point.z}`
  const cached = cache.get(cacheKey)
  if (cached) return PredictionResponseSchema.parse(cached)

  return await withRetry(async () => {
    return await h2Circuit.call(async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const response = await fetch(`${env.H2_INFERENCE_API_URL}/v2/validate-3d`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(point),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!response.ok) throw new Error(`3D prediction HTTP ${response.status}`)
        const data = await response.json()
        const validated = PredictionResponseSchema.parse(data)
        cache.set(cacheKey, validated)
        return validated
      } catch (e) {
        clearTimeout(timeout)
        throw e
      }
    }, "h2-validate")
  }, "h2-prediction")
}

async function performAssimilation(currentState: number[], observation: number[]) {
  return await withRetry(async () => {
    return await h2Circuit.call(async () => {
      const response = await fetch(`${env.H2_INFERENCE_API_URL}/v2/assimilate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_state: currentState, observation }),
      })
      if (!response.ok) throw new Error(`Assimilation HTTP ${response.status}`)
      const data = await response.json()
      return z.object({ assimilated_state: z.array(z.number()), timestamp: z.string() }).parse(data)
    }, "h2-assimilate")
  }, "h2-assimilation")
}

function simpleAssimilation(current: number[], observation: number[], gain = 0.7): number[] {
  return current.map((c, i) => c + gain * (observation[i] - c))
}

// ============================================================================
// 5. Equations d'état pour chaque fluide (JavaScript pur)
// ============================================================================

// Équation de Silvera-Goldman pour H2
function silveraGoldmanPressure(rho: number, T: number): number {
  const R = 4124.0
  const A = 1.713e-3
  const B = 1.567e-6
  const C = 2.145e-12
  const alpha = 1.44
  const p_ideal = rho * R * T
  const repulsion = A * rho * Math.exp(alpha * rho / 100.0)
  const attraction = -B * rho * rho
  const quantum = C * rho * rho * rho / (T + 1e-6)
  return p_ideal * (1 + repulsion + attraction + quantum)
}

// Équation de Peng-Robinson pour NH3 et CH4
function pengRobinsonPressure(rho: number, T: number, params: { a: number, b: number, Tc: number, omega: number }, fluidType: string): number {
  const R_specific = (fluidType === "NH3") ? 488.2 : 518.3
  const Tr = T / params.Tc
  const kappa = 0.37464 + 1.54226 * params.omega - 0.26992 * params.omega ** 2
  const alpha = (1 + kappa * (1 - Math.sqrt(Tr))) ** 2
  const aT = params.a * alpha
  const v = 1 / rho
  return (R_specific * T / (v - params.b)) - (aT / (v * (v + params.b) + params.b * (v - params.b)))
}

// Équation simplifiée pour sCO2
function scCO2Pressure(rho: number, T: number, rho_c: number): number {
  const R = 188.9
  return rho * R * T * (1 + 0.1 * (rho / rho_c))
}

// Wrapper unifié
function computePressure(fluidType: string, rho: number, T: number): number {
  switch (fluidType) {
    case "H2":
      return silveraGoldmanPressure(rho, T)
    case "NH3":
    case "CH4":
      // Paramètres simplifiés (à améliorer)
      return pengRobinsonPressure(rho, T, { a: 0.1, b: 1e-5, Tc: fluidType === "NH3" ? 405.5 : 190.6, omega: fluidType === "NH3" ? 0.25 : 0.01 }, fluidType)
    case "sCO2":
      return scCO2Pressure(rho, T, 467.6)
    default:
      return rho * 4124 * T
  }
}

// ============================================================================
// 6. Moteur de simulation industrielle avancée (solveur d'EDO physique)
// ============================================================================

interface SimulationParams {
  pressure?: number | null
  temperature?: number | null
  velocity?: number | null
  fluid_type?: string | null
  scenario?: string | null
  x?: number | null
  y?: number | null
  z?: number | null
  mass_flow_rate?: number | null
  volume?: number | null
}

/**
 * Résout un système d'équations différentielles ordinaires (EDO) pour un fluide compressible 0D.
 * Respecte les lois de conservation de la masse, de l'énergie et du momentum.
 * Utilise un schéma d'Euler explicite.
 */
function simulateIndustrialDynamics(
  params: SimulationParams,
  timeSteps: number,
  duration: number
): z.infer<typeof PredictionResponseSchema>[] {
  const predictions: z.infer<typeof PredictionResponseSchema>[] = []
  const fluid = params.fluid_type ?? "H2"
  const dt = duration / (timeSteps - 1)

  // Propriétés thermophysiques par fluide
  const props: Record<string, { R: number; Cp: number; mu: number; k: number; T_ref: number; P_ref: number }> = {
    H2:   { R: 4124, Cp: 14300, mu: 8.8e-6, k: 0.18, T_ref: 20.3, P_ref: 1e5 },
    NH3:  { R: 488.2, Cp: 2100, mu: 1e-5, k: 0.02, T_ref: 298, P_ref: 1e5 },
    CH4:  { R: 518.3, Cp: 2200, mu: 1.1e-5, k: 0.03, T_ref: 298, P_ref: 1e5 },
    sCO2: { R: 188.9, Cp: 850, mu: 3e-5, k: 0.05, T_ref: 304.1, P_ref: 73.8e5 },
  }
  const p = props[fluid] ?? props.H2

  // État initial
  let P = params.pressure ?? p.P_ref
  let T = params.temperature ?? p.T_ref
  let u = params.velocity ?? 0.5
  let m_dot = params.mass_flow_rate ?? 0.1
  let V = params.volume ?? 100.0      // m³
  let rho = P / (p.R * T)             // loi des gaz parfaits initiale
  let mass = rho * V

  for (let i = 0; i < timeSteps; i++) {
    const t = i * dt

    // ===== Conservation de la masse =====
    let m_dot_out = 0.0
    if (fluid === "H2" && T > 33) {
      // Boil-off pour l'hydrogène (évaporation)
      m_dot_out = 0.0005 * mass * Math.max(0, (T - 33) / 100)
    }
    if (fluid === "CH4" && params.mass_flow_rate) {
      const leakFactor = 0.01 * (params.mass_flow_rate / 0.1)
      m_dot_out = leakFactor * m_dot
    }
    const dm = (m_dot - m_dot_out) * dt
    mass += dm
    rho = Math.max(0.01, mass / V)

    // ===== Équation d'état pour mise à jour de la pression =====
    P = computePressure(fluid, rho, T)
    P = Math.max(1e4, P)

    // ===== Conservation de l'énergie (température) =====
    const T_ext = 293.0
    const heatTransferCoeff = 10.0   
    const area = Math.pow(V, 2/3)
    const Q_conv = -heatTransferCoeff * area * (T - T_ext) / (mass * p.Cp)
    let Q_rxn = 0
    if (fluid === "NH3") {
      const conversion = 0.8 * (1 - Math.exp(-t / 5))
      const reactionRate = 0.01 * conversion * m_dot
      Q_rxn = 5000 * reactionRate / (mass * p.Cp)   
    }
    const dT = (Q_conv + Q_rxn) * dt
    T += dT
    T = Math.max(20, Math.min(800, T))

    // ===== Conservation du momentum (vitesse) =====
    const scenario = params.scenario ?? "storage"
    const L = 10.0   
    let dP_dx, friction, maxU
    if (scenario === "storage") {
      dP_dx = -(P - p.P_ref) / (L * 1000)
      friction = -0.5 * u
      maxU = 2.0
    } else {
      dP_dx = -(P - p.P_ref) / L
      friction = -0.02 * u * u / (2 * L)
      maxU = 100.0
    }
    const du = (dP_dx / rho + friction) * dt
    u += du
    u = Math.max(0, Math.min(maxU, u))

    predictions.push({
      pressure: P,
      velocity_u: u,
      velocity_v: 0.05 * Math.sin(t * 2) * u,
      velocity_w: 0.03 * Math.cos(t * 1.5) * u,
      temperature: T,
      density: rho,
      time: t,
      x: params.x ?? 0.5,
      y: params.y ?? 0.5,
      z: params.z ?? 0.5,
      timestamp: new Date(Date.now() + t * 1000).toISOString(),
    })
  }
  return predictions
}

// ============================================================================
// 7. Calcul du score de crédibilité (Logique métier corrigée)
// ============================================================================

function calculateCredibilityScore(
  extractedParams: z.infer<typeof PhysicalParametersSchema>,
  predictions3d: z.infer<typeof PredictionResponseSchema>[],
  assimilationResult: any
) {
  let score = 100
  const anomalies: string[] = []

  if (extractedParams.pressure && extractedParams.temperature) {
    const T = extractedParams.temperature
    if (extractedParams.equilibrium_pressure && extractedParams.enthalpy_delta_h) {
      const R = 8.314
      const P_eq_extracted = extractedParams.equilibrium_pressure
      const dH = extractedParams.enthalpy_delta_h * 1000
      const dS = (extractedParams.entropy_delta_s ?? 130.7)
      const P_eq_calc = Math.exp(dS/R - dH/(R*T)) * 1e5
      const dev = Math.abs(P_eq_extracted - P_eq_calc) / P_eq_calc
      if (dev > 0.4) {
        anomalies.push(`Thermodynamic inconsistency (Van't Hoff dev ${(dev*100).toFixed(1)}%)`)
        score -= 25
      } else if (dev > 0.2) {
        anomalies.push(`Moderate Van't Hoff deviation (${(dev*100).toFixed(1)}%)`)
        score -= 12
      }
    }
  }

  if (assimilationResult?.assimilated_state) {
    const init = predictions3d[0] ? [predictions3d[0].pressure, predictions3d[0].temperature, predictions3d[0].velocity_u] : [0,0,0]
    const [p_assimilated, t_assimilated, v_assimilated] = assimilationResult.assimilated_state;
    
    let correctedPressure = p_assimilated;
    if (p_assimilated > 100) {
      correctedPressure = p_assimilated / 100000; 
    }
    correctedPressure = Math.max(1, Math.min(10, correctedPressure));
    
    const friction = -0.5;
    let correctedVelocity = v_assimilated + (friction * v_assimilated);
    correctedVelocity = Math.max(-2.0, Math.min(2.0, correctedVelocity));

    assimilationResult.assimilated_state[0] = correctedPressure;
    assimilationResult.assimilated_state[2] = correctedVelocity;

    const correction = assimilationResult.assimilated_state.reduce((sum, val, i) => sum + Math.abs(val - init[i]), 0)
    const isRealistic = (correctedPressure >= 1 && correctedPressure <= 10) && 
                        (Math.abs(correctedVelocity) <= 2.0);

    if (!isRealistic) {
      anomalies.push("Physique hors limites après correction")
      score = Math.min(score, 45.0);
    } else {
      const pressureQuality = 1.0 - Math.abs(correctedPressure - 5.5) / 4.5;
      const velocityQuality = 1.0 - Math.abs(correctedVelocity) / 2.0;
      const physicalScore = (pressureQuality + velocityQuality) / 2.0 * 100.0;
      score = Math.min(score, physicalScore);

      if (correction > 50) {
        anomalies.push("High Kalman Filter correction required")
        score -= 10
      } else if (correction > 20) {
        anomalies.push("Moderate Kalman Filter correction")
        score -= 5
      }
    }
    // --- SUPPRESSION DU SCORE FORCÉ À 92.5% ---
  }

  if (extractedParams.velocity && extractedParams.velocity > 500) {
    anomalies.push(`Velocity ${extractedParams.velocity.toFixed(1)} m/s exceeds realistic limit`)
    score -= 15
  }

  return { score: Math.max(0, Math.min(100, score)), anomalies }
}

// ============================================================================
// 8. Authentification
// ============================================================================

async function verifyAuth(req: Request): Promise<{ userId: string }> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header")
  }
  const token = authHeader.split(" ")[1]
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error("Invalid token")
  return { userId: user.id }
}

// ============================================================================
// 9. Métriques Prometheus
// ============================================================================

let requestCounter = 0
let errorCounter = 0

function getMetrics(): string {
  return `# HELP edge_function_requests_total Total requests
# TYPE edge_function_requests_total counter
edge_function_requests_total{function="verify-physics-logic"} ${requestCounter}
# HELP edge_function_errors_total Total errors
# TYPE edge_function_errors_total counter
edge_function_errors_total{function="verify-physics-logic"} ${errorCounter}
`
}

// ============================================================================
// 10. Handler principal
// ============================================================================

serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  requestCounter++

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  if (req.method === "GET" && new URL(req.url).pathname === "/metrics") {
    return new Response(getMetrics(), { headers: { "Content-Type": "text/plain" } })
  }

  try {
    const { userId } = await verifyAuth(req)
    const payload = await req.json()
    const { projectId, analysisId, transcription, context } = VerificationRequestSchema.parse(payload)

    log("info", "Processing verification", { requestId, projectId, analysisId, userId })

    const extractedParams = await extractPhysicalParameters(transcription)
    log("debug", "Extracted parameters", { requestId, params: extractedParams })

    let predictions3d = simulateIndustrialDynamics(
      {
        pressure: extractedParams.pressure ?? undefined,
        temperature: extractedParams.temperature ?? undefined,
        velocity: extractedParams.velocity ?? undefined,
        fluid_type: extractedParams.fluid_type ?? undefined,
        scenario: extractedParams.scenario ?? undefined,
        x: extractedParams.x,
        y: extractedParams.y,
        z: extractedParams.z,
        mass_flow_rate: extractedParams.mass_flow_rate ?? undefined,
        volume: extractedParams.volume ?? undefined,
      },
      env.SIMULATION_TIMESTEPS,
      env.SIMULATION_DURATION
    )

    try {
      const pinnPred = await fetch3DPrediction({
        time: 0,
        x: extractedParams.x ?? 0.5,
        y: extractedParams.y ?? 0.5,
        z: extractedParams.z ?? 0.5,
      })
      predictions3d[0] = pinnPred
      log("info", "PINN prediction integrated", { requestId })
    } catch (err) {
      log("warn", "External PINN unavailable, using internal simulation", { requestId, error: err.message })
    }

    let assimilationResult
    try {
      const initialState = [predictions3d[0].pressure, predictions3d[0].temperature, predictions3d[0].velocity_u]
      const observation = [
        extractedParams.pressure ?? initialState[0],
        extractedParams.temperature ?? initialState[1],
        extractedParams.velocity ?? initialState[2],
      ]
      assimilationResult = await performAssimilation(initialState, observation)
    } catch (err) {
      log("warn", "Assimilation API failed, using simple Kalman fallback", { requestId, error: err.message })
      const initialState = [predictions3d[0].pressure, predictions3d[0].temperature, predictions3d[0].velocity_u]
      const observation = [
        extractedParams.pressure ?? initialState[0],
        extractedParams.temperature ?? initialState[1],
        extractedParams.velocity ?? initialState[2],
      ]
      const assimilated = simpleAssimilation(initialState, observation, 0.6)
      assimilationResult = { assimilated_state: assimilated, timestamp: new Date().toISOString() }
    }

    const { score, anomalies } = calculateCredibilityScore(extractedParams, predictions3d, assimilationResult)

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const insertPromise = supabase.from("analysis_results").insert({
      project_id: projectId,
      analysis_id: analysisId,
      extracted_parameters: extractedParams,
      pinn_predictions: predictions3d,
      assimilation_results: assimilationResult,
      credibility_score: score,
      anomalies,
      context,
      created_by: userId,
    })

    const updatePromise = supabase.from("analyses").update({
      status: "completed",
      results: { predictions3d, anomalies, extractedParams },
      credibility_score: score,
    }).eq("id", analysisId)

    await Promise.all([insertPromise, updatePromise])

    const durationMs = Date.now() - startTime
    log("info", "Verification completed", { requestId, score, anomaliesCount: anomalies.length, durationMs })

    return new Response(
      JSON.stringify({
        status: "success",
        credibilityScore: score,
        anomalies,
        extractedData: extractedParams,
        predictions3d,
        assimilation: assimilationResult,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (error) {
    errorCounter++
    log("error", "Unhandled error", { requestId: crypto.randomUUID(), error: error.message })
    let status = 500
    if (error instanceof z.ZodError) status = 400
    else if (error.message.includes("Authorization") || error.message.includes("token")) status = 401

    return new Response(
      JSON.stringify({ status: "error", error: error.message }),
      {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    )
  }
})
