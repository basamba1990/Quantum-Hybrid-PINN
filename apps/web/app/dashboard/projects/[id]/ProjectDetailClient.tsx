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
  Activity,
  Cpu
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { extractVisualizationPayload } from '@/lib/visualization-data'

// Imports dynamiques pour optimiser le chargement
const Industrial3DVisualizerEnhancedV11 = dynamic(
  () => import('@/components/industrial-3d-visualizer-enhanced-v11'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-blue-500 animate-pulse">Initializing V11 Enhanced Engine...</div> }
)

const ScientificValidationWorkspace = dynamic(
  () => import('@/components/scientific-validation-workspace'),
  { ssr: false, loading: () => <div className="h-96 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

export default function ProjectDetailClient({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [latestAnalysis, setLatestAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'standard' | 'advanced'>('standard')
  const supabase = createClient()

  const visualizationPayload = useMemo(() => {
    if (!latestAnalysis) return null
    return extractVisualizationPayload(latestAnalysis)
  }, [latestAnalysis])

  const scenarioType = useMemo(() => {
    const cat = project?.category?.toUpperCase() || ''
    const name = project?.name?.toUpperCase() || ''
    
    if (name.includes('HEAVY_DUTY') || name.includes('RAVITAILLEMENT')) return 'HEAVY_DUTY_HYDROGEN_REFUELING'
    if (name.includes('1250') || name.includes('STORAGE')) return 'LH2_LARGE_SCALE_STORAGE_1250M3'
    if (cat === 'MINING' || name.includes('MINING')) return 'DEEP_MINING_BLOCK'
    if (cat === 'ELECTRONICS' || name.includes('FPGA')) return 'FPGA_HEATSINK'
    
    return (latestAnalysis as any)?.scenario_type || 'LH2_STORAGE'
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
          setLatestAnalysis(analysisData)
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
              <Cpu className="w-4 h-4" /> <span>Truly-Operational // Industrial Gold</span>
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
          <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="standard" className="text-xs font-bold uppercase tracking-widest">Scientific Visualizer</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs font-bold uppercase tracking-widest text-emerald-400">G0-G5 Validation</TabsTrigger>
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
          {activeView === 'standard' ? (
            visualizationPayload ? (
              <Industrial3DVisualizerEnhancedV11 
                data={visualizationPayload.points}
                experimentalData={visualizationPayload.experimentalPoints}
                transientSeries={visualizationPayload.transientSeries}
                metadata={visualizationPayload.metadata}
                scenarioType={scenarioType as any}
                title={project.name}
              />
            ) : (
              <div className="h-[600px] flex flex-col items-center justify-center bg-slate-950 rounded-[32px] border border-white/10 text-center p-8 space-y-6">
                <Activity className="w-16 h-16 text-blue-500 animate-pulse" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white uppercase tracking-tighter">En attente d'analyse</h3>
                  <p className="text-gray-400 max-w-md mx-auto">Lancez une nouvelle analyse pour visualiser les résultats physiques en 3D.</p>
                </div>
              </div>
            )
          ) : (
            <ScientificValidationWorkspace 
              analysis={latestAnalysis}
              project={project}
            />
          )}
        </div>
      </div>
    </div>
  )
}
