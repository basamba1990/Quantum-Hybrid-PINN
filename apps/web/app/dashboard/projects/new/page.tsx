'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const { register, handleSubmit, watch } = useForm<{
    name: string
    description: string
    video?: FileList
    transcription?: string
  }>()

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)

  const onSubmit = async (formData: { name: string; description: string; video?: FileList; transcription?: string }) => {
    setLoading(true)
    setErrorMsg(null)
    
    try {
      // 1. Get the authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error("Session expirée ou utilisateur non trouvé. Veuillez vous reconnecter.")
      }

      let videoUrl = null
      
      // 2. Upload video if provided
      if (formData.video && formData.video.length > 0) {
        setUploading(true)
        const videoFile = formData.video[0]
        
        // Validate video file type
        const validVideoTypes = ['video/mp4', 'video/webm', 'video/mpeg', 'video/quicktime']
        if (!validVideoTypes.includes(videoFile.type)) {
          throw new Error('Format vidéo non supporté. Utilisez MP4, WebM ou MOV.')
        }

        // Validate file size (max 500MB)
        const maxSize = 500 * 1024 * 1024
        if (videoFile.size > maxSize) {
          throw new Error('La vidéo est trop volumineuse (max 500MB).')
        }

        const fileName = `${user.id}/${Date.now()}_${videoFile.name}`

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, videoFile, { upsert: false })

        if (uploadError) {
          console.error('Video upload error:', uploadError)
          throw new Error(`Erreur lors de l'upload vidéo: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('videos')
          .getPublicUrl(fileName)

        videoUrl = publicUrl
        setUploading(false)
      }

      // 3. Insert the project
      const { data: newProject, error: insertError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description,
          video_url: videoUrl,
          transcription: formData.transcription || null,
          user_id: user.id,
          status: 'draft'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        // Clean up uploaded video if project creation fails
        if (videoUrl) {
          const fileName = `${user.id}/${Date.now()}_${formData.video?.[0].name}`
          await supabase.storage.from('videos').remove([fileName])
        }
        throw new Error(`Erreur lors de la création : ${insertError.message}`)
      }

      if (newProject) {
        toast.success('Projet créé avec succès')
        router.push(`/dashboard/projects/${newProject.id}`)
        router.refresh()
      }
    } catch (err: any) {
      console.error('Error:', err)
      setErrorMsg(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Créer un nouveau projet</h1>
        <p className="text-gray-400">Configurez votre simulation Quantum Hybrid PINN</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Nom du projet */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Informations de base</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-medium">
                Nom du projet *
              </label>
              <input
                id="name"
                {...register('name', { required: 'Le nom est requis' })}
                className="w-full border border-white/10 bg-white/5 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Simulation CFD Hybride Q1 2024"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block mb-2 text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                {...register('description')}
                className="w-full border border-white/10 bg-white/5 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Décrivez votre projet..."
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Upload vidéo */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Média et données</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="video" className="block mb-2 text-sm font-medium">
                Vidéo de simulation (optionnel)
              </label>
              <input
                id="video"
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                {...register('video')}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setVideoFile(e.target.files[0])
                  }
                }}
                className="w-full border border-white/10 bg-white/5 rounded px-3 py-2 text-white"
              />
              <p className="text-xs text-gray-400 mt-1">
                Formats: MP4, WebM, MOV (max 500MB)
                {videoFile && <span className="ml-2 text-green-400">✓ {videoFile.name}</span>}
              </p>
            </div>

            <div>
              <label htmlFor="transcription" className="block mb-2 text-sm font-medium">
                Transcription ou notes (optionnel)
              </label>
              <textarea
                id="transcription"
                {...register('transcription')}
                className="w-full border border-white/10 bg-white/5 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Collez la transcription ou vos notes de simulation..."
                rows={4}
              />
              <p className="text-xs text-gray-400 mt-1">
                Vous pouvez ajouter du texte, des notes ou une transcription de votre vidéo
              </p>
            </div>
          </div>
        </div>

        {/* Messages d'erreur */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Bouton de soumission */}
        <button
          type="submit"
          disabled={loading || uploading}
          className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {uploading ? 'Upload vidéo...' : loading ? 'Création en cours...' : 'Créer le projet'}
        </button>
      </form>
    </div>
  )
}
