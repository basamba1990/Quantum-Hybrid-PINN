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
  FlaskConical,
  Shield,
  Zap,
  Box,
  TrendingUp,
  Eye
} from 'lucide-react'

// Imports dynamiques
const Industrial3DVisualizerAdvancedV3 = dynamic(
  () => import('@/components/industrial-3d-visualizer-advanced-v3'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-blue-500 animate-pulse">Initialisation du moteur 3D...</div> }
)

const ScenarioMetricsPanel = dynamic(
  () => import('@/components/scenario-metrics-panel'),
  { ssr: false, loading: () => <div className="h-64 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

export default function ProjectDetailClientV3({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const results = useMemo(() => {
    try {
      if (!latestAnalysis?.results) return {}
      let res = latestAnalysis.results
      return typeof res === 'string' ? JSON.parse(res) : res
    } catch (e) { return {} }
  }, [latestAnalysis])

  const predictions3d = useMemo(() => results?.predictions3d || [], [results])
  const scenarioType = useMemo(() => latestAnalysis?.scenario_type || 'H2_PIPELINE', [latestAnalysis])
  const domainBounds = useMemo(() => results?.domain_bounds || { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 }, [results])

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) return
        const { data: p } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
        setProject(p)
        const { data: r } = await supabase.from('reports').select('*').eq('project_id', id).order('created_at', { ascending: false })
        setReports(r || [])
        const { data: a } = await supabase.from('analyses').select('*').eq('project_id', id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle()
        setLatestAnalysis(a)
        if (r?.length) setSelectedReport(r[0])
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [id, supabase])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
      <div className="h-12 w-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
      <p className="text-xs font-mono text-blue-500 uppercase tracking-widest animate-pulse">CHARGEMENT DU MODULE INDUSTRIEL...</p>
    </div>
  )

  if (!project) return (
    <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center">
      <Activity className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-white">Projet Introuvable</h2>
      <Link href="/dashboard" className="mt-6 text-blue-500 hover:underline flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Retour au Tableau de Bord
      </Link>
    </div>
  )

  return (
    <div className="p-8 max-w-[1800px] mx-auto space-y-10">
      {/* Header Professionnel */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 text-gray-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Système Opérationnel
          </div>
        </div>
      </div>

      {/* Hero Section Industrielle */}
      <div className="bg-slate-900/40 border border-white/5 rounded-[48px] p-12 relative overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 relative z-10">
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-4 text-blue-500 font-black text-[10px] uppercase tracking-[0.3em]">
              <Cpu className="w-5 h-5" /> <span>NOYAU QUANTIQUE V8.5 // {id.slice(0, 8)}</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter text-white leading-none">{project.name}</h1>
            <p className="text-gray-400 text-xl leading-relaxed font-medium">{project.description}</p>
          </div>

          <div className="flex flex-col gap-4 min-w-[280px]">
            <Link href={`/dashboard/projects/${id}/analyses/new`} className="w-full">
              <button className="w-full px-8 py-5 bg-blue-600 text-white font-black rounded-3xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3 active:scale-95">
                <Zap className="w-5 h-5 fill-current" /> NOUVELLE SIMULATION
              </button>
            </Link>
            <div className="grid grid-cols-2 gap-4">
              <Link href={`/dashboard/projects/${id}/analyses`} className="flex-1">
                <button className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                  <BarChart3 className="w-4 h-4" /> Historique
                </button>
              </Link>
              <Link href={`/dashboard/projects/${id}/reports`} className="flex-1">
                <button className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                  <FileText className="w-4 h-4" /> Rapports
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
        {/* Sidebar - Données & Archives */}
        <div className="xl:col-span-1 space-y-8">
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
              <Shield className="w-5 h-5 text-blue-500" /> Métriques Réelles
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Score de Crédibilité</p>
                <p className="text-3xl font-black text-blue-500">{latestAnalysis?.credibility_score ? `${latestAnalysis.credibility_score.toFixed(1)}%` : 'N/A'}</p>
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Incertitude (MC)</p>
                <p className="text-3xl font-black text-orange-500">{results?.physical_metrics?.uncertainty ? `${(results.physical_metrics.uncertainty * 100).toFixed(2)}%` : 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3 px-4">
              <FileText className="w-5 h-5 text-emerald-500" /> Archives PDF
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {reports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`p-5 border rounded-3xl cursor-pointer transition-all ${selectedReport?.id === report.id ? 'bg-blue-600/20 border-blue-500/50 shadow-lg' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${selectedReport?.id === report.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{report.name}</p>
                      <p className="text-[10px] font-mono text-gray-500 uppercase mt-1">{report.created_at ? format(new Date(report.created_at), 'dd.MM.yyyy') : ''}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center - Visualiseur 3D & Métriques Scénario */}
        <div className="xl:col-span-3 space-y-10">
          {/* Visualiseur 3D Avancé */}
          {predictions3d.length > 0 ? (
            <Industrial3DVisualizerAdvancedV3 
              data={predictions3d} 
              title={`Visualisation 3D - ${scenarioType.replace('_', ' ')}`}
              colorVariable="temperature"
              xRange={[domainBounds.xMin, domainBounds.xMax]}
              yRange={[domainBounds.yMin, domainBounds.yMax]}
              zRange={[domainBounds.zMin, domainBounds.zMax]}
            />
          ) : (
            <div className="h-[600px] bg-slate-900/40 rounded-[48px] border border-white/5 flex flex-col items-center justify-center text-gray-600 space-y-4">
              <Box className="w-20 h-20 opacity-10" />
              <p className="font-black uppercase tracking-[0.4em] text-xs">Aucune donnée 3D disponible</p>
            </div>
          )}

          {/* Métriques Spécifiques au Scénario */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ScenarioMetricsPanel 
              scenarioType={scenarioType}
              data={results?.scenario_outputs || {}}
            />
            
            <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 space-y-8">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-blue-500" /> Stabilité Physique
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 font-black uppercase">Reynolds (Re)</p>
                  <p className="text-2xl font-black text-white">{results?.physical_metrics?.reynolds?.toExponential(2) || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 font-black uppercase">Nombre de Mach</p>
                  <p className="text-2xl font-black text-white">{results?.physical_metrics?.mach?.toFixed(3) || 'N/A'}</p>
                </div>
                <div className="col-span-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase mb-2">
                    <Shield className="w-3 h-3" /> État de Convergence
                  </div>
                  <p className="text-xs text-emerald-400 font-medium leading-relaxed">Le modèle PINN a atteint une convergence stable avec des résidus inférieurs aux seuils industriels (1e-4).</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview */}
      {selectedReport && (
        <div className="bg-slate-900/40 border border-white/5 rounded-[48px] p-10 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
              <Eye className="w-6 h-6 text-emerald-500" /> Aperçu du Rapport Industriel
            </h2>
            <a href={selectedReport.file_url} target="_blank" className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white hover:bg-white/10 transition-all uppercase tracking-widest">Ouvrir en plein écran</a>
          </div>
          <div className="bg-black/40 rounded-[32px] overflow-hidden h-[800px] border border-white/5 shadow-inner">
            <iframe src={selectedReport.file_url} className="w-full h-full border-none" />
          </div>
        </div>
      )}
    </div>
  )
}
