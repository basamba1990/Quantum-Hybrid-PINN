'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

export default function NewAnalysisPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()
  
  const { register, handleSubmit } = useForm<{
    name: string
  }>()

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const onSubmit = async (formData: { name: string }) => {
    setLoading(true)
    setErrorMsg(null)
    
    try {
      // 1. Get the authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error("Session expirée ou utilisateur non trouvé. Veuillez vous reconnecter.")
      }

      // 2. Get project details FIRST (specifically transcription for the PINN model)
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('transcription')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        throw new Error("Impossible de récupérer les données du projet.")
      }

      if (!project.transcription) {
        throw new Error("Aucune transcription ou donnée physique trouvée pour ce projet. Veuillez ajouter une transcription dans les paramètres du projet.")
      }

      // 3. Insert the analysis record (initial status: pending)
      const { data: newAnalysis, error: insertError } = await supabase
        .from('analyses')
        .insert({
          name: formData.name,
          title: formData.name,
          project_id: projectId,
          user_id: user.id,
          status: 'pending',
          analysis_type: 'physics_verification',
          transcription: project.transcription
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`Erreur lors de la création : ${insertError.message}`)
      }

      // 4. 🔥 CALL EDGE FUNCTION (The Real Physics Engine)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("Supabase environment variables are missing, attempting relative call...")
      }

      const res = await fetch(
        `${supabaseUrl}/functions/v1/verify-physics-logic`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            projectId: projectId,
            analysisId: newAnalysis.id,
            transcription: project.transcription,
          }),
        }
      )

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Erreur lors de l'analyse IA / PINN")
      }

      const result = await res.json()
      const data = result.status === 'success' ? result : result.data

      // Mettre à jour le statut de l'analyse à 'completed'
      const { error: updateError } = await supabase
        .from('analyses')
        .update({
          status: 'completed',
          credibility_score: data.credibilityScore,
          results: data,
        })
        .eq('id', newAnalysis.id)

      if (updateError) {
        console.error('Error updating analysis status:', updateError)
      }

      toast.success('Analyse lancée avec succès 🚀')
      
      // Redirect to the analyses list
      router.push(`/dashboard/projects/${projectId}/analyses`)
      router.refresh()
      
    } catch (err: any) {
      console.error('Analysis execution error:', err)
      setErrorMsg(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Nouvelle Analyse Scientifique
        </h1>
        <p className="text-gray-400">Lancez le moteur PINN V8 pour valider la cohérence physique de vos données.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Configuration de l'Analyse
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-300">
                Nom de l'analyse *
              </label>
              <input
                id="name"
                {...register('name', { required: 'Le nom est requis' })}
                className="w-full border border-white/10 bg-white/5 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Ex: Validation Cryogénique H2 - Phase 1"
                required
              />
            </div>
            
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-300">
                <strong>Note DeepTech :</strong> Cette action déclenchera une Edge Function Supabase, extraira les paramètres physiques via GPT-4o, et les validera contre le modèle PINN 3D.
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400 text-sm flex items-center gap-2">
              <span>⚠️</span> {errorMsg}
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 bg-white/5 text-white px-4 py-3 rounded-xl hover:bg-white/10 transition-colors font-medium border border-white/10"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-blue-900/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyse en cours...
              </span>
            ) : 'Lancer l\'Analyse Réelle'}
          </button>
        </div>
      </form>
    </div>
  )
}
