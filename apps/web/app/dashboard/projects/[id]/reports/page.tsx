'use client'

import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Report } from '@/types'

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
    if (!data.file.length) return
    setUploading(true)
    const file = data.file[0]
    const fileName = `${projectId}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(fileName, file)

    if (uploadError) {
      alert('Erreur upload')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('reports')
      .getPublicUrl(fileName)

    const { error: insertError } = await supabase.from('reports').insert({
      name: data.name,
      file_url: publicUrl,
      project_id: projectId,
    })

    if (insertError) alert('Erreur sauvegarde')
    else {
      reset()
      fetchReports()
    }
    setUploading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Gestion des rapports</h1>

      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-3">Uploader un nouveau rapport</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block mb-1">
              Nom du rapport
            </label>
            <input
              id="name"
              {...register('name')}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="file" className="block mb-1">
              Fichier PDF
            </label>
            <input
              id="file"
              type="file"
              accept=".pdf"
              {...register('file')}
              className="w-full"
              required
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Upload...' : 'Uploader'}
          </button>
        </form>
      </div>

      <h2 className="text-xl font-semibold mb-3">Rapports existants</h2>
      {reports.length === 0 ? (
        <p>Aucun rapport.</p>
      ) : (
        reports.map((r) => (
          <div
            key={r.id}
            className="border rounded p-3 flex justify-between items-center mb-2"
          >
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-gray-500">
                Ajouté le {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            <a
              href={r.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Voir
            </a>
          </div>
        ))
      )}
    </div>
  )
}