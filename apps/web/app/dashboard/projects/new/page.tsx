'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { 
  Plus, 
  ArrowLeft, 
  Video, 
  FileText, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Info,
  Rocket,
  Atom
} from 'lucide-react'
import Link from 'next/link'

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
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error("Session expirée ou utilisateur non trouvé. Veuillez vous reconnecter.")
      }

      let videoUrl = null
      
      if (formData.video && formData.video.length > 0) {
        setUploading(true)
        const videoFile = formData.video[0]
        
        const validVideoTypes = ['video/mp4', 'video/webm', 'video/mpeg', 'video/quicktime']
        if (!validVideoTypes.includes(videoFile.type)) {
          throw new Error('Format vidéo non supporté. Utilisez MP4, WebM ou MOV.')
        }

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
        if (videoUrl) {
          const fileName = `${user.id}/${Date.now()}_${formData.video?.[0].name}`
          await supabase.storage.from('videos').remove([fileName])
        }
        throw new Error(`Erreur lors de la création : ${insertError.message}`)
      }

      if (newProject) {
        toast.success('Nexus de Simulation Initialisé 🚀')
        
        // En mode industriel, nous déclenchons automatiquement l'analyse physique 
        // si une transcription ou des paramètres sont fournis
        if (formData.transcription) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            // Appel asynchrone sans attendre la fin pour ne pas bloquer l'UI
            fetch(
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-physics-logic`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                  projectId: newProject.id,
                  transcription: formData.transcription,
                  context: 'hydrogen_storage_auto',
                }),
              }
            ).catch(err => console.error("Auto-analysis trigger failed:", err));
            
            toast.info('Analyse physique PINN lancée en arrière-plan...');
          } catch (err) {
            console.error("Failed to trigger auto-analysis:", err);
          }
        }

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
    <div className="p-8 max-w-4xl mx-auto space-y-10 relative">
      {/* Background Decorative */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] -z-10" />
      
      {/* Header Section */}
      <div className="space-y-4">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au Nexus
        </Link>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-500 font-mono text-[10px] uppercase tracking-[0.3em] mb-2">
            <Atom className="w-4 h-4" /> 
            <span>Initialisation de Simulation</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">
            Nouveau <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Projet PINN</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Configurez votre environnement de recherche hybride pour l'analyse Navier-Stokes et la diffusion thermique.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Main Configuration (Left) */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-8 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] -z-10" />
            
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Cpu className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Paramètres Noyau</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  Identifiant du Projet *
                </label>
                <input
                  id="name"
                  {...register('name', { required: 'Le nom est requis' })}
                  className="w-full border border-white/10 bg-white/5 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-lg font-bold"
                  placeholder="Ex: H2-CYLINDER-V8-SIM"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  Résumé Scientifique
                </label>
                <textarea
                  id="description"
                  {...register('description')}
                  className="w-full border border-white/10 bg-white/5 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[120px] leading-relaxed"
                  placeholder="Décrivez les objectifs physiques de cette simulation..."
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-8 space-y-8">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Données Physiques</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="transcription" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  Transcription ou Paramètres (Crucial pour PINN)
                </label>
                <textarea
                  id="transcription"
                  {...register('transcription')}
                  className="w-full border border-white/10 bg-white/5 rounded-2xl px-5 py-4 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[160px] leading-relaxed"
                  placeholder="Collez ici les données textuelles, transcriptions ou paramètres physiques à analyser par l'IA..."
                  rows={6}
                />
                <div className="flex items-start gap-2 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl mt-2">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-400/80 leading-relaxed uppercase tracking-tight">
                    Le moteur PINN V8 utilisera ce texte pour extraire les variables de pression, température et flux via GPT-4o.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Media & Action (Right) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-8 space-y-8">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="p-2.5 bg-purple-500/10 rounded-xl">
                <Video className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Média Source</h2>
            </div>

            <div className="space-y-4">
              <div className="relative group">
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
                  className="hidden"
                />
                <label 
                  htmlFor="video"
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/10 rounded-[24px] bg-white/[0.02] group-hover:bg-white/5 group-hover:border-blue-500/30 transition-all cursor-pointer p-6 text-center"
                >
                  <Video className="w-8 h-8 text-gray-600 group-hover:text-blue-500 mb-4 transition-colors" />
                  <span className="text-sm font-bold text-gray-400 group-hover:text-white transition-colors">Charger Vidéo Simulation</span>
                  <span className="text-[10px] text-gray-600 mt-2 uppercase tracking-tighter">MP4, WebM (Max 500MB)</span>
                  {videoFile && (
                    <div className="mt-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                      <p className="text-[10px] text-emerald-400 font-bold truncate max-w-[150px]">✓ {videoFile.name}</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                <Zap className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 font-medium leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || uploading}
              className="w-full group relative px-8 py-6 bg-white text-black font-black rounded-[24px] overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-white/5"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity" />
              <span className="relative flex items-center justify-center gap-3 text-lg">
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-black/10 border-t-black rounded-full animate-spin" />
                    Flux Vidéo...
                  </>
                ) : loading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-black/10 border-t-black rounded-full animate-spin" />
                    Initialisation...
                  </>
                ) : (
                  <>
                    <Rocket className="w-6 h-6" />
                    Démarrer Simulation
                  </>
                )}
              </span>
            </button>
            
            <p className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
              Nexus v8.0 DeepTech Infrastructure
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}
