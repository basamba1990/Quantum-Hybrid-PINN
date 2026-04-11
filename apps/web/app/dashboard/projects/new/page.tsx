'use client'

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

  const onSubmit = async (data: { name: string; description: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        name: data.name,
        description: data.description,
        user_id: user.id,
      })
      .select()
      .single()

    if (!error && newProject) {
      router.push(`/dashboard/projects/${newProject.id}`)
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

        <button
          type="submit"
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Créer le projet
        </button>
      </form>
    </div>
  )
}