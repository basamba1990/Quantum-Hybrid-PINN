'use client'

import { useParams } from 'next/navigation'
import { useRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'
import Link from 'next/link'
import ExportButton from '@/components/export-button'
import { Analysis } from '@/types'

export default function AnalysesPage() {
  const params = useParams()
  const projectId = params.id as string
  const analyses = useRealtime<Analysis>('analyses', {
    column: 'project_id',
    value: projectId,
  })

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Analyses du projet</h1>
        <ExportButton
          data={analyses}
          filename={`analyses_projet_${projectId}`}
          type="xlsx"
        />
      </div>

      <div className="mb-4">
        <Link
          href={`/dashboard/projects/${projectId}/analyses/new`}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Nouvelle analyse
        </Link>
      </div>

      {analyses.length === 0 ? (
        <p>Aucune analyse.</p>
      ) : (
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Nom</th>
              <th className="px-4 py-2 border">Statut</th>
              <th className="px-4 py-2 border">Date</th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2 border">{a.name}</td>
                <td className="px-4 py-2 border">{a.status}</td>
                <td className="px-4 py-2 border">
                  {format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}