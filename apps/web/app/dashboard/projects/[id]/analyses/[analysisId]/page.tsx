'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Activity } from 'lucide-react'

const Industrial3DVisualizerEnhancedV11 = dynamic(
  () => import('@/components/industrial-3d-visualizer-enhanced-v11'),
  { ssr: false, loading: () => <div className="h-[600px] rounded-3xl border border-white/10 bg-slate-950 flex items-center justify-center text-cyan-400 font-mono text-xs uppercase tracking-widest">Initialisation de la visualisation CFD...</div> }
)
import ScientificAuditCard from '@/components/scientific-audit-card'
import ScientificSocialHub from '@/components/scientific-social-hub'
import { format } from 'date-fns'
import { extractVisualizationPayload, resolveVisualizationScenario } from '@/lib/visualization-data'

interface AnalysisDetail {
  id: string
  title: string
  status: string
  credibility_score: number
  results: any
  created_at: string
  project_id: string
  scenario_type?: string
  transcription?: string
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
          // 1. Fetch from analyses table for metadata
          const { data, error: fetchError } = await supabase
            .from('analyses')
            .select('*')
            .eq('id', analysisId)
            .eq('project_id', projectId)
            .maybeSingle()

          if (fetchError) throw fetchError
          if (!data) throw new Error('Analyse non trouvée')

          // 2. KELLY SENECAL V2.1.7: Fetch high-fidelity data from analysis_results
          const { data: resRows, error: resError } = await supabase
            .from('analysis_results')
            .select('*')
            .eq('analysis_id', analysisId)
            .order('created_at', { ascending: false })
            .limit(1)
          const resData = resRows?.[0] ?? null

          // Parse results if it's a string, and always provide an object before merging persisted fields
          let results = data?.results
          if (typeof results === 'string') {
            try {
              results = JSON.parse(results)
            } catch {
              results = {}
            }
          } else if (!results || typeof results !== 'object') {
            results = {}
          }

          // Merge high-fidelity predictions if available
          if (resData) {
            if (resData.pinn_predictions) results.predictions3d = resData.pinn_predictions;
            if (resData.experimental_data) results.experimental_data = resData.experimental_data;
            if (resData.mesh) results.mesh = resData.mesh;
            if (resData.geometry) results.geometry = resData.geometry;
            if (resData.discontinuity) results.discontinuity = resData.discontinuity;
            results.extractedData = {
              ...(results.extractedData || {}),
              ...(resData.extracted_parameters || {})
            };
            results.credibilityScore = resData.credibility_score || results.credibilityScore;
          }

          // ✅ Correction: Assurer que le score et les résultats sont correctement structurés
          const score = resData?.credibility_score ?? data.credibility_score ?? results?.credibility_score ?? results?.credibilityScore ?? 0;
          
          // S'assurer que predictions3d existe
          if (results && !results.predictions3d && results.predictions) {
            results.predictions3d = results.predictions;
          }

          console.log("Analysis Data Loaded (V2.1.7):", { id: data.id, score, hasPredictions: !!results?.predictions3d, points: results?.predictions3d?.length });
          
          setAnalysis({
            ...data,
            title: data.name || data.title || 'Analyse sans titre',
            credibility_score: Number(score) || 0,
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

  const scenarioEvidence = [
    analysis.transcription,
    analysis.results?.scenario_inputs?.transcription,
    analysis.results?.physicsParams?.transcription,
    analysis.results?.extractedData?.transcription,
  ].filter((value): value is string => typeof value === 'string').join('\n')

  const resolvedScenarioType = resolveVisualizationScenario([
    analysis.title,
    analysis.scenario_type,
    scenarioEvidence,
    analysis.results?.scenario_type,
    analysis.results?.scenarioType,
    analysis.results?.extractedData,
    analysis.results?.extracted_parameters,
  ])
  const visualizationPayload = extractVisualizationPayload(analysis)

  const auditData = {
    isPhysicallyCoherent: analysis.credibility_score > 50,
    credibilityScore: analysis.credibility_score,
    credibility_score: analysis.credibility_score,
    anomalies: analysis.results?.anomalies || [],
    extractedData: analysis.results?.extractedData || {},
    predictions3d: analysis.results?.predictions3d || [],
    confidenceMetrics: analysis.results?.confidenceMetrics,
    assimilation: analysis.results?.assimilation,
    riskAssessment: analysis.results?.risk_assessment,
    complianceReport: analysis.results?.compliance_report,
    residuals: analysis.results?.residuals,
    residualHistory: analysis.results?.residual_history,
    experimentalCorrelation: analysis.results?.experimental_correlation
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-[1800px] mx-auto space-y-8">
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
          <div className="text-5xl font-black text-blue-600">{(Number(analysis.credibility_score) || 0).toFixed(1)}</div>
          <div className="text-sm text-gray-600">/100</div>
        </div>
      </div>

      {/* Vue CFD identique à la page Simulation CFD */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Visualisation CFD</h2>
          <span className="text-xs font-mono text-cyan-700">Volume paramétrique plein — colorbar liée à la variable active</span>
        </div>
        <div className="h-[600px] rounded-[40px] overflow-hidden border border-white/10 bg-slate-900/50">
          <Industrial3DVisualizerEnhancedV11
            data={visualizationPayload.points}
            experimentalData={visualizationPayload.experimentalPoints}
            metadata={visualizationPayload.metadata}
            scenarioType={resolvedScenarioType}
            title={analysis.title}
          />
        </div>
      </section>

      {/* Main Content Layout - 3 Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left & Middle Columns: Scientific Audit (Span 2) */}
        <div className="lg:col-span-2 space-y-8">
          <ScientificAuditCard
            auditData={auditData}
            projectName={analysis.title}
            scenarioType={resolvedScenarioType}
          />
        </div>

        {/* Right Column: Social Hub */}
        <div className="lg:col-span-1">
          <ScientificSocialHub 
            analysisId={analysisId}
            projectId={projectId}
            credibilityScore={analysis.credibility_score}
          />
        </div>
      </div>
    </div>
  )
}
