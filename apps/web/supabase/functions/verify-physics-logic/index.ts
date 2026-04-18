/**
 * Supabase Edge Function: verify-physics-logic (V8 3D Integrated)
 * Orchestrates physics verification workflow:
 * 1. Extracts physical parameters from transcription (GPT-4o)
 * 2. Validates against V8 3D PINN model (H2-Inference API /v2/validate-3d)
 * 3. Performs Data Assimilation with Deep Kalman Filter (/v2/assimilate)
 * 4. Calculates credibility score based on 3D residuals and physical limits
 * 5. Stores results in database
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface VerificationRequest {
  projectId: string
  analysisId: string
  transcription: string
  context?: string
}

interface PhysicalParameters {
  pressure?: number
  temperature?: number
  velocity?: number
  efficiency?: number
  power?: number
  x?: number
  y?: number
  z?: number
  fluid_type?: string
  [key: string]: number | string | undefined
}

interface VerificationResult {
  isPhysicallyCoherent: boolean
  credibilityScore: number
  anomalies: string[]
  extractedData: PhysicalParameters
  predictions3d: Array<{
    time: number
    x: number
    y: number
    z: number
    pressure: number
    velocity_u: number
    velocity_v: number
    velocity_w: number
    temperature: number
    density: number
  }>
  assimilation?: {
    initial_state: number[]
    observation: number[]
    assimilated_state: number[]
  }
}

serve(async (req: Request) => {
  try {
    const payload: VerificationRequest = await req.json()
    const {
      projectId,
      analysisId,
      transcription,
      context = "hydrogen_storage",
    } = payload

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Step 1: Extract physical parameters using GPT-4o
    console.log("[1/5] Extracting physical parameters from transcription...")
    const extractionResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert physicist specializing in hydrogen storage and thermodynamics. 
Extract all physical parameters from the following text. Return a JSON object with:
- pressure (Pa, convert to SI units)
- temperature (K, convert to SI units)
- velocity (m/s)
- efficiency (%)
- power (W)
- volume (m³)
- mass_flow_rate (kg/s)
- x, y, z (coordinates in meters if mentioned, else default to 0.5)
- fluid_type (One of: "H2", "NH3", "CH4", "sCO2". Default to "H2" if not clear)

Include only parameters explicitly mentioned. Return null for missing values.
Respond ONLY with valid JSON, no additional text.`,
            },
            {
              role: "user",
              content: `Extract physical parameters from this pitch:\n\n${transcription}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      }
    )

    if (!extractionResponse.ok) {
      throw new Error(
        `OpenAI API error: ${extractionResponse.status} ${extractionResponse.statusText}`
      )
    }

    const extractionData = await extractionResponse.json()
    const extractedText = extractionData.choices[0].message.content
    const extractedParams: PhysicalParameters = JSON.parse(extractedText)

    console.log("[✓] Extracted parameters:", extractedParams)

    // Step 2: Call H2-Inference API for PINN V8 3D validation
    console.log("[2/5] Validating with V8 3D PINN model...")
    const h2ApiUrl = Deno.env.get("H2_INFERENCE_API_URL") || "http://localhost:8000"

    // Default 3D point if not specified
    const x = extractedParams.x ?? 0.5
    const y = extractedParams.y ?? 0.5
    const z = extractedParams.z ?? 0.5
    const t = 5.0 // Mid-simulation time

    const predictions3d: any[] = []
    
    // We do multiple points for a better 3D overview
    const points = [
        { time: t, x, y, z },
        { time: t, x: 0.2, y: 0.2, z: 0.2 },
        { time: t, x: 0.8, y: 0.8, z: 0.8 }
    ]

    for (const point of points) {
        try {
            const predResponse = await fetch(`${h2ApiUrl}/v2/validate-3d`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(point),
            })
            if (predResponse.ok) {
                const data = await predResponse.json()
                predictions3d.push(data)
            }
        } catch (e) {
            console.warn(`Failed to get 3D prediction for point`, point, e)
        }
    }

    console.log(`[✓] Retrieved ${predictions3d.length} 3D PINN predictions`)

    // Step 3: Data Assimilation with Deep Kalman Filter
    console.log("[3/5] Performing Data Assimilation...")
    let assimilationResult = null
    if (predictions3d.length > 0 && extractedParams.pressure !== undefined) {
        const firstPred = predictions3d[0]
        // state: [rho, u, v, w, T]
        const currentState = [firstPred.density, firstPred.velocity_u, firstPred.velocity_v, firstPred.velocity_w, firstPred.temperature]
        // obs: [pressure, temperature, flow_rate]
        const observation = [extractedParams.pressure, extractedParams.temperature ?? firstPred.temperature, extractedParams.mass_flow_rate ?? 0.1]
        
        try {
            const assimResponse = await fetch(`${h2ApiUrl}/v2/assimilate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    current_state: currentState,
                    observation: observation
                }),
            })
            if (assimResponse.ok) {
                const data = await assimResponse.json()
                assimilationResult = {
                    initial_state: currentState,
                    observation: observation,
                    assimilated_state: data.assimilated_state
                }
                console.log("[✓] Data assimilation successful")
            }
        } catch (e) {
            console.warn("Assimilation failed", e)
        }
    }

    // Step 4: Calculate credibility score and detect anomalies (Enhanced for V8 Multi-Fluid)
    console.log("[4/5] Calculating enhanced credibility score...")
    let credibilityScore = 100
    const anomalies: string[] = []
    const fluidType = (extractedParams.fluid_type as string) || "H2"

    // 1. Physical range checks based on Fluid Type
    if (extractedParams.pressure !== undefined) {
      const p = extractedParams.pressure as number
      if (fluidType === "H2" && (p < 1e5 || p > 1000e5)) {
        anomalies.push(`Pressure ${(p / 1e5).toFixed(1)} bar is outside safety limits for Hydrogen`)
        credibilityScore -= 25
      } else if (fluidType === "NH3" && (p < 1e5 || p > 200e5)) {
        anomalies.push(`Pressure ${(p / 1e5).toFixed(1)} bar is unusual for Ammonia storage`)
        credibilityScore -= 20
      }
    }

    if (extractedParams.temperature !== undefined) {
      if (extractedParams.temperature < 14 || extractedParams.temperature > 500) {
        anomalies.push(`Temperature ${extractedParams.temperature.toFixed(1)} K is outside liquid/supercritical range for H2`)
        credibilityScore -= 20
      }
    }

    // 2. PINN Residual/Deviation check
    if (predictions3d.length > 0 && extractedParams.pressure !== undefined) {
        const avgPredP = predictions3d[0].pressure
        const devP = Math.abs(extractedParams.pressure - avgPredP) / avgPredP
        if (devP > 0.3) {
            anomalies.push(`High pressure deviation (${(devP*100).toFixed(1)}%) from 3D PINN model`)
            credibilityScore -= 15
        }
    }

    // 3. Assimilation Correction check
    if (assimilationResult) {
        const stateDiff = assimilationResult.assimilated_state.reduce((acc: number, val: number, i: number) => 
            acc + Math.abs(val - assimilationResult.initial_state[i]), 0)
        if (stateDiff > 50) { // Arbitrary threshold for high correction
            anomalies.push("High state correction required by Kalman Filter, indicating low model-data agreement")
            credibilityScore -= 10
        }
    }

    credibilityScore = Math.max(0, Math.min(100, credibilityScore))
    console.log(`[✓] Final Credibility score: ${credibilityScore}/100`)

    // Step 5: Store results in database
    console.log("[5/5] Storing V8 results in database...")

    const verificationResult: VerificationResult = {
      isPhysicallyCoherent: anomalies.length === 0 && credibilityScore > 75,
      credibilityScore,
      anomalies,
      extractedData: extractedParams,
      predictions3d,
      assimilation: assimilationResult ?? undefined
    }

    // Insert into physics_validations (legacy and new fields)
    const { error: insertError } = await supabase
      .from("physics_validations")
      .insert({
        project_id: projectId,
        analysis_id: analysisId,
        extracted_data: extractedParams,
        pinn_results: {
          predictions3d,
          assimilation: assimilationResult,
          version: "V8-3D",
          validation_timestamp: new Date().toISOString(),
        },
        credibility_score: credibilityScore,
        is_physically_coherent: verificationResult.isPhysicallyCoherent,
        anomalies: anomalies,
      })

    if (insertError) throw insertError

    // Update analysis record
    const { error: updateError } = await supabase
      .from("analyses")
      .update({
        status: "completed",
        results: verificationResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId)

    if (updateError) throw updateError

    console.log("[✓] V8 Verification complete!")

    return new Response(
      JSON.stringify({
        status: "success",
        data: verificationResult,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Verification error:", error)
    return new Response(
      JSON.stringify({
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
