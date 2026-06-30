'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project, Report } from '@/types'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { 
  ArrowLeft, 
  FileText, 
  BarChart3, 
  Settings2, 
  Eye, 
  Activity,
  Cpu,
  Database,
  ChevronRight,
  FlaskConical,
  Clock
} from 'lucide-react'

// Import dynamique pour éviter le blocage au chargement
import dynamic from 'next/dynamic'

const Industrial3DVisualizer = dynamic(
  () => import('@/components/industrial-3d-visualizer-industrial-grade'),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-blue-500 animate-pulse">Initialisation du Moteur Graphique...</div> }
)

export default function ProjectDetailClient({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const results = useMemo(() => {
    try {
      if (!latestAnalysis?.results) return {};
      let parsedResults = latestAnalysis.results;
      if (typeof parsedResults === 'string') parsedResults = JSON.parse(parsedResults);
      return parsedResults || {};
    } catch (e) {
      return {};
    }
  }, [latestAnalysis]);

  const predictions3d = useMemo(() => {
    return Array.isArray(results?.predictions3d) ? results.predictions3d : [];
  }, [results]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) return;
        
        const { data: projectData } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
        setProject(projectData)

        const { data: reportsData } = await supabase.from('reports').select('*').eq('project_id', id).order('created_at', { ascending: false })
        setReports(reportsData || [])
        
        const { data: analysisData } = await supabase.from('analyses').select('*').eq('project_id', id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle();
        
        if (analysisData) {
          let processed = { ...analysisData };
          try {
            if (typeof processed.results === 'string') processed.results = JSON.parse(processed.results);
          } catch (e) { processed.results = {}; }
          setLatestAnalysis(processed);
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
      <p className="text-xs font-mono text-blue-500 uppercase tracking-widest animate-pulse">Chargement du Module...</p>
    </div>
  )

  if (!project) return (
    <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center">
      <Activity className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-white">Projet Introuvable</h2>
      <Link href="/dashboard" className="mt-6 text-blue-500 hover:underline flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Retour au Nexus
      </Link>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Retour au Nexus
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
            <Link href={`/dashboard/projects/${id}/analyses/new`} className="w-full">
              <button className="w-full px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <Activity className="w-5 h-5" /> Nouvelle Analyse
              </button>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/dashboard/projects/${id}/analyses`} className="flex-1">
                <button className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Analyses
                </button>
              </Link>
              <Link href={`/dashboard/projects/${id}/reports`} className="flex-1">
                <button className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> Rapports
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Visualiseur 3D */}
      {predictions3d.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-[32px] p-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" /> Visualisation Scientifique 3D
          </h2>
          <Industrial3DVisualizer data={predictions3d} />
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" /> Archives PDF
          </h2>
          <div className="space-y-3">
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

        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-500" /> Aperçu Scientifique
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 min-h-[400px] flex items-center justify-center">
            {selectedReport ? (
              <iframe src={selectedReport.file_url} className="w-full h-[600px] rounded-2xl border-none" />
            ) : (
              <p className="text-gray-500">Sélectionnez un rapport pour l'aperçu.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
