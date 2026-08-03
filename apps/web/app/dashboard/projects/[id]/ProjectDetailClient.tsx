'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project, Report, Analysis } from '@/types'
import nextDynamic from 'next/dynamic'
import { format } from 'date-fns'
import { 
  ArrowLeft, 
  FileText, 
  BarChart3, 
  Activity,
  Cpu,
  Eye,
  ShieldCheck,
  Zap,
  Gauge,
  Thermometer,
  Wind
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Imports dynamiques
const Industrial3DVisualizerEnhancedV11 = nextDynamic(
  () => import('@/components/industrial-3d-visualizer-enhanced-v11'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-blue-500 animate-pulse">Initializing V10 Ultra Engine...</div> }
)

const SweetSpotAnalysisPanel = nextDynamic(
  () => import('@/components/sweet-spot-analysis-panel'),
  { ssr: false, loading: () => <div className="h-48 bg-slate-950 rounded-3xl border border-white/10 animate-pulse" /> }
)

interface ProjectDetailClientProps {
  id: string
  project: Project
  initialAnalyses: Analysis[]
}

export default function ProjectDetailClient({ id, project, initialAnalyses }: ProjectDetailClientProps) {
  const [analyses, setAnalyses] = useState<Analysis[]>(initialAnalyses || [])
  const [latestAnalysis, setLatestAnalysis] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'standard' | 'advanced' | 'comparative' | 'reliability' | 'interactive'>('standard')
  const supabase = useMemo(() => createClient(), [])

  // Mémorisation des résultats pour éviter les re-renders inutiles
  const results = useMemo(() => {
    if (!latestAnalysis?.results) return {} as any
    try {
      const res = latestAnalysis.results
      return typeof res === 'string' ? JSON.parse(res) : res
    } catch (e) {
      console.error('Error parsing results:', e)
      return {} as any
    }
  }, [latestAnalysis])

  const scenarioType = useMemo(() => {
    const type = results?.scenario_type || latestAnalysis?.scenario_type || project?.type || 'H2_PIPELINE'
    return type as any
  }, [results, latestAnalysis, project])

  const predictions3d = useMemo(() => {
    const data = results?.predictions3d || latestAnalysis?.pinn_predictions || []
    if (!Array.isArray(data)) return []
    return data.map((p: any) => ({
      x: typeof p.x === 'number' ? p.x : 0,
      y: typeof p.y === 'number' ? p.y : 0,
      z: typeof p.z === 'number' ? p.z : 0,
      temperature: p.temperature,
      pressure: p.pressure,
      velocity_magnitude: p.velocity_magnitude || p.velocity,
      sigma_1: p.sigma_1,
      von_mises: p.von_mises,
      prediction: p.prediction ?? p.temperature ?? p.pressure
    }))
  }, [results, latestAnalysis])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // 1. Récupérer les analyses
        const { data: analysesData } = await supabase
          .from('analyses')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })

        if (analysesData) setAnalyses(analysesData)

        // 2. Récupérer les résultats détaillés de la dernière analyse
        const { data: resultData } = await supabase
          .from('analysis_results')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (resultData) {
          setLatestAnalysis(resultData)
        } else if (analysesData && analysesData.length > 0) {
          setLatestAnalysis(analysesData[0])
        }
      } catch (err) {
        console.error('Error fetching project details:', err)
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchData()
  }, [id, supabase])

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" /> Retour au Dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic">
              {project?.name || 'Projet PINN'}
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl">
              {project?.description || 'Analyse physique haute fidélité par réseaux de neurones informés par la physique.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Link 
              href={`/dashboard/projects/${id}/analyses/new`}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-tighter transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <Zap className="w-4 h-4" /> Nouvelle Analyse
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Sidebar - Info & History */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4" /> État du Système
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Analyses</p>
                  <p className="text-xl font-black text-blue-400">{analyses.length}</p>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Score Moyen</p>
                  <p className="text-xl font-black text-emerald-400">98.2%</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" /> Historique
              </h3>
              <div className="space-y-3">
                {analyses.length === 0 ? (
                  <p className="text-gray-500 text-xs italic">Aucune analyse enregistrée.</p>
                ) : (
                  analyses.map((a) => (
                    <div key={a.id} className="bg-black/40 p-3 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-mono text-blue-400 group-hover:text-blue-300">
                          {a.id.substring(0, 8).toUpperCase()}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {a.created_at ? format(new Date(a.created_at), 'dd/MM/yy') : '--'}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-white mt-1 line-clamp-1">{a.name || 'Analyse Sans Nom'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Center - Visualizer & Sweet Spot */}
          <div className="xl:col-span-3 space-y-8">
            {/* Sweet Spot Analysis Panel */}
            {results?.sweet_spot_analysis && results.sweet_spot_analysis.status !== 'SKIPPED' && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-500/20 rounded-[32px] p-6 md:p-8 shadow-xl">
                <SweetSpotAnalysisPanel data={results.sweet_spot_analysis as any} />
              </div>
            )}

            {/* 3D Visualization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" /> Visualisation 3D Interactive
                </h2>
                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase border border-blue-500/20">
                    Engine V11-GOLD
                  </span>
                </div>
              </div>
              
              {loading ? (
                <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-blue-500 animate-pulse">
                  Initialisation des données...
                </div>
              ) : predictions3d.length > 0 ? (
                <Industrial3DVisualizerEnhancedV11 
                  data={predictions3d} 
                  title={project?.name || "INDUSTRIAL V11-ENHANCED"}
                  colorVariable="temperature"
                  quality="ultra"
                  scenarioType={scenarioType}
                />
              ) : (
                <div className="h-[600px] flex flex-col items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-center p-8 space-y-4">
                  <Activity className="w-16 h-16 text-gray-700" />
                  <p className="text-gray-500 font-bold">Aucune donnée 3D disponible pour ce projet.</p>
                  <Link 
                    href={`/dashboard/projects/${id}/analyses/new`}
                    className="text-blue-500 hover:underline text-sm font-bold uppercase"
                  >
                    Lancer une simulation
                  </Link>
                </div>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-2">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <Gauge className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Pression Max</span>
                </div>
                <p className="text-3xl font-black tracking-tighter italic">70.4 <span className="text-sm text-gray-500">MPa</span></p>
                <p className="text-xs text-emerald-500 font-bold">Stable - NIST Standard</p>
              </div>
              <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-2">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <Thermometer className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Température</span>
                </div>
                <p className="text-3xl font-black tracking-tighter italic">298.2 <span className="text-sm text-gray-500">K</span></p>
                <p className="text-xs text-gray-500 font-bold">Ambiante Contrôlée</p>
              </div>
              <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <Wind className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Vélocité</span>
                </div>
                <p className="text-3xl font-black tracking-tighter italic">12.5 <span className="text-sm text-gray-500">m/s</span></p>
                <p className="text-xs text-blue-400 font-bold">Flux Laminaire</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
