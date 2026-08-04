'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { format } from 'date-fns'
import { 
  ArrowLeft, 
  Activity, 
  Zap, 
  Eye, 
  ShieldCheck, 
  Gauge, 
  Thermometer, 
  Wind,
  Database,
  Cpu,
  LayoutDashboard,
  FlaskConical,
  LineChart,
  Layers,
  LogOut,
  ChevronRight,
  Settings,
  Bell,
  Search,
  Users,
  BarChart3,
  Box
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Imports dynamiques
const Industrial3DVisualizerEnhancedV11 = nextDynamic(
  () => import('@/components/industrial-3d-visualizer-enhanced-v11'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-[32px] border border-white/10 text-blue-500 animate-pulse uppercase font-black italic tracking-widest">Initialisation du Nexus Quantique...</div> }
)

const SweetSpotAnalysisPanel = nextDynamic(
  () => import('@/components/sweet-spot-analysis-panel'),
  { ssr: false, loading: () => <div className="h-48 bg-slate-950 rounded-[32px] border border-white/10 animate-pulse" /> }
)

export default function ProjectDetailClient({ id, project, initialAnalyses }: any) {
  const [analyses, setAnalyses] = useState<any[]>(initialAnalyses || [])
  const [latestAnalysis, setLatestAnalysis] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const results = useMemo(() => {
    if (!latestAnalysis?.results) return null
    try {
      const res = latestAnalysis.results
      return typeof res === 'string' ? JSON.parse(res) : res
    } catch (e) {
      return null
    }
  }, [latestAnalysis])

  const predictions3d = useMemo(() => {
    const data = results?.predictions3d || latestAnalysis?.pinn_predictions || []
    if (!Array.isArray(data)) return []
    return data.slice(0, 3000).map((p: any) => ({
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      z: Number(p.z) || 0,
      temperature: p.temperature,
      pressure: p.pressure,
      velocity_magnitude: p.velocity_magnitude || p.velocity,
      sigma_1: p.sigma_1,
      von_mises: p.von_mises
    }))
  }, [results, latestAnalysis])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const { data: analysesData } = await supabase
          .from('analyses')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })

        if (analysesData) setAnalyses(analysesData)

        const { data: resultData } = await supabase
          .from('analysis_results')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (resultData) setLatestAnalysis(resultData)
        else if (analysesData?.length > 0) setLatestAnalysis(analysesData[0])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchData()
  }, [id, supabase])

  return (
    <div className="flex min-h-screen bg-[#020617] text-white overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-[#020617]/50 backdrop-blur-xl flex flex-col p-6 space-y-8 hidden lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tighter italic uppercase leading-none">QuantumPINN</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Engine Active</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4 px-2">Navigation Système</p>
          <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Tableau de bord" active />
          <NavItem icon={<Activity className="w-4 h-4" />} label="Simulations" />
          <NavItem icon={<Box className="w-4 h-4" />} label="Benchmark 3D" />
          <NavItem icon={<Cpu className="w-4 h-4" />} label="Assistant IA" />
          <NavItem icon={<Database className="w-4 h-4" />} label="Média" />
          <NavItem icon={<Layers className="w-4 h-4" />} label="Projets" />
          <NavItem icon={<Users className="w-4 h-4" />} label="Scientific Social Hub" />
          <NavItem icon={<ShieldCheck className="w-4 h-4" />} label="Audits" />
          <NavItem icon={<Zap className="w-4 h-4" />} label="Améliorations" />
          <NavItem icon={<BarChart3 className="w-4 h-4" />} label="Tarification" />
          <NavItem icon={<Settings className="w-4 h-4" />} label="Paramètres" />
        </nav>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center font-black italic shadow-lg shadow-blue-900/20">B</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-tighter truncate italic">basamba1990</p>
              <p className="text-[9px] text-gray-500 truncate">basamba1990@yahoo.fr</p>
            </div>
          </div>
          <button className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
            <LogOut className="w-3 h-3" /> Déconnexion Système
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-10">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-[9px] font-black uppercase tracking-[0.2em]">
              <ArrowLeft className="w-3 h-3" /> Retour au Nexus
            </Link>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600/10 border border-blue-600/20 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.1)]">
                <FlaskConical className="w-8 h-8 text-blue-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Module PINN V8.0 // ef078935</span>
                  <div className="w-1 h-1 bg-gray-700 rounded-full" />
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Simulation Live</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none mt-1">
                  {project?.name || 'High-Pressure H2 Distribution'}
                </h1>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase italic tracking-tighter transition-all flex items-center gap-3 shadow-2xl shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98]">
              <Zap className="w-5 h-5 fill-white" /> New Analysis
            </button>
          </div>
        </div>

        {/* Project Context & Sweet Spot */}
        <div className="grid grid-cols-1 xl:grid-cols-1 gap-10">
          {/* Main Scientific Panel */}
          <div className="space-y-10">
            {/* Sweet Spot Analysis Panel - The Core Visual */}
            <div className="bg-[#0B1120]/60 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-600/10 transition-colors duration-1000" />
              <SweetSpotAnalysisPanel data={results?.sweet_spot_analysis} loading={loading} />
            </div>

            {/* Scientific Advanced Physics Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Scientific Advanced Physics</h2>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Analyse approfondie des champs physiques et résidus PDE</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">4 250 Points</span>
                </div>
              </div>

              <div className="bg-black border border-white/10 rounded-[40px] overflow-hidden shadow-2xl">
                <Tabs defaultValue="volumetric" className="w-full">
                  <div className="px-8 pt-8 pb-4 border-b border-white/5">
                    <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-2xl h-14">
                      <TabsTrigger value="volumetric" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-white">Vue Volumétrique</TabsTrigger>
                      <TabsTrigger value="thermal" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-white">Profil Thermique</TabsTrigger>
                      <TabsTrigger value="pde" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-white">Résidus PDE</TabsTrigger>
                      <TabsTrigger value="boundary" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-white">Couche Limite</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="volumetric" className="m-0 p-8">
                    <div className="relative rounded-[32px] overflow-hidden bg-slate-950/50 border border-white/5 h-[600px] group">
                      {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                          <Activity className="w-12 h-12 text-blue-500 animate-pulse" />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/50">Initialisation du Nexus Quantique...</p>
                        </div>
                      ) : predictions3d.length > 0 ? (
                        <Industrial3DVisualizerEnhancedV11 
                          data={predictions3d} 
                          title={project?.name || "H2-DISTRIBUTION-V12"}
                          colorVariable="temperature"
                          quality="ultra"
                          scenarioType="H2_DISTRIBUTION_HIGH_PRESSURE"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 text-center p-12">
                          <Activity className="w-20 h-20 text-gray-800" />
                          <div className="space-y-2">
                            <h3 className="text-2xl font-black uppercase italic text-gray-600">Données Manquantes</h3>
                            <p className="text-gray-700 text-sm max-w-sm mx-auto font-medium">Lancez une simulation PINN pour générer les champs physiques à 70 MPa.</p>
                          </div>
                        </div>
                      )}
                      {/* Industrial HUD Overlays */}
                      <div className="absolute top-6 right-6 flex flex-col gap-2 pointer-events-none">
                        <HUDBadge label="GPU ACCEL" value="ACTIVE" color="blue" />
                        <HUDBadge label="PINN RES" value="1.2e-7" color="emerald" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="thermal" className="m-0 p-8">
                    <div className="h-[600px] bg-slate-950/50 rounded-[32px] border border-white/5 p-10 flex items-center justify-center">
                      {/* Placeholder for the thermal graph shown in the user's image */}
                      <div className="w-full h-full relative">
                        <div className="absolute inset-0 border-l border-b border-white/10" />
                        <div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-around px-20">
                          {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="w-px h-[80%] bg-red-500/40 relative">
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                            </div>
                          ))}
                        </div>
                        <div className="absolute top-0 left-0 -translate-x-full pr-4 flex flex-col justify-between h-full text-[8px] font-black text-gray-600 uppercase">
                          <span>298.35 K</span>
                          <span>298.3 K</span>
                          <span>298.25 K</span>
                          <span>298.2 K</span>
                          <span>298.15 K</span>
                        </div>
                        <div className="absolute bottom-0 left-0 translate-y-full pt-4 flex justify-between w-full text-[8px] font-black text-gray-600 uppercase">
                          <span>-0.1</span>
                          <span>-0.05</span>
                          <span>0</span>
                          <span>0.05</span>
                          <span>0.1</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function NavItem({ icon, label, active = false }: any) {
  return (
    <div className={`flex items-center justify-between px-3 py-3 rounded-xl transition-all cursor-pointer group ${
      active ? 'bg-blue-600/10 border border-blue-600/20 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? 'text-blue-500' : 'text-gray-600 group-hover:text-gray-400'}`}>{icon}</div>
        <span className="text-[11px] font-black uppercase italic tracking-tighter">{label}</span>
      </div>
      {active && <div className="w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)]" />}
      {!active && <ChevronRight className="w-3 h-3 text-gray-800 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />}
    </div>
  )
}

function HUDBadge({ label, value, color }: any) {
  const colors: any = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  }
  return (
    <div className={`px-3 py-1.5 border rounded-lg backdrop-blur-md flex items-center gap-3 ${colors[color]}`}>
      <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{label}</span>
      <span className="text-[9px] font-black uppercase tracking-tighter italic">{value}</span>
    </div>
  )
}
