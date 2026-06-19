import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-client@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { projectId, analysisId, transcription, context } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Extraction des paramètres physiques via LLM (Simulé ici pour la structure)
    // Dans une version réelle, on appellerait un LLM pour extraire P, T, L, D depuis la transcription
    const extractedData = {
      pressure: 80.0,      // bar
      temperature: 300.0,   // K
      length: 100000.0,    // m
      diameter: 0.5,       // m
      flow_rate: 2.0,      // kg/s
      fluid: 'H2'
    }

    // 2. Appel au moteur PINN Industriel avec SCAN SPATIAL
    const industrialApiUrl = Deno.env.get('H2_INFERENCE_API_URL') || 'https://quantum-pinn-api-qef2.onrender.com'
    
    console.log(`Calling industrial API at ${industrialApiUrl}/v2/validate-3d with spatial scan...`)
    
    const pinnResponse = await fetch(`${industrialApiUrl}/v2/validate-3d`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        // ✅ FIX: Au lieu d'un point fixe (0.5, 0.5, 0.5), on demande un scan spatial
        scan_spatial: true, 
        n_points: 10,
        pressure: extractedData.pressure * 1e5,
        temperature: extractedData.temperature,
        density: 1.0, // Sera recalculé par l'EOS du backend
        velocity_magnitude: 10.0
      })
    })

    if (!pinnResponse.ok) {
      throw new Error(`Industrial API error: ${pinnResponse.statusText}`)
    }

    const pinnData = await pinnResponse.json()
    
    // 3. Calcul du score de souveraineté (Exemple industriel)
    const sovereigntyScore = {
      dataSecurityScore: 95,
      intellectualPropertyScore: 90,
      independenceScore: 85,
      overallSovereigntyIndex: 90
    }

    // 4. Construction du résultat final
    const finalResults = {
      status: 'success',
      isPhysicallyCoherent: pinnData.credibility_score > 50,
      credibilityScore: pinnData.credibility_score,
      extractedData: extractedData,
      anomalies: pinnData.residuals?.momentum > 0.1 ? ['Instabilité de l\'impulsion détectée'] : [],
      predictions3d: pinnData.predictions3d || [],
      residuals: pinnData.residuals,
      sovereigntyScore: sovereigntyScore,
      timestamp: new Date().toISOString()
    }

    // 5. Mise à jour de la base de données
    await supabase
      .from('analyses')
      .update({
        status: 'completed',
        credibility_score: pinnData.credibility_score,
        results: finalResults
      })
      .eq('id', analysisId)

    return new Response(JSON.stringify(finalResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
