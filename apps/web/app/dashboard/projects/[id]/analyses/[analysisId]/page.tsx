'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Activity } from 'lucide-react'

const CFDViewer = dynamic(
  () => import('@/components/cfd/CFDViewer'),
  { ssr: false, loading: () => <div className="h-[600px] rounded-3xl border border-white/10 bg-slate-950 flex items-center justify-center text-cyan-400 font-mono text-xs uppercase tracking-widest">Chargement du maillage CFD...</div> }
)
import ScientificAuditCard from '@/components/scientific-audit-card'
import ScientificSocialHub from '@/components/scientific-social-hub'
import { format } from 'date-fns'
import { resolveVisualizationScenario } from '@/lib/visualization-data'
import { loadCertifiedCfdDataset } from '@/lib/cfd/cfd-repository'
import { CFDImportForm } from '@/components/cfd/CFDImportForm'

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
  const router = useRouter()
  const projectId = params.id as string
  const analysisId = params.analysisId as string
  const supabase = createClient()
  
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null)
  const [caseId, setCaseId] = useState('')
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
          if (!data) throw new Error('Analysis not found')

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

          // Merge high-fidelity persisted artifacts if available.
          const parsePersistedJson = (value: unknown) => {
            if (typeof value !== 'string') return value
            try { return JSON.parse(value) } catch { return value }
          }

          if (resData) {
            if (resData.pinn_predictions) results.predictions3d = resData.pinn_predictions;
            if (resData.experimental_data) results.experimental_data = resData.experimental_data;
            if (resData.cfd_dataset) results.cfd_dataset = parsePersistedJson(resData.cfd_dataset);
            if (resData.metadata) results.metadata = parsePersistedJson(resData.metadata);
            if (resData.mesh) results.mesh = parsePersistedJson(resData.mesh);
            if (resData.geometry) results.geometry = parsePersistedJson(resData.geometry);
            if (resData.discontinuity) results.discontinuity = parsePersistedJson(resData.discontinuity);
            results.extractedData = {
              ...(results.extractedData || {}),
              ...(resData.extracted_parameters || {})
            };
            results.credibilityScore = resData.credibility_score ?? results.credibilityScore;
          }

          // The CFD importer persists its authoritative dataset in cfd_datasets,
          // not in analyses.analysis_results. Load that contract through the
          // authenticated proxy so a successful import becomes renderable after
          // a reload while preserving its UNVALIDATED status.
          try {
            const cfdController = new AbortController()
            const cfdTimeout = window.setTimeout(() => cfdController.abort(), 15_000)
            const cfdResponse = await fetch(`/api/cfd/${encodeURIComponent(analysisId)}`, {
              cache: 'no-store',
              credentials: 'include',
              signal: cfdController.signal,
            })
            window.clearTimeout(cfdTimeout)
            if (cfdResponse.ok) {
              const cfdPayload = await cfdResponse.json()
              if (cfdPayload?.dataset && typeof cfdPayload.dataset === 'object') {
                let persistedDataset = cfdPayload.dataset
                // The API deliberately returns a compact summary on Render Free;
                // hydrate the exact gzip contract only when the viewer needs it.
                if (cfdPayload.datasetDeferred && typeof cfdPayload.datasetUrl === 'string' && typeof DecompressionStream !== 'undefined') {
                  const datasetResponse = await fetch(cfdPayload.datasetUrl, { cache: 'no-store' })
                  if (!datasetResponse.ok || !datasetResponse.body) throw new Error(`Contrat CFD compressé indisponible (${datasetResponse.status}).`)
                  const decompressed = datasetResponse.body.pipeThrough(new DecompressionStream('gzip'))
                  persistedDataset = JSON.parse(await new Response(decompressed).text())
                }
                results.cfd_dataset = persistedDataset
                results.cfd_status = cfdPayload.status
              }
            }
          } catch (cfdError) {
            console.warn('Persisted CFD dataset unavailable:', cfdError)
          }

          // ✅ Correction: Assurer que le score et les résultats sont correctement structurés
          const score = resData?.credibility_score ?? data.credibility_score ?? results?.credibility_score ?? results?.credibilityScore ?? 0;
          
          // S'assurer que predictions3d existe
          if (results && !results.predictions3d && results.predictions) {
            results.predictions3d = results.predictions;
          }

          console.log("Analysis Data Loaded (V2.1.7):", { id: data.id, score, hasPredictions: !!results?.predictions3d, points: results?.predictions3d?.length });
          
          const analysisTitle = data.name || data.title || 'Untitled analysis'
          const inferredCaseId = analysisTitle.split(/\s+[—–-]\s+/)[0]?.trim() || analysisTitle.trim()
          setCaseId(inferredCaseId)
          setAnalysis({
            ...data,
            title: analysisTitle,
            credibility_score: Number(score) || 0,
            results: results || {}
          })
        } catch (err: any) {
        setError(err.message || 'Failed to load the analysis')
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
          <ArrowLeft className="w-4 h-4" /> Back to analyses
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">{error || 'Analysis not found'}</p>
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
  const certifiedCfd = loadCertifiedCfdDataset(analysis, analysis.results)

  const auditData = {
    isPhysicallyCoherent: analysis.credibility_score > 50,
    credibilityScore: analysis.credibility_score,
    credibility_score: analysis.credibility_score,
    anomalies: analysis.results?.anomalies || [],
    extractedData: analysis.results?.extractedData || {},
    predictions3d: [],
    cfdDataset: certifiedCfd.buffers,
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
            <ArrowLeft className="w-4 h-4" /> Back to analyses
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

      <section className="space-y-4 rounded-[32px] border border-cyan-500/20 bg-slate-950/80 p-5 md:p-6">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Importer un dataset CFD</h2>
          <p className="mt-2 text-sm text-gray-600">
            Importez les frames VTU et le sidecar contractuel dans cette analyse. Les identifiants du projet et de l’analyse sont déterminés par la page courante.
          </p>
        </div>
        <label className="block text-sm text-slate-300">
          Case ID
          <input
            value={caseId}
            onChange={(event) => setCaseId(event.target.value)}
            disabled={false}
            className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            aria-describedby="cfd-case-id-help"
          />
          <span id="cfd-case-id-help" className="mt-1 block text-xs text-slate-500">
            Cette valeur doit correspondre au cas déclaré dans le sidecar importé.
          </span>
        </label>
        <CFDImportForm
          caseId={caseId}
          projectId={analysis.project_id}
          analysisId={analysis.id}
          onImported={() => {
            window.location.reload()
          }}
        />
      </section>

      {/* CFD view shared with the CFD Simulation page */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Visualisation CFD</h2>
          <span className="text-xs font-mono text-cyan-700">CFD mesh connects only when the versioned artifact is present and validated</span>
        </div>
        <div className="h-[600px] rounded-[40px] overflow-hidden border border-white/10 bg-slate-900/50">
          <CFDViewer dataset={certifiedCfd.buffers} className="min-h-[600px]" />
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
