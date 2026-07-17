
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project, Report, Analysis } from '@/types'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { 
  ArrowLeft, 
  FileText, 
  BarChart3, 
  Activity,
  Cpu,
  Eye
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Imports dynamiques pour optimiser le chargement
const Industrial3DVisualizerV10Ultra = dynamic(
  () => import('@/components/industrial-3d-visualizer-v10-ultra'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-blue-500 animate-pulse">Initializing V10 Ultra Engine...</div> }
)

const HybridChartVisualizerExport = dynamic(
  () => import('@/components/hybrid-chart-visualizer-export'),
  { ssr: false, loading: () => <div className="h-96 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

const PINNPerformanceMonitor = dynamic(
  () => import('@/components/pinn-performance-monitor'),
  { ssr: false, loading: () => <div className="h-96 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

const ScenarioMetricsPanel = dynamic(
  () => import('@/components/scenario-metrics-panel'),
  { ssr: false, loading: () => <div className="h-64 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

const ResidualsChart = dynamic(
  () => import('@/components/residuals-chart'),
  { ssr: false, loading: () => <div className="h-96 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

const Industrial3DVisualizerExport = dynamic(
  () => import('@/components/industrial-3d-visualizer-export'),
  { ssr: false, loading: () => <div className="h-12 bg-slate-950 rounded-xl border border-white/10 animate-pulse" /> }
)

const AdvancedPhysicsVisualization = dynamic(
  () => import('@/components/AdvancedPhysicsVisualization'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-emerald-500 animate-pulse">Chargement de l'analyse physique avancée...</div> }
)

const Streamline3DVisualizer = dynamic(
  () => import('@/components/streamline-3d-visualizer'),
  { ssr: false, loading: () => <div className="h-[600px] bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

const ScientificProfileChart = dynamic(
  () => import('@/components/scientific-profile-chart'),
  { ssr: false, loading: () => <div className="h-96 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

const ScientificSocialHub = dynamic(
  () => import('@/components/scientific-social-hub'),
  { ssr: false, loading: () => <div className="h-96 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

const DualPhysicsVisualizer = dynamic(
  () => import('@/components/dual-physics-visualizer'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-cyan-500 animate-pulse">Initializing Dual Physics Comparison...</div> }
)

const ResidualsReliabilityHeatmap = dynamic(
  () => import('@/components/residuals-reliability-heatmap'),
  { ssr: false, loading: () => <div className="h-96 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

const RealtimeParameterControls = dynamic(
  () => import('@/components/realtime-parameter-controls'),
  { ssr: false, loading: () => <div className="h-96 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

export default function ProjectDetailClient({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [latestAnalysis, setLatestAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'standard' | 'advanced' | 'comparative' | 'reliability' | 'interactive'>('standard')
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const supabase = createClient()

  const results = useMemo(() => {
    try {
      if (!latestAnalysis?.results) return {} as any
      let parsedResults = latestAnalysis.results
      if (typeof parsedResults === 'string') parsedResults = JSON.parse(parsedResults)
      return (parsedResults || {}) as any
    } catch (e) {
      console.error('Error parsing results:', e)
      return {} as any
    }
  }, [latestAnalysis])

  const predictions3d = useMemo(() => {
    if (!Array.isArray(results?.predictions3d)) return []
    
    return (results.predictions3d as any[]).filter(p => {
      return typeof p.x === 'number' && 
             typeof p.y === 'number' && 
             typeof p.z === 'number'
    }).map(p => ({
      x: p.x,
      y: p.y,
      z: p.z,
      temperature: typeof p.temperature === 'number' ? p.temperature : 293.15,
      pressure: typeof p.pressure === 'number' ? p.pressure : 1.0,
      density: typeof p.density === 'number' ? p.density : undefined,
      velocity_magnitude: typeof p.velocity_magnitude === 'number' ? p.velocity_magnitude : undefined,
      velocity_u: typeof p.velocity_u === 'number' ? p.velocity_u : undefined,
      velocity_v: typeof p.velocity_v === 'number' ? p.velocity_v : undefined,
      velocity_w: typeof p.velocity_w === 'number' ? p.velocity_w : undefined,
      stress: typeof p.stress === 'number' ? p.stress : undefined,
      damage: typeof p.damage === 'number' ? p.damage : undefined
    }))
  }, [results])

  const scenarioType = useMemo(() => {
    const desc = project?.description?.toLowerCase() || '';
    const name = project?.name?.toLowerCase() || '';
    
    let type = (latestAnalysis as any)?.scenario_type || 
               (project?.category === 'Mining' ? 'ROCK_ELAST_STRESS' : 
               (desc.includes('rock') ? 'ROCK_ELAST_STRESS' : 
               (name.includes('heatsink') || desc.includes('heatsink') ? 'FPGA_HEATSINK' : 
               (name.includes('lh2') || desc.includes('lh2') ? 'LH2_STORAGE' : 'H2_PIPELINE'))));
    return type as 'H2_PIPELINE' | 'LH2_STORAGE' | 'PORT_ENERGY_OPTIMIZATION' | 'PIPELINE_SAFETY' | 'CRYOGENIC_TRANSPORT' | 'MINING_INDUSTRIAL_SIM' | 'ROCK_ELAST_STRESS' | 'H2_COMPRESSION_STATION' | 'FPGA_HEATSINK'
  }, [latestAnalysis, project])

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) return

        const { data: projectData } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
        setProject(projectData)

        const { data: reportsData } = await supabase.from('reports').select('*').eq('project_id', id).order('created_at', { ascending: false })
        setReports(reportsData || [])

        const { data: analysisData } = await supabase.from('analyses').select('*').eq('project_id', id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle()

        if (analysisData) {
          let processed = { ...analysisData }
          try {
            if (typeof processed.results === 'string') processed.results = JSON.parse(processed.results)
          } catch (e) { 
            console.error('Error parsing analysis results:', e)
            processed.results = {} 
          }
          setLatestAnalysis(processed)
        }

        if (reportsData?.length) setSelectedReport(reportsData[0])
      } catch (err) {
        console.error("Fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, supabase])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
      <div className="h-12 w-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
      <p className="text-xs font-mono text-blue-500 uppercase tracking-widest animate-pulse">Loading Module...</p>
    </div>
  )

  if (!project) return (
    <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center">
      <Activity className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-white">Project Not Found</h2>
      <Link href="/dashboard" className="mt-6 text-blue-500 hover:underline flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
    </div>
  )

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono text-blue-400 uppercase tracking-widest">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" /> Simulation Live
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white/[0.03] border border-white/10 rounded-[32px] p-10 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3 text-emerald-500 font-mono text-[10px] uppercase tracking-widest">
              <Cpu className="w-4 h-4" /> <span>Module PINN V8.0 // {id.slice(0, 8)}</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white">{project.name}</h1>
            <p className="text-gray-400 text-lg leading-relaxed">{project.description}</p>
          </div>

          <div className="flex flex-col gap-3 min-w-[240px]">
            <Link href={`/dashboard/projects/${id}/analyses/new`} className="w-full px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              <Activity className="w-5 h-5" /> New Analysis
            </Link>
          </div>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex justify-center overflow-x-auto">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="standard" className="text-xs font-bold uppercase tracking-widest">Standard</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs font-bold uppercase tracking-widest text-emerald-400">Advanced</TabsTrigger>
            <TabsTrigger value="comparative" className="text-xs font-bold uppercase tracking-widest text-cyan-400">Comparative</TabsTrigger>
            <TabsTrigger value="reliability" className="text-xs font-bold uppercase tracking-widest text-orange-400">Reliability</TabsTrigger>
            <TabsTrigger value="interactive" className="text-xs font-bold uppercase tracking-widest text-purple-400">Interactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Left Sidebar - Reports */}
        <div className="xl:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" /> Archives
          </h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`p-4 border rounded-2xl cursor-pointer transition-all ${selectedReport?.id === report.id ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/5 border-white/10 hover:border-blue-500/30'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${selectedReport?.id === report.id ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-400'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{report.name}</p>
                    <p className="text-[10px] font-mono text-gray-500 uppercase mt-1">{report.created_at ? format(new Date(report.created_at), 'dd.MM.yyyy HH:mm') : ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center - 3D Visualizer & Metrics */}
        <div className="xl:col-span-3 space-y-8">
          {!latestAnalysis ? (
            <div className="h-[600px] flex flex-col items-center justify-center bg-slate-950 rounded-[32px] border border-white/10 text-center p-8 space-y-6">
              <Activity className="w-16 h-16 text-blue-500 animate-pulse" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">En attente d'analyse</h3>
                <p className="text-gray-400 max-w-md mx-auto">Lancez une nouvelle analyse pour visualiser les résultats physiques en 3D.</p>
              </div>
            </div>
          ) : activeView === 'comparative' ? (
            <div className="space-y-6">
              <DualPhysicsVisualizer 
                data={predictions3d}
                title="DUAL PHYSICS COMPARISON - THERMAL VS DYNAMIC"
                quality="ultra"
              />
            </div>
          ) : activeView === 'reliability' ? (
            <div className="space-y-6">
              <ResidualsReliabilityHeatmap 
                data={predictions3d}
                title="RESIDUALS RELIABILITY ANALYSIS"
              />
            </div>
          ) : activeView === 'interactive' ? (
            <div className="space-y-6">
              <RealtimeParameterControls
                isRunning={isSimulationRunning}
                onToggleSimulation={setIsSimulationRunning}
                onParametersChange={(params) => {
                  console.log('Parameters updated:', params)
                }}
                onReset={() => {
                  console.log('Simulation reset')
                }}
              />
            </div>
          ) : activeView === 'advanced' ? (
            <div className="space-y-6">
              <AdvancedPhysicsVisualization 
                simulationId={latestAnalysis.id} 
                time={results?.totalTime || 0} 
              />
            </div>
          ) : (
            <div className="space-y-4">
              <Industrial3DVisualizerV10Ultra 
                data={predictions3d} 
                title="TRULY-INDUSTRIAL V10-GOLD"
                colorVariable={scenarioType === 'ROCK_ELAST_STRESS' ? 'prediction' : 'temperature'}
                quality="ultra"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
