'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { 
  ArrowLeft, Activity, Zap, ShieldCheck, Gauge, Thermometer, Database, Cpu, LayoutDashboard, FlaskConical, Layers, LogOut, Trash2, Download, AlertTriangle
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ScientificValidationWorkspace from '@/components/scientific-validation-workspace'
import { resolveVisualizationScenario } from '@/lib/visualization-data'
import { getScenarioDisplayName } from '@/types/simulation-scenarios'
import { loadCertifiedCfdDataset } from '@/lib/cfd/cfd-repository'

const CFDViewer = nextDynamic(
  () => import('@/components/cfd/CFDViewer'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-[32px] border border-white/10 text-blue-500 font-black uppercase tracking-widest">Chargement du maillage CFD...</div> }
)

const SweetSpotAnalysisPanel = nextDynamic(
  () => import('@/components/sweet-spot-analysis-panel'),
  { ssr: false, loading: () => <div className="h-48 bg-slate-950 rounded-[32px] border border-white/10 animate-pulse" /> }
)

const PlotlyChart = nextDynamic(
  () => import('@/components/plotly-chart'),
  { ssr: false, loading: () => <div className="h-64 bg-slate-950/50 rounded-2xl animate-pulse" /> }
)

export default function ProjectDetailClient({ id, project }: any) {
  const [latestAnalysis, setLatestAnalysis] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [downloadTrigger, setDownloadTrigger] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  // --- MODES DE DÉMONSTRATION (POUR LA SOUTENANCE) ---
  const [chaosMode, setChaosMode] = useState(false)
  const [leakAlertMode, setLeakAlertMode] = useState(false)
  
  useEffect(() => {
    const checkDemoModes = () => {
      setChaosMode(localStorage.getItem('DEMO_CHAOS') === 'true')
      setLeakAlertMode(localStorage.getItem('DEMO_LEAK') === 'true')
    }
    checkDemoModes()
    const interval = setInterval(checkDemoModes, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const parseMaybeJson = (value: unknown) => {
      if (typeof value !== 'string') return value
      try { return JSON.parse(value) } catch { return value }
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        const { data: analysisRows, error: anaError } = await supabase
          .from('analyses')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(50)
        const { data: cfdRows, error: cfdError } = await supabase
          .from('cfd_datasets')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(10)
        if (anaError) console.error("Supabase Analyses Error:", anaError)
        if (cfdError) console.error("Supabase CFD Dataset Error:", cfdError)
        console.log("Fetched Analyses Count:", analysisRows?.length || 0)
        const latestCfd = cfdRows?.[0]
        if (!analysisRows?.length) {
          if (latestCfd?.dataset) {
            setLatestAnalysis({
              id: latestCfd.analysis_id,
              project_id: id,
              created_at: latestCfd.created_at,
              updated_at: latestCfd.created_at,
              status: 'completed',
              results: {
                cfd_dataset: latestCfd.dataset,
                validation_status: latestCfd.status,
                artifact_hashes: latestCfd.artifact_manifest,
                certification_evidence: latestCfd.dataset.evidence ?? null,
              },
            })
          }
          setLoading(false)
          return
        }

        const analysisIds = analysisRows.map((row: any) => row.id)
        const { data: resultRows } = await supabase
          .from('analysis_results')
          .select('*')
          .in('analysis_id', analysisIds)
          .order('created_at', { ascending: false })
        const latestResultByAnalysis = new Map<string, any>()
        for (const row of resultRows ?? []) {
          if (!latestResultByAnalysis.has(row.analysis_id)) latestResultByAnalysis.set(row.analysis_id, row)
        }

        const candidates = analysisRows.map((analysisRow: any) => {
          const resultRow = latestResultByAnalysis.get(analysisRow.id)
          const mergedResults: any = parseMaybeJson(analysisRow.results) && typeof parseMaybeJson(analysisRow.results) === 'object'
            ? { ...parseMaybeJson(analysisRow.results) as Record<string, any> }
            : {}
          if (resultRow) {
            const persistedFields: Record<string, string> = {
              cfd_dataset: 'cfd_dataset',
              experimental_data: 'experimental_data',
              mesh: 'mesh',
              geometry: 'geometry',
              residuals: 'residuals',
              certification_evidence: 'certification_evidence',
              validation_checks: 'validation_checks',
              validation_status: 'validation_status',
              fields: 'fields',
              metadata: 'metadata',
            }
            for (const [sourceKey, targetKey] of Object.entries(persistedFields)) {
              if (resultRow[sourceKey] !== null && resultRow[sourceKey] !== undefined) mergedResults[targetKey] = parseMaybeJson(resultRow[sourceKey])
            }
          }
          return { ...analysisRow, results: mergedResults }
        })

        if (latestCfd?.dataset) {
          candidates.push({
            id: latestCfd.analysis_id,
            project_id: id,
            created_at: latestCfd.created_at,
            updated_at: latestCfd.created_at,
            status: 'completed',
            results: {
              cfd_dataset: latestCfd.dataset,
              validation_status: latestCfd.status,
              artifact_hashes: latestCfd.artifact_manifest,
              certification_evidence: latestCfd.dataset.evidence ?? null,
            },
          })
        }

        const rankCandidate = (candidate: any) => {
          const result = candidate.results ?? {}
          const status = String(result.validation_status ?? candidate.validation_status ?? '').toUpperCase()
          const evidence = result.certification_evidence ?? result.certificationEvidence
          const hasContract = result.cfd_dataset !== null && result.cfd_dataset !== undefined
          const statusRank = hasContract && (status === 'VALIDATED' || status === 'PASSED') ? 3 : hasContract ? 2 : 1
          const evidenceRank = evidence && typeof evidence === 'object' ? Object.values(evidence).filter(Boolean).length : 0
          const timestamp = Date.parse(candidate.updated_at ?? candidate.created_at ?? '') || 0
          return [statusRank, evidenceRank, timestamp]
        }
        candidates.sort((a: any, b: any) => {
          const left = rankCandidate(a)
          const right = rankCandidate(b)
          for (let index = 0; index < left.length; index += 1) {
            if (left[index] !== right[index]) return right[index] - left[index]
          }
          return 0
        })
        setLatestAnalysis(candidates[0] ?? null)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchData()
  }, [id, supabase])

  const results = latestAnalysis?.results || {}
  const scenarioType = resolveVisualizationScenario([latestAnalysis?.scenario_type, project?.scenario_type, project?.category, project?.name])
  const certifiedCfd = useMemo(() => loadCertifiedCfdDataset(latestAnalysis, results), [latestAnalysis, results])
  const residuals = chaosMode || leakAlertMode
      ? {}
      : (results?.residuals ?? {})
  const validationStatus = chaosMode || leakAlertMode
    ? "VALIDATION_FAILED"
    : (certifiedCfd.report?.canClaimValidated ? "VALIDATED" : "UNVALIDATED")
  const credibilityScore = chaosMode || leakAlertMode
    ? null
    : (typeof results?.credibility_score === 'number' ? results.credibility_score : null)
  const persistedMetadata: Record<string, unknown> = {}

  const validationWorkspaceResults = useMemo(() => ({
    ...results,
    scenario_type: scenarioType,
    extracted_parameters: results?.extracted_parameters,
    pinn_predictions: [],
    credibility_score: credibilityScore,
    residuals,
    validation_status: validationStatus,
    validationChecks: chaosMode || leakAlertMode
      ? { residuals_passed: false, boundary_conditions_passed: false, conservation_passed: false, reference_comparison_passed: false, uncertainty_reported: false }
      : (results?.validationChecks ?? results?.validation_checks),
    certification_evidence: chaosMode || leakAlertMode
      ? { contract_present: false, geometry_validated: false, mesh_validated: false, field_provenance_validated: false, autograd_verified: false, reference_validated: false }
      : (results?.certificationEvidence ?? results?.certification_evidence),
    validation_checks: chaosMode || leakAlertMode
      ? { residuals_passed: false, boundary_conditions_passed: false, conservation_passed: false, reference_comparison_passed: false, uncertainty_reported: false }
      : (results?.validation_checks ?? results?.validationChecks),
    artifact_hashes: results?.artifact_hashes,
    cfd_dataset: certifiedCfd.dataset,
  }), [scenarioType, persistedMetadata, residuals, chaosMode, leakAlertMode, credibilityScore, results, validationStatus, certifiedCfd.buffers])

  const projectDisplayName = getScenarioDisplayName(project?.scenario_type || project?.category || project?.name)

  return (
    <div className="flex min-h-screen bg-[#020617] text-white">
      <aside className="w-64 border-r border-white/5 bg-[#020617]/50 backdrop-blur-xl flex flex-col p-6 space-y-8 hidden lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]"><Zap className="w-5 h-5 text-white" /></div>
          <h2 className="text-lg font-black tracking-tighter italic uppercase leading-none">QuantumPINN <span className="text-[8px] text-blue-400">Truly-Operational V23</span></h2>
        </div>
        <nav className="flex-1 space-y-1">
          <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Tableau de bord" active />
          <NavItem icon={<Activity className="w-4 h-4" />} label="Simulations" />
          <NavItem icon={<Database className="w-4 h-4" />} label="Projets" />
          <NavItem icon={<ShieldCheck className="w-4 h-4" />} label="Audits" />
        </nav>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-auto">
          <button className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white"><LogOut className="w-3 h-3" /> Déconnexion</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white text-[9px] font-black uppercase tracking-[0.2em]"><ArrowLeft className="w-3 h-3" /> Retour</Link>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">{projectDisplayName}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setDownloadTrigger(prev => prev + 1)} className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase italic tracking-tighter shadow-xl flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Graphiques 300 DPI
            </button>
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase italic tracking-tighter shadow-2xl shadow-blue-900/40"><Zap className="w-4 h-4 fill-white mr-2 inline" /> New Analysis</button>
          </div>
        </div>

        <div className="space-y-10">
          {(chaosMode || leakAlertMode) && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-3xl p-6 flex items-center gap-4 animate-pulse">
              <AlertTriangle className="w-10 h-10 text-red-500" />
              <div>
                <h3 className="text-xl font-black uppercase italic text-red-400">
                  {leakAlertMode ? "ALERTE DE FUITE CRITIQUE DÉTECTÉE" : "Violation Critique de la Physique"}
                </h3>
                <p className="text-sm text-red-200/70">
                  {leakAlertMode 
                    ? "Anomalie de pression locale détectée sur la ligne DN50. Perte d'intégrité structurelle imminente." 
                    : "Les résidus de Navier-Stokes ont divergé. Certification G5 révoquée automatiquement."}
                </p>
              </div>
            </div>
          )}
          
          <div className="bg-[#0B1120]/60 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
            <SweetSpotAnalysisPanel data={(chaosMode || leakAlertMode) ? { ...results.sweet_spot_analysis, stability_assessment: { risk_level: "CRITICAL", stability_score: 0.12, sweet_spot: false } } : results.sweet_spot_analysis} loading={loading} />
          </div>

          <div className="space-y-6">
            <ScientificValidationWorkspace scenarioType={scenarioType} results={validationWorkspaceResults} loading={loading} />
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white px-2">Scientific Advanced Physics & Analytics</h2>
            <div className="bg-black border border-white/10 rounded-[40px] overflow-hidden shadow-2xl">
              <Tabs defaultValue="volumetric" className="w-full">
                <div className="px-8 pt-8 pb-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
                  <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-2xl h-14">
                    <TabsTrigger value="volumetric" className="rounded-xl px-6 font-black uppercase italic text-[10px] tracking-widest">Vue Volumétrique 3D</TabsTrigger>
                    <TabsTrigger value="thermal" className="rounded-xl px-6 font-black uppercase italic text-[10px] tracking-widest">Profils Thermodynamiques</TabsTrigger>
                    <TabsTrigger value="convergence" className="rounded-xl px-6 font-black uppercase italic text-[10px] tracking-widest">Convergence Autograd</TabsTrigger>
                  </TabsList>
                  <span className={`text-xs font-mono px-4 py-2 rounded-xl border ${(chaosMode || leakAlertMode) ? 'text-red-400 bg-red-500/10 border-red-500/20 animate-pulse' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
                    {(chaosMode || leakAlertMode) ? 'ALERTE G5 : Violation de la physique détectée' : `Statut G0-G5 : ${validationStatus}`}
                  </span>
                </div>

                <TabsContent value="volumetric" className="m-0 p-8">
                  <div className="relative rounded-[32px] overflow-hidden bg-slate-950/50 border border-white/5 min-h-[760px]">
                    <CFDViewer dataset={certifiedCfd.buffers} className="min-h-[600px]" />
                  </div>
                </TabsContent>

                <TabsContent value="thermal" className="m-0 p-8">
                  <div className="bg-slate-950/50 rounded-[32px] border border-white/5 p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div><h3 className="text-lg font-black uppercase italic tracking-tight text-white">Profils Thermodynamiques & Spatiaux</h3><p className="text-xs text-gray-400 font-mono">Références NIST REFPROP & NASA SNP-DOC-0046</p></div>
                    </div>
                    <PlotlyChart type="thermo" data={results} scenarioType={scenarioType} divId="plotly-thermo" downloadTrigger={downloadTrigger} />
                  </div>
                </TabsContent>

                <TabsContent value="convergence" className="m-0 p-8">
                  <div className="bg-slate-950/50 rounded-[32px] border border-white/5 p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div><h3 className="text-lg font-black uppercase italic tracking-tight text-white">Courbes de Convergence Autograd (PyTorch)</h3><p className="text-xs text-gray-400 font-mono">Minimisation des résidus des équations de Navier-Stokes</p></div>
                    </div>
                    <PlotlyChart type="convergence" data={results} scenarioType={scenarioType} divId="plotly-convergence" downloadTrigger={downloadTrigger} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function NavItem({ icon, label, active = false }: any) {
  return (
    <div className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer ${active ? 'bg-blue-600/10 border border-blue-600/20 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
      <div className={`${active ? 'text-blue-500' : 'text-gray-600'}`}>{icon}</div>
      <span className="text-[11px] font-black uppercase italic tracking-tighter">{label}</span>
    </div>
  )
}
// Build trigger: 2026-08-17 14:00
