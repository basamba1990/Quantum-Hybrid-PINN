'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { 
  ArrowLeft, Activity, Zap, ShieldCheck, Gauge, Thermometer, Wind, Database, Cpu, LayoutDashboard, FlaskConical, Layers, LogOut, ChevronRight, Settings, Box, Trash2
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const Industrial3DVisualizerEnhancedV11 = nextDynamic(
  () => import('@/components/industrial-3d-visualizer-enhanced-v11'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-[32px] border border-white/10 text-blue-500 animate-pulse font-black uppercase tracking-widest">Nexus Quantique...</div> }
)

const SweetSpotAnalysisPanel = nextDynamic(
  () => import('@/components/sweet-spot-analysis-panel'),
  { ssr: false, loading: () => <div className="h-48 bg-slate-950 rounded-[32px] border border-white/10 animate-pulse" /> }
)

export default function ProjectDetailClient({ id, project }: any) {
  const [latestAnalysis, setLatestAnalysis] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const { data: resultData } = await supabase
          .from('analysis_results')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (resultData) setLatestAnalysis(resultData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchData()
  }, [id, supabase])

  const results = useMemo(() => {
    if (!latestAnalysis?.results) return null
    try {
      return typeof latestAnalysis.results === 'string' ? JSON.parse(latestAnalysis.results) : latestAnalysis.results
    } catch (e) { return null }
  }, [latestAnalysis])

  const predictions3d = useMemo(() => {
    const data = results?.predictions3d || latestAnalysis?.pinn_predictions || []
    return Array.isArray(data) ? data.slice(0, 3000) : []
  }, [results, latestAnalysis])

  const scenarioType = useMemo(() => {
    const identity = `${project?.name || ''} ${project?.description || ''}`.toUpperCase()
    if (identity.includes('LH2') && (identity.includes('INTEGRITY') || identity.includes('INFRASTRUCTURE') || identity.includes('LEAK'))) {
      return 'LH2_INFRASTRUCTURE_INTEGRITY' as const
    }
    return 'H2_DISTRIBUTION_HIGH_PRESSURE' as const
  }, [project])

  const visualizationMetrics = useMemo(() => ({
    credibilityScore: results?.credibilityScore ?? results?.credibility_score ?? latestAnalysis?.credibility_score,
    residuals: results?.residuals || undefined
  }), [results, latestAnalysis])

  const handleDeleteProject = async () => {
    if (!window.confirm(`Supprimer définitivement le projet « ${project?.name || 'sans nom'} » et ses résultats associés ?`)) return
    setDeleting(true)
    try {
      await supabase.from('analysis_results').delete().eq('project_id', id)
      await supabase.from('analyses').delete().eq('project_id', id)
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
      window.location.assign('/dashboard')
    } catch (error) {
      console.error('Project deletion failed:', error)
      window.alert('La suppression a échoué. Vérifiez les permissions Supabase et réessayez.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#020617] text-white">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-[#020617]/50 backdrop-blur-xl flex flex-col p-6 space-y-8 hidden lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-black tracking-tighter italic uppercase leading-none">QuantumPINN</h2>
        </div>
        <nav className="flex-1 space-y-1">
          <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Tableau de bord" active />
          <NavItem icon={<Activity className="w-4 h-4" />} label="Simulations" />
          <NavItem icon={<Box className="w-4 h-4" />} label="Benchmark 3D" />
          <NavItem icon={<Cpu className="w-4 h-4" />} label="Assistant IA" />
          <NavItem icon={<Layers className="w-4 h-4" />} label="Projets" />
          <NavItem icon={<ShieldCheck className="w-4 h-4" />} label="Audits" />
          <NavItem icon={<Settings className="w-4 h-4" />} label="Paramètres" />
        </nav>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-auto">
          <p className="text-xs font-black uppercase tracking-tighter italic">basamba1990</p>
          <button className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white"><LogOut className="w-3 h-3" /> Déconnexion</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white text-[9px] font-black uppercase tracking-[0.2em]"><ArrowLeft className="w-3 h-3" /> Retour</Link>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">{project?.name || 'H2 Distribution'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase italic tracking-tighter shadow-2xl shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98]">
              <Zap className="w-4 h-4 fill-white mr-2 inline" /> New Analysis
            </button>
            <button onClick={handleDeleteProject} disabled={deleting} className="px-5 py-3 bg-red-950/60 hover:bg-red-700 disabled:opacity-50 text-red-200 rounded-2xl border border-red-500/30 font-black uppercase italic tracking-tighter transition-colors" title="Supprimer le projet">
              <Trash2 className="w-4 h-4 mr-2 inline" /> {deleting ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>

        <div className="space-y-10">
          <div className="bg-[#0B1120]/60 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
            <SweetSpotAnalysisPanel data={results?.sweet_spot_analysis} loading={loading} />
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white px-2">Scientific Advanced Physics</h2>
            <div className="bg-black border border-white/10 rounded-[40px] overflow-hidden shadow-2xl">
              <Tabs defaultValue="volumetric" className="w-full">
                <div className="px-8 pt-8 pb-4 border-b border-white/5">
                  <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-2xl h-14">
                    <TabsTrigger value="volumetric" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest">Vue Volumétrique</TabsTrigger>
                    <TabsTrigger value="thermal" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest">Profil Thermique</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="volumetric" className="m-0 p-8">
                  <div className="relative rounded-[32px] overflow-hidden bg-slate-950/50 border border-white/5 min-h-[760px]">
                    <Industrial3DVisualizerEnhancedV11 
                      data={predictions3d} 
                      title={project?.name || "H2-DISTRIBUTION-V12"}
                      colorVariable="temperature"
                      scenarioType={scenarioType}
                      metrics={visualizationMetrics}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="thermal" className="m-0 p-8">
                  <div className="h-[600px] bg-slate-950/50 rounded-[32px] border border-white/5 flex items-center justify-center">
                    <p className="text-gray-500 font-black uppercase italic tracking-widest">Profil Thermique - Analyse NIST</p>
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
