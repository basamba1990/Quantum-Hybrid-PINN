/**
 * Supabase Edge Function: verify-physics-logic
 * Orchestrates physics verification workflow:
 * 1. Extracts physical parameters from transcription (GPT-4o)
 * 2. Validates against PINN model (H2-Inference API)
 * 3. Calculates credibility score
 * 4. Stores results in database
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
  [key: string]: number | undefined
}

interface VerificationResult {
  isPhysicallyCoherent: boolean
  credibilityScore: number
  anomalies: string[]
  extractedData: PhysicalParameters
  predictions: Array<{
    time: number
    position: number
    pressure: number
    velocity: number
    temperature: number
  }>
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
    console.log("[1/4] Extracting physical parameters from transcription...")
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

    // Step 2: Call H2-Inference API for PINN validation
    console.log("[2/4] Validating with PINN model...")
    const h2ApiUrl = Deno.env.get("H2_INFERENCE_API_URL") || "http://localhost:8000"

    const predictionPoints = [
      { time: 0.0, position: 0.0 },
      { time: 2.5, position: 0.25 },
      { time: 5.0, position: 0.5 },
      { time: 7.5, position: 0.75 },
      { time: 10.0, position: 1.0 },
    ]

    const predictionsResponse = await fetch(`${h2ApiUrl}/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch: predictionPoints }),
    })

    if (!predictionsResponse.ok) {
      console.warn(
        `H2-Inference API warning: ${predictionsResponse.status}. Continuing with validation...`
      )
    }

    const predictionsData = await predictionsResponse.json()
    const predictions = predictionsData.predictions || []

    console.log("[✓] PINN predictions retrieved")

    // Step 3: Calculate credibility score and detect anomalies
    console.log("[3/4] Calculating credibility score...")
    let credibilityScore = 100
    const anomalies: string[] = []

    // Validate pressure
    if (extractedParams.pressure !== undefined) {
      if (extractedParams.pressure < 1e5 || extractedParams.pressure > 700e5) {
        anomalies.push(
          `Pressure ${(extractedParams.pressure / 1e5).toFixed(1)} bar is outside valid range (1-700 bar)`
        )
        credibilityScore -= 20
      } else if (predictions.length > 0) {
        const avgPredictedPressure =
          predictions.reduce((sum: number, p: any) => sum + p.pressure, 0) /
          predictions.length
        const pressureDiff = Math.abs(
          extractedParams.pressure - avgPredictedPressure
        )
        const pressureDeviation = (pressureDiff / avgPredictedPressure) * 100

        if (pressureDeviation > 20) {
          anomalies.push(
            `Pressure deviation: ${pressureDeviation.toFixed(1)}% from PINN predictions`
          )
          credibilityScore -= 15
        }
      }
    }

    // Validate temperature
    if (extractedParams.temperature !== undefined) {
      if (extractedParams.temperature < 250 || extractedParams.temperature > 350) {
        anomalies.push(
          `Temperature ${extractedParams.temperature.toFixed(1)} K is outside valid range (250-350 K)`
        )
        credibilityScore -= 15
      } else if (predictions.length > 0) {
        const avgPredictedTemp =
          predictions.reduce((sum: number, p: any) => sum + p.temperature, 0) /
          predictions.length
        const tempDiff = Math.abs(extractedParams.temperature - avgPredictedTemp)
        const tempDeviation = (tempDiff / avgPredictedTemp) * 100

        if (tempDeviation > 10) {
          anomalies.push(
            `Temperature deviation: ${tempDeviation.toFixed(1)}% from PINN predictions`
          )
          credibilityScore -= 10
        }
      }
    }

    // Validate efficiency (Carnot limit check)
    if (extractedParams.efficiency !== undefined) {
      if (extractedParams.efficiency > 100) {
        anomalies.push(
          `Efficiency ${extractedParams.efficiency.toFixed(1)}% exceeds physical limit (100%)`
        )
        credibilityScore -= 25
      } else if (
        extractedParams.efficiency > 85 &&
        extractedParams.temperature !== undefined
      ) {
        // Carnot efficiency check
        const carnotEfficiency = 1 - 300 / extractedParams.temperature
        if (extractedParams.efficiency > carnotEfficiency * 100) {
          anomalies.push(
            `Efficiency exceeds Carnot limit (${(carnotEfficiency * 100).toFixed(1)}%) for given temperature`
          )
          credibilityScore -= 20
        }
      }
    }

    // Validate power
    if (extractedParams.power !== undefined) {
      if (extractedParams.power < 0) {
        anomalies.push(`Power cannot be negative: ${extractedParams.power} W`)
        credibilityScore -= 15
      }
    }

    credibilityScore = Math.max(0, Math.min(100, credibilityScore))

    console.log(`[✓] Credibility score: ${credibilityScore}/100`)

    // Step 4: Store results in database
    console.log("[4/4] Storing results in database...")

    const verificationResult: VerificationResult = {
      isPhysicallyCoherent: anomalies.length === 0 && credibilityScore > 70,
      credibilityScore,
      anomalies,
      extractedData: extractedParams,
      predictions,
    }

    const { error: insertError } = await supabase
      .from("physics_validations")
      .insert({
        project_id: projectId,
        analysis_id: analysisId,
        extracted_data: extractedParams,
        pinn_results: {
          predictions,
          validation_timestamp: new Date().toISOString(),
        },
        credibility_score: credibilityScore,
        is_physically_coherent: verificationResult.isPhysicallyCoherent,
        anomalies: anomalies,
      })

    if (insertError) {
      console.error("Database insert error:", insertError)
      throw insertError
    }

    // Update analysis status
    const { error: updateError } = await supabase
      .from("analyses")
      .update({
        status: "completed",
        results: verificationResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId)

    if (updateError) {
      console.error("Analysis update error:", updateError)
      throw updateError
    }

    console.log("[✓] Verification complete!")

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