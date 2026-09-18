'use client'
import { useState, useEffect, useMemo, useRef } from "react"
import { 
  FlaskConical, Activity, Play, Share2, AlertCircle, Info, Loader2, ChevronRight, Settings,
  Database, ShieldAlert, Wind, Layers, CheckCircle2, Lightbulb, Maximize2, Download, FileJson
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import dynamic from 'next/dynamic'
import { HybridSimulationPanel } from "@/components/HybridSimulationPanel"
import { createClient } from '@/lib/supabase/client'
import { fr } from 'date-fns/locale'
import { resolveVisualizationScenario } from '@/lib/visualization-data'
import { loadCertifiedCfdDataset } from '@/lib/cfd/cfd-repository'
import { loadCfdVtuSeries } from '@/lib/cfd/cfd-loader'

const CFDViewer = dynamic(
  () => import('@/components/cfd/CFDViewer'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-cyan-500/30 text-blue-500 font-mono text-xs uppercase tracking-widest">Chargement du maillage CFD...</div> }
)

const AdvancedPhysicsVisualization = dynamic(
  () => import('@/components/AdvancedPhysicsVisualization'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-emerald-500 animate-pulse">Chargement de l'analyse physique avancée...</div> }
)

export default function SimulationsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [analyses, setAnalyses] = useState<any[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null)
  const [demoCfdBuffers, setDemoCfdBuffers] = useState<any | null>(null)
  const [demoCfdError, setDemoCfdError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dynamicMetrics, setDynamicMetrics] = useState({ credibility: 0, computeTime: 0, validatedPoints: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const visualizerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
        if (error) throw error
        setProjects(data || [])
        if (data && data.length > 0) setSelectedProject(data[0])
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchProjects()
  }, [supabase])

  useEffect(() => {
    if (selectedProject) {
      const fetchAnalyses = async () => {
        try {
          const { data } = await supabase.from('analyses').select('*').eq('project_id', selectedProject.id).order('created_at', { ascending: false })
          setAnalyses(data || [])
          if (data && data.length > 0) {
            const latest = data[0]
            const { data: analysisResult } = await supabase.from('analysis_results').select('*').eq('analysis_id', latest.id).maybeSingle()
            const enriched = { ...latest, analysisResult }
            setSelectedAnalysis(enriched)
            const results = typeof latest.results === "object" && latest.results ? latest.results : {}
            const certified = loadCertifiedCfdDataset(enriched, analysisResult)
            setDynamicMetrics({
              credibility: latest.credibility_score || 0,
              computeTime: typeof results.computeTime === "number" ? results.computeTime : 0,
              validatedPoints: certified.buffers?.cellCount ?? 0
            })
          } else {
            setSelectedAnalysis(null)
            setDynamicMetrics({ credibility: 0, computeTime: 0, validatedPoints: 0 })
          }
        } catch (err) { console.error(err) }
      }
      fetchAnalyses()
    }
  }, [selectedProject, supabase])

  useEffect(() => {
    let cancelled = false
    const loadPreview = async () => {
      setDemoCfdBuffers(null)
      setDemoCfdError(null)
      const projectText = [selectedProject?.name, selectedProject?.description, selectedProject?.scenario_type].filter(Boolean).join(' ')
      if (!selectedProject || !/PCCV|TRANSIENT|LH2/i.test(projectText)) return
      try {
        const previewBase = /PCCV|TRANSIENT/i.test(projectText)
          ? '/cfd-demo/pccv-transient-run-001-real'
          : '/cfd-demo/lh2-tank-preview'
        const sidecarResponse = await fetch(`${previewBase}/sidecar.json`, { cache: 'force-cache' })
        if (!sidecarResponse.ok) throw new Error(`Sidecar CFD indisponible (${sidecarResponse.status}).`)
        const sidecar = await sidecarResponse.json()
        const frameSources = await Promise.all((sidecar.frames ?? []).map(async (frame: { frameId: string; time: number; file: string; payloadHash: string }) => {
          const response = await fetch(`${previewBase}/${frame.file}`, { cache: 'force-cache' })
          if (!response.ok) throw new Error(`Frame VTU indisponible (${response.status}).`)
          return { frameId: frame.frameId, time: frame.time, payload: await response.arrayBuffer(), payloadHash: frame.payloadHash }
        }))
        const buffers = await loadCfdVtuSeries(frameSources, sidecar)
        if (!cancelled) setDemoCfdBuffers(buffers)
      } catch (error) {
        if (!cancelled) setDemoCfdError(error instanceof Error ? error.message : 'Erreur de chargement du preview CFD.')
      }
    }
    void loadPreview()
    return () => { cancelled = true }
  }, [selectedProject])

  const certifiedCfd = useMemo(() => selectedAnalysis ? loadCertifiedCfdDataset(selectedAnalysis, selectedAnalysis.analysisResult) : { dataset: null, buffers: null, report: null }, [selectedAnalysis])
  const viewerBuffers = certifiedCfd.buffers ?? demoCfdBuffers
  const predictions3d: never[] = []
  const scenarioType = useMemo(() => resolveVisualizationScenario([
    selectedProject?.name,
    selectedProject?.description,
    selectedAnalysis?.scenario_type,
    selectedAnalysis?.name,
    selectedAnalysis?.results,
    selectedAnalysis?.analysisResult,
  ]), [selectedProject, selectedAnalysis])


  if (loading) return <div className="p-20 text-center animate-pulse text-blue-500 font-mono">CHARGEMENT DES SYSTÈMES...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Simulation Center</h1>
          <p className="text-gray-500 text-xs font-mono uppercase">Kelly Senecal Gold Standard V2.1.7</p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Engine Active</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <Card className="lg:col-span-1 bg-white/5 border-white/10 rounded-[32px]">
          <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-gray-400">Projets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {projects.map(p => (
              <button key={p.id} onClick={() => setSelectedProject(p)} className={`w-full text-left p-4 rounded-2xl transition-all ${selectedProject?.id === p.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                <p className="text-sm font-bold truncate">{p.name}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-8">
          <Tabs defaultValue="visualizer" className="w-full">
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl">
              <TabsTrigger value="visualizer" className="rounded-xl uppercase text-[10px] font-bold">Visualiseur CFD</TabsTrigger>
              <TabsTrigger value="hybrid" className="rounded-xl uppercase text-[10px] font-bold">Hybrid Panel</TabsTrigger>
              <TabsTrigger value="audit" className="rounded-xl uppercase text-[10px] font-bold">Audit Physique</TabsTrigger>
            </TabsList>

            <TabsContent value="visualizer" className="mt-6 space-y-6">
              <div className="h-[600px] rounded-[40px] overflow-hidden border border-white/10 bg-slate-900/50">
                <CFDViewer dataset={viewerBuffers} className="min-h-[600px]" />
              </div>
              {demoCfdError && !certifiedCfd.buffers && (
                <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                  Preview CFD indisponible : {demoCfdError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white/5 border-white/10 rounded-3xl p-6">
                  <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Crédibilité</p>
                  <p className="text-3xl font-black text-emerald-400">{dynamicMetrics.credibility.toFixed(1)}%</p>
                </Card>
                <Card className="bg-white/5 border-white/10 rounded-3xl p-6">
                  <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Temps Calcul</p>
                  <p className="text-3xl font-black text-blue-400">{dynamicMetrics.computeTime.toFixed(2)}s</p>
                </Card>
                <Card className="bg-white/5 border-white/10 rounded-3xl p-6">
                  <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Cellules CFD</p>
                  <p className="text-3xl font-black text-cyan-400">{dynamicMetrics.validatedPoints.toLocaleString()}</p>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="hybrid" className="mt-6">
              <HybridSimulationPanel projectId={selectedProject?.id} />
            </TabsContent>

            <TabsContent value="audit" className="mt-6">
              <AdvancedPhysicsVisualization simulationId={selectedAnalysis?.id} time={0} data3d={predictions3d} scenarioType={scenarioType} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
