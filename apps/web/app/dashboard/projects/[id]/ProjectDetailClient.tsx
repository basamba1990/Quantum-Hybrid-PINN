'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project, Report } from '@/types'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { 
  ArrowLeft, 
  FileText, 
  BarChart3, 
  Activity,
  Cpu,
  ChevronRight,
  FlaskConical,
  Clock,
  Eye
} from 'lucide-react'

// Imports dynamiques pour optimiser le chargement
const Industrial3DVisualizerAdvanced = dynamic(
  () => import('@/components/industrial-3d-visualizer-v9-production'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-blue-500 animate-pulse">Initializing 3D Engine...</div> }
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

export default function ProjectDetailClientV2({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const results = useMemo(() => {
    try {
      if (!latestAnalysis?.results) return {}
      let parsedResults = latestAnalysis.results
      if (typeof parsedResults === 'string') parsedResults = JSON.parse(parsedResults)
      return parsedResults || {}
    } catch (e) {
      return {}
    }
  }, [latestAnalysis])

  const predictions3d = useMemo(() => {
    return Array.isArray(results?.predictions3d) ? results.predictions3d : []
  }, [results])

  const scenarioType = useMemo(() => {
    return latestAnalysis?.scenario_type || 'H2_PIPELINE'
  }, [latestAnalysis])

  const metricsData = useMemo(() => ({
    pressure: results?.pressure || 101.3,
    temperature: results?.temperature || 293.15,
    density: results?.density || 1.225,
    internalEnergy: results?.internalEnergy || 0.0,
    enthalpy: results?.enthalpy || 0.0,
    velocityMagnitude: results?.velocity_magnitude || 0.0,
    machNumber: results?.mach_number || 0.0,
    reynoldsNumber: results?.reynolds_number || 1e5,
    vorticity: results?.vorticity || 0.0,
    turbulentIntensity: results?.turbulent_intensity || 0.0,
    convergence: results?.convergence || 85,
  }), [results])

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
          } catch (e) { processed.results = {} }
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
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
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
            <Link href={`/dashboard/projects/${id}/analyses/new`} className="w-full px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 inline-flex">
              <Activity className="w-5 h-5" /> New Analysis
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/dashboard/projects/${id}/analyses`} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 inline-flex">
                <BarChart3 className="w-4 h-4" /> Analyses
              </Link>
              <Link href={`/dashboard/projects/${id}/reports`} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 inline-flex">
                <FileText className="w-4 h-4" /> Reports
              </Link>
            </div>
          </div>
        </div>
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
          {/* 3D Visualizer with LOD and Color Bars */}
          {predictions3d.length > 0 && (
            <Industrial3DVisualizerAdvanced 
              data={predictions3d} 
              title="3D Isosurface Visualization"
              colorVariable="temperature"
              maxPointsDisplay={100000}
            />
          )}

          {/* Scenario-Specific Metrics Panel */}
          <ScenarioMetricsPanel 
            scenarioType={scenarioType}
            data={results}
          />

          {/* PINN Performance Monitor */}
          <PINNPerformanceMonitor isLive={true} />

          {/* Residuals Chart */}
          <ResidualsChart />
        </div>
      </div>

      {/* PDF Preview */}
      {selectedReport && (
        <div className="bg-white/[0.03] border border-white/10 rounded-[32px] p-8">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-500" /> Document Preview
          </h2>
          <div className="bg-black/30 rounded-2xl overflow-hidden h-[600px]">
            <iframe src={selectedReport.file_url} className="w-full h-full border-none" />
          </div>
        </div>
      )}
    </div>
  )
}


