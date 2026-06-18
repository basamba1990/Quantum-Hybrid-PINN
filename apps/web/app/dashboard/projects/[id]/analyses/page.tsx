'use client'

import { useParams } from 'next/navigation'
import { useRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'
import Link from 'next/link'
import ExportButton from '@/components/export-button'
import { Analysis } from '@/types'
import { Eye, ArrowRight } from 'lucide-react'

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
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
        >
          Nouvelle analyse
        </Link>
      </div>

      {analyses.length === 0 ? (
        <p>Aucune analyse.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nom</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Statut</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Score de Crédibilité</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => {
                // ✅ Correction: Recherche approfondie du score dans l'objet d'analyse ou ses résultats
                const results = typeof a.results === 'string' ? (function() { try { return JSON.parse(a.results); } catch(e) { return {}; } })() : (a.results || {});
                const score = (a as any).credibility_score ?? (a as any).credibilityScore ?? results.credibility_score ?? results.credibilityScore ?? 0;
                const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
                return (
                  <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{a.title || (a as any).name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        a.status === 'completed' ? 'bg-green-100 text-green-800' :
                        a.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-center text-sm font-bold ${scoreColor}`}>
                      {a.status === 'completed' ? `${score.toFixed(1)}/100` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.status === 'completed' && (
                        <Link
                          href={`/dashboard/projects/${projectId}/analyses/${a.id}`}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Voir détails
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}