'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Activity } from 'lucide-react'
import ScientificAuditCard from '@/components/scientific-audit-card'
import { format } from 'date-fns'

interface AnalysisDetail {
  id: string
  title: string
  status: string
  credibility_score: number
  results: any
  created_at: string
  project_id: string
}

export default function AnalysisDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const analysisId = params.analysisId as string
  const supabase = createClient()
  
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('analyses')
          .select('*')
          .eq('id', analysisId)
          .eq('project_id', projectId)
          .single()

        if (fetchError) throw fetchError
        if (!data) throw new Error('Analyse non trouvée')

        // Parse results if it's a string
        let results = data.results
        if (typeof results === 'string') {
          try {
            results = JSON.parse(results)
          } catch {
            results = {}
          }
        }

        // ✅ Correction: Assurer que le score est récupéré même s'il est dans results
        const score = data.credibility_score ?? results?.credibility_score ?? results?.credibilityScore ?? 0;
        
        setAnalysis({
          ...data,
          credibility_score: score,
          results: results || {}
        })
      } catch (err: any) {
        setError(err.message || 'Erreur lors du chargement de l\'analyse')
      } finally {
        setLoading(false)
      }
    }

    if (projectId && analysisId) {
      fetchAnalysis()
    }
  }, [projectId, analysisId, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'analyse...</p>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href={`/dashboard/projects/${projectId}/analyses`} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour aux analyses
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">{error || 'Analyse non trouvée'}</p>
        </div>
      </div>
    )
  }

  const auditData = {
    isPhysicallyCoherent: analysis.credibility_score > 50,
    credibilityScore: analysis.credibility_score,
    credibility_score: analysis.credibility_score,
    anomalies: analysis.results?.anomalies || [],
    extractedData: analysis.results?.extractedData || {},
    predictions3d: analysis.results?.predictions3d || [],
    confidenceMetrics: analysis.results?.confidenceMetrics,
    assimilation: analysis.results?.assimilation
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/dashboard/projects/${projectId}/analyses`} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour aux analyses
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">{analysis.title}</h1>
	          <p className="text-gray-600 mt-2">
	            <Activity className="w-4 h-4 inline mr-2" />
	            Créée le {analysis.created_at ? (function() {
                  try { return format(new Date(analysis.created_at), 'dd MMMM yyyy à HH:mm'); }
                  catch(e) { return 'Date invalide'; }
                })() : 'Date inconnue'}
	          </p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-black text-blue-600">{analysis.credibility_score.toFixed(1)}</div>
          <div className="text-sm text-gray-600">/100</div>
        </div>
      </div>

      {/* Main Content */}
      <ScientificAuditCard
        auditData={auditData}
        projectName={analysis.title}
      />
    </div>
  )
}
