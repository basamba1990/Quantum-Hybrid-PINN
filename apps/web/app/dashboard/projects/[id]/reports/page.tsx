'use client'

import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Report } from '@/types'
import { toast } from 'sonner'

export default function ReportsPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()
  const [reports, setReports] = useState<Report[]>([])
  const [uploading, setUploading] = useState(false)
  const { register, handleSubmit, reset } = useForm<{
    name: string
    file: FileList
  }>()

  const fetchReports = async () => {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setReports(data || [])
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const onSubmit = async (data: { name: string; file: FileList }) => {
    if (!data.file.length) {
      toast.error('Veuillez sélectionner un fichier')
      return
    }
    if (!data.name.trim()) {
      toast.error('Veuillez entrer un nom pour le rapport')
      return
    }

    setUploading(true)
    try {
      const file = data.file[0]
      
      // Vérifier que c'est un PDF
      if (!file.type.includes('pdf')) {
        toast.error('Seuls les fichiers PDF sont acceptés')
        setUploading(false)
        return
      }

      const fileName = `${projectId}/${Date.now()}_${file.name}`

      // Uploader le fichier
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('reports')
        .upload(fileName, file, { upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        toast.error(`Erreur lors de l'upload: ${uploadError.message}`)
        setUploading(false)
        return
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('reports')
        .getPublicUrl(fileName)

      // Insérer dans la base de données
      const { error: insertError } = await supabase.from('reports').insert({
        name: data.name,
        file_url: publicUrl,
        project_id: projectId,
      })

      if (insertError) {
        console.error('Insert error:', insertError)
        toast.error(`Erreur lors de la sauvegarde: ${insertError.message}`)
        // Supprimer le fichier uploadé en cas d'erreur
        await supabase.storage.from('reports').remove([fileName])
        setUploading(false)
        return
      }

      toast.success('Rapport uploadé avec succès')
      reset()
      fetchReports()
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Une erreur inattendue s\'est produite')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Gestion des rapports</h1>

      <div className="bg-white/5 border border-white/10 p-6 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-4">Uploader un nouveau rapport</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block mb-2 text-sm font-medium">
              Nom du rapport
            </label>
            <input
              id="name"
              {...register('name', { required: true })}
              className="w-full border border-white/10 bg-white/5 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Rapport Simulation Q1 2024"
              required
            />
          </div>
          <div>
            <label htmlFor="file" className="block mb-2 text-sm font-medium">
              Fichier PDF
            </label>
            <input
              id="file"
              type="file"
              accept=".pdf"
              {...register('file', { required: true })}
              className="w-full border border-white/10 bg-white/5 rounded px-3 py-2 text-white"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Formats acceptés: PDF uniquement</p>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {uploading ? 'Upload en cours...' : 'Uploader le rapport'}
          </button>
        </form>
      </div>

      <h2 className="text-xl font-semibold mb-4">Rapports existants</h2>
      {reports.length === 0 ? (
        <div className="bg-white/5 border border-dashed border-white/10 rounded-lg p-8 text-center">
          <p className="text-gray-400">Aucun rapport uploadé pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white/5 border border-white/10 rounded-lg p-4 flex justify-between items-center hover:border-white/20 transition-colors"
            >
              <div>
                <p className="font-medium text-white">{r.name}</p>
                <p className="text-sm text-gray-400">
                  Ajouté le {new Date(r.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <a
                href={r.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Télécharger
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}