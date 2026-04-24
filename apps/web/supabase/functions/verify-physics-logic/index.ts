// supabase/functions/verify-physics-logic/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { z } from "https://esm.sh/zod@3.22.4"

// ============================================================================
// 1. Configuration & validation d'environnement
// ============================================================================

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  H2_INFERENCE_URL: z.string().url().default("https://api.h2-inference.com"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(["debug","info","warn","error"]).default("info"),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  MAX_RETRIES: z.coerce.number().int().min(1).max(5).default(3),
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().default(5),
  SIMULATION_TIMESTEPS: z.coerce.number().int().default(20),
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
        const response = await fetch(`${env.H2_INFERENCE_URL}/v2/validate-3d`, {
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
      const response = await fetch(`${env.H2_INFERENCE_URL}/v2/assimilate`, {
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

// Fallback assimilation simple (filtre de Kalman 1D simplifié)
function simpleAssimilation(current: number[], observation: number[], gain = 0.7): number[] {
  return current.map((c, i) => c + gain * (observation[i] - c))
}

// ============================================================================
// 5. Moteur de simulation industrielle avancée (LH2 / H2)
// ============================================================================

interface SimulationParams {
  pressure?: number | null
  temperature?: number | null
  velocity?: number | null
  fluid_type?: string | null
  x?: number | null
  y?: number | null
  z?: number | null
}

function simulateIndustrialDynamics(params: SimulationParams, timeSteps: number, duration: number) {
  const predictions: z.infer<typeof PredictionResponseSchema>[] = []
  const baseP = params.pressure ?? 1e5
  const baseT = params.temperature ?? (params.fluid_type === "H2" ? 77.15 : 298.15) // LH2 par défaut
  const baseV = params.velocity ?? 0.5
  const fluid = params.fluid_type ?? "H2"

  // Modèle physique différencié selon fluide
  const isCryo = fluid === "H2" && baseT < 150 // LH2
  const boilOffRate = isCryo ? 0.0008 : 0.0002
  const pressureRiseFactor = isCryo ? 1.2 : 1.05

  for (let i = 0; i < timeSteps; i++) {
    const t = (i * duration) / (timeSteps - 1) // temps en secondes
    
    // Évolution réaliste de la pression : montée due au boil-off + oscillations
    let pressure = baseP * (1 + boilOffRate * t) 
    pressure *= (1 + 0.02 * Math.sin(t * 0.5)) // oscillation lente
    if (isCryo && t > 2) pressure *= pressureRiseFactor // effet de stockage fermé

    // Température : réchauffement pour LH2, stable sinon
    let temperature = baseT
    if (isCryo) {
      temperature = baseT + 0.5 * t + 2 * (1 - Math.exp(-t / 4))
    } else if (fluid === "H2") {
      temperature = baseT + 0.1 * t + 1 * Math.sin(t)
    } else {
      temperature = baseT + 0.05 * t
    }

    // Vitesse : fluctuations induites par débit de soutirage
    const velocity_u = baseV * (1 + 0.15 * Math.sin(t * 1.2) + 0.02 * Math.sin(t * 7))
    const velocity_v = 0.05 * Math.cos(t * 2.5) * (isCryo ? 1.5 : 1)
    const velocity_w = 0.02 * Math.sin(t * 5) * (isCryo ? 1.2 : 1)

    // Densité : fonction de la pression/température (loi des gaz parfaits approx)
    let density = 0.08988 // H2 standard
    if (fluid === "NH3") density = 0.73
    else if (fluid === "CH4") density = 0.657
    else if (fluid === "sCO2") density = 1.98
    if (temperature > 0 && pressure > 0) {
      const R_specific = 4124 // J/(kg·K) pour H2, approximatif
      density = pressure / (R_specific * temperature)
    }

    predictions.push({
      pressure,
      velocity_u,
      velocity_v,
      velocity_w,
      temperature,
      density,
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
// 6. Calcul du score de crédibilité (renforcé)
// ============================================================================

function calculateCredibilityScore(
  extractedParams: z.infer<typeof PhysicalParametersSchema>,
  predictions3d: z.infer<typeof PredictionResponseSchema>[],
  assimilationResult?: { assimilated_state: number[] }
): { score: number; anomalies: string[] } {
  let score = 100
  const anomalies: string[] = []
  const fluidType = extractedParams.fluid_type || "H2"
  const R = 8.314

  // 1. Vérification des limites physiques par fluide
  if (extractedParams.pressure) {
    const p = extractedParams.pressure
    const limits: Record<string, [number, number]> = {
      H2: [1e5, 800e5], NH3: [1e5, 200e5], CH4: [1e5, 300e5], sCO2: [73.8e5, 250e5]
    }
    const [minP, maxP] = limits[fluidType] || [1e4, 1e8]
    if (p < minP || p > maxP) {
      anomalies.push(`Pressure ${(p/1e5).toFixed(1)} bar outside typical ${fluidType} range [${minP/1e5}-${maxP/1e5}]`)
      score -= 25
    }
  }

  if (extractedParams.temperature) {
    const T = extractedParams.temperature
    const limits: Record<string, [number, number]> = {
      H2: [20, 800], NH3: [195, 500], CH4: [90, 600], sCO2: [304, 700]
    }
    const [minT, maxT] = limits[fluidType] || [14, 1000]
    if (T < minT || T > maxT) {
      anomalies.push(`Temperature ${T.toFixed(1)}K outside ${fluidType} range [${minT}-${maxT}]`)
      score -= 20
    }
  }

  // 2. Écart avec le modèle PINN (si disponible)
  if (predictions3d.length > 0 && extractedParams.pressure) {
    const pinnP = predictions3d[0].pressure
    if (pinnP > 0) {
      const devP = Math.abs(extractedParams.pressure - pinnP) / pinnP
      if (devP > 0.3) {
        anomalies.push(`High pressure deviation (${(devP*100).toFixed(1)}%) from PINN model`)
        score -= 15
      } else if (devP > 0.15) {
        anomalies.push(`Moderate pressure deviation (${(devP*100).toFixed(1)}%)`)
        score -= 8
      }
    }
  }

  // 3. Vérification thermodynamique (Van't Hoff) pour H2
  if (fluidType === "H2" && extractedParams.enthalpy_delta_h && extractedParams.temperature && extractedParams.equilibrium_pressure) {
    const deltaH = extractedParams.enthalpy_delta_h * 1000
    const deltaS = extractedParams.entropy_delta_s ?? 130.7
    const T = extractedParams.temperature
    const P_eq_extracted = extractedParams.equilibrium_pressure
    const P_eq_calc = Math.exp(-deltaH / (R * T) + deltaS / R)
    if (P_eq_calc > 0) {
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

  // 4. Correction par assimilation (cohérence du filtre)
  if (assimilationResult?.assimilated_state) {
    const init = predictions3d[0] ? [predictions3d[0].pressure, predictions3d[0].temperature, predictions3d[0].velocity_u] : [0,0,0]
    const correction = assimilationResult.assimilated_state.reduce((sum, val, i) => sum + Math.abs(val - init[i]), 0)
    if (correction > 50) {
      anomalies.push("High Kalman Filter correction required")
      score -= 10
    } else if (correction > 20) {
      anomalies.push("Moderate Kalman Filter correction")
      score -= 5
    }
  }

  // 5. Vitesse excessive
  if (extractedParams.velocity && extractedParams.velocity > 500) {
    anomalies.push(`Velocity ${extractedParams.velocity.toFixed(1)} m/s exceeds realistic limit`)
    score -= 15
  }

  return { score: Math.max(0, Math.min(100, score)), anomalies }
}

// ============================================================================
// 7. Authentification & RBAC
// ============================================================================

async function verifyAuth(req: Request): Promise<{ userId: string; hasRole: boolean }> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header")
  }
  const token = authHeader.split(" ")[1]
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) // service role pour vérifier
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error("Invalid token")
  
  // Vérification de rôle (table user_roles)
  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()
  const hasRole = roleData?.role === "analyst" || roleData?.role === "admin"
  if (!hasRole) log("warn", "User missing required role", { userId: user.id })
  return { userId: user.id, hasRole }
}

// ============================================================================
// 8. Métriques Prometheus
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
// 9. Handler principal
// ============================================================================

serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  requestCounter++

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  // Endpoint métriques
  if (req.method === "GET" && new URL(req.url).pathname === "/metrics") {
    return new Response(getMetrics(), { headers: { "Content-Type": "text/plain" } })
  }

  try {
    // Auth
    const { userId, hasRole } = await verifyAuth(req)
    if (!hasRole) {
      return new Response(JSON.stringify({ status: "error", error: "Insufficient permissions" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      })
    }

    // Parse & validate input
    let payload
    try {
      const raw = await req.text()
      if (!raw) throw new Error("Empty body")
      payload = JSON.parse(raw)
    } catch {
      throw new Error("Invalid JSON body")
    }
    const { projectId, analysisId, transcription, context } = VerificationRequestSchema.parse(payload)

    log("info", "Processing verification", { requestId, projectId, analysisId, userId })

    // Étape 1 : Extraction des paramètres physiques
    const extractedParams = await extractPhysicalParameters(transcription)
    log("debug", "Extracted parameters", { requestId, params: extractedParams })

    // Étape 2 : Simulation / Prédiction 3D (hybride)
    let predictions3d = simulateIndustrialDynamics(
      extractedParams,
      env.SIMULATION_TIMESTEPS,
      env.SIMULATION_DURATION
    )

    // Tentative d'appel API PINN pour le premier point (remplace la simulation)
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

    // Étape 3 : Assimilation des données (Kalman)
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

    // Étape 4 : Calcul du score de crédibilité
    const { score, anomalies } = calculateCredibilityScore(extractedParams, predictions3d, assimilationResult)

    // Étape 5 : Persistance asynchrone (non bloquante)
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
    }).then(({ error }) => {
      if (error) log("error", "DB insert failed", { requestId, error: error.message })
      else log("debug", "DB insert success", { requestId })
    }).catch(err => log("error", "DB async error", { requestId, error: err.message }))

    const updatePromise = supabase.from("analyses").update({
      status: "completed",
      results: { predictions3d, anomalies, extractedParams },
      credibility_score: score,
    }).eq("id", analysisId).then(({ error }) => {
      if (error) log("error", "Update analyses failed", { requestId, error: error.message })
    })

    // On attend juste un petit délai pour que les logs apparaissent, mais on ne bloque pas la réponse
    Promise.all([insertPromise, updatePromise]).catch(e => log("error", "DB operation failed", { requestId, error: e.message }))

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
    log("error", "Unhandled error", { requestId: crypto.randomUUID(), error: error.message, stack: error.stack })
    let status = 500
    if (error instanceof z.ZodError) status = 400
    else if (error.message.includes("Authorization") || error.message.includes("token")) status = 401
    else if (error.message.includes("permissions")) status = 403

    return new Response(
      JSON.stringify({ status: "error", error: error.message }),
      {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    )
  }
})
