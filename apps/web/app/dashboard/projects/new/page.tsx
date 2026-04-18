'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const { register, handleSubmit } = useForm<{
    name: string
    description: string
  }>()

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const onSubmit = async (formData: { name: string; description: string }) => {
    setLoading(true)
    setErrorMsg(null)
    
    try {
      // 1. Get the authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error("Session expirée ou utilisateur non trouvé. Veuillez vous reconnecter.")
      }

      // 2. Insert the project
      // Note: user.id is the UUID from auth.users, which matches our 'projects' user_id via RLS
      const { data: newProject, error: insertError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description,
          user_id: user.id,
          status: 'draft'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`Erreur lors de la création : ${insertError.message}`)
      }

      if (newProject) {
        router.push(`/dashboard/projects/${newProject.id}`)
        router.refresh()
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Créer un nouveau projet</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="name" className="block mb-1">
            Nom du projet
          </label>
          <input
            id="name"
            {...register('name')}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block mb-1">
            Description
          </label>
          <textarea
            id="description"
            {...register('description')}
            className="w-full border rounded px-3 py-2"
            rows={4}
          />
        </div>

        {errorMsg && (
          <p className="text-red-500 text-sm p-2 bg-red-50 border border-red-200 rounded">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Création en cours...' : 'Créer le projet'}
        </button>
      </form>
    </div>
  )
}