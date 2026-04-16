'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project, Report } from '@/types'
import PDFViewer from '@/components/pdf-viewer'
import { format } from 'date-fns'

export default function ProjectDetailClient({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })

      setProject(projectData)
      setReports(reportsData || [])
      setLoading(false)
    }

    fetchData()
  }, [id])

  if (loading) return <div className="p-8">Chargement...</div>
  if (!project) return <div className="p-8">Projet non trouvé</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-gray-600 mt-2">{project.description}</p>
        <p className="text-sm text-gray-500 mt-1">
          Créé le {format(new Date(project.created_at), 'dd/MM/yyyy')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Rapports PDF</h2>
          {reports.length === 0 ? (
            <p className="text-gray-500">Aucun rapport.</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((report) => (
                <li key={report.id}>
                  <a
                    href={report.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline block truncate"
                  >
                    {report.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Aperçu PDF</h2>
          {reports.length > 0 ? (
            <PDFViewer url={reports[0].file_url} />
          ) : (
            <p className="text-gray-500">
              Sélectionnez un rapport pour l'aperçu.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Link
          href={`/dashboard/projects/${id}/analyses`}
          className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
        >
          Voir les analyses
        </Link>
        <Link
          href={`/dashboard/projects/${id}/reports`}
          className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
        >
          Gérer les rapports
        </Link>
      </div>
    </div>
  )
}
