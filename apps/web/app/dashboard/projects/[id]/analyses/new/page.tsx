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

      // 2. Insert the analysis
      const { data: newAnalysis, error: insertError } = await supabase
        .from('analyses')
        .insert({
          name: formData.name,
          project_id: projectId,
          status: 'pending'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`Erreur lors de la création : ${insertError.message}`)
      }

      if (newAnalysis) {
        toast.success('Analyse créée avec succès')
        router.push(`/dashboard/projects/${projectId}/analyses`)
        router.refresh()
      }
    } catch (err: any) {
      console.error('Error:', err)
      setErrorMsg(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Nouvelle Analyse</h1>
        <p className="text-gray-400">Lancez une nouvelle analyse pour votre projet</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Informations de l'analyse</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-medium">
                Nom de l'analyse *
              </label>
              <input
                id="name"
                {...register('name', { required: 'Le nom est requis' })}
                className="w-full border border-white/10 bg-white/5 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Analyse de performance Navier-Stokes"
                required
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Création en cours...' : 'Lancer l\'analyse'}
          </button>
        </div>
      </form>
    </div>
  )
}
