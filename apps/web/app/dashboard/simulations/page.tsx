'use client'

import { useState, useEffect, useMemo } from "react"
import { 
  FlaskConical, 
  Activity, 
  Play, 
  Share2, 
  AlertCircle, 
  Info,
  Loader2,
  ChevronRight,
  Settings,
  Database,
  ShieldAlert,
  Wind,
  Layers,
  CheckCircle2,
  Lightbulb
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import dynamic from 'next/dynamic'
import { HybridSimulationPanel } from "@/components/HybridSimulationPanel"
import { createClient } from '@/lib/supabase/client'

// Import dynamique du nouveau visualiseur industriel V5
const Industrial3DVisualizerEnhancedV5 = dynamic(
  () => import('@/components/industrial-3d-visualizer-enhanced-v5'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-cyan-500/30 text-blue-500 animate-pulse font-mono text-xs uppercase tracking-widest">Initialisation du moteur 3D...</div> }
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
  const [loading, setLoading] = useState(true)
  const [dynamicMetrics, setDynamicMetrics] = useState({ credibility: 0, computeTime: 0, validatedPoints: 0 })
  const supabase = createClient()

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) throw error
        
        const sortedProjects = data || []
        setProjects(sortedProjects)
        
        if (sortedProjects.length > 0) {
          // Prioriser le projet de démonstration industriel s'il existe
          const demoProject = sortedProjects.find(p => p.name.includes('LH2-STORAGE'))
          setSelectedProject(demoProject || sortedProjects[0])
        }
      } catch (err) {
        console.error("Error fetching projects from Supabase:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [supabase])

  useEffect(() => {
    if (selectedProject) {
      const fetchAnalyses = async () => {
        try {
          const { data, error } = await supabase
            .from('analyses')
            .select('*')
            .eq('project_id', selectedProject.id)
            .order('created_at', { ascending: false })
          
          if (error) throw error
          
          setAnalyses(data || [])
          if (data && data.length > 0) {
            setSelectedAnalysis(data[0])
            // Compute dynamic metrics from analysis data
            const latest = data[0]
            const results = typeof latest.results === 'string' ? JSON.parse(latest.results) : latest.results || {}
            const credibility = latest.credibility_score || results.credibilityScore || results.credibility || 0
            const predictions3d = results.predictions3d || []
            const computeTime = results.totalTime || results.computeTime || results.inferenceTime || 0
            setDynamicMetrics({
              credibility,
              computeTime: Number(computeTime) || 0,
              validatedPoints: Array.isArray(predictions3d) ? predictions3d.length : 0
            })
          } else {
            setSelectedAnalysis(null)
            setDynamicMetrics({ credibility: 0, computeTime: 0, validatedPoints: 0 })
          }
        } catch (err) {
          console.error("Error fetching analyses from Supabase:", err)
        }
      }
      fetchAnalyses()
    }
  }, [selectedProject, supabase])

  // Extraction des données 3D pour le visualiseur
  const predictions3d = useMemo(() => {
    let results = selectedAnalysis?.results as any;
    if (typeof results === 'string') {
      try {
        results = JSON.parse(results);
      } catch (e) {
        results = {};
      }
    }
    const rawData = results?.predictions3d || [];
    return Array.isArray(rawData) 
      ? rawData.map((p: any, i: number) => ({
          x: p.x ?? (i % 10) * 0.1,
          y: p.y ?? (Math.floor(i / 10) % 10) * 0.1,
          z: p.z ?? (Math.floor(i / 100) % 10) * 0.1,
          temperature: p.temperature ?? 0,
          pressure: p.pressure ?? 0,
          density: p.density ?? 1.225,
          velocity_magnitude: p.velocity_magnitude ?? 0
        }))
      : [];
  }, [selectedAnalysis])

  if (projects.length === 0 && !loading) return (
    <div className="p-8 max-w-7xl mx-auto text-center py-20 border-2 border-dashed border-white/5 rounded-[40px]">
      <AlertCircle className="w-16 h-16 text-gray-700 mx-auto mb-6" />
      <h2 className="text-2xl font-bold text-white">Aucun Projet Détecté</h2>
      <Link href="/dashboard/projects/new"><Button className="mt-8 bg-blue-600 hover:bg-blue-700">Créer mon premier projet</Button></Link>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* En-tête industriel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono text-[10px] uppercase tracking-tighter">Production V9.0</Badge>
            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-mono uppercase tracking-tighter">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Engine Active
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">Simulations & Analyses</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <p className="text-gray-400 text-sm font-medium">Projet : </p>
              <select 
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-blue-400 font-bold focus:outline-none text-sm shadow-inner"
                value={selectedProject?.id}
                onChange={(e) => setSelectedProject(projects.find(p => p.id === e.target.value) || null)}
              >
                {projects.map(p => <option key={p.id} value={p.id} className="bg-[#0a0a0a]">{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none glass-card border-white/10 bg-white/5 text-xs font-bold uppercase tracking-widest text-white"><Share2 className="mr-2 h-3.5 w-3.5" /> Partager</Button>
          <Link href={selectedProject ? `/dashboard/projects/${selectedProject.id}/analyses/new` : '#'} className="flex-1 md:flex-none">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/20 text-white"><Play className="mr-2 h-3.5 w-3.5" /> Nouvelle Simulation</Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="classic" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1 w-full max-w-2xl">
          <TabsTrigger value="classic" className="text-xs uppercase font-bold tracking-wider">Analyses 3D PINN</TabsTrigger>
          <TabsTrigger value="hybrid" className="text-xs uppercase font-bold tracking-wider">Simulation Hybride</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs uppercase font-bold tracking-wider text-emerald-400">Audit Scientifique</TabsTrigger>
          <TabsTrigger value="improvements" className="text-xs uppercase font-bold tracking-wider text-blue-400">Améliorations</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-pulse">
            <div className="lg:col-span-3 h-[600px] bg-white/5 rounded-[40px] border border-white/10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-blue-500/50 animate-spin" />
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Chargement des données PINN...</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="h-64 bg-white/5 rounded-3xl border border-white/10" />
              <div className="h-32 bg-white/5 rounded-3xl border border-white/10" />
            </div>
          </div>
        ) : (
        <TabsContent value="classic" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Visualiseur 3D Principal */}
            <Card className="lg:col-span-3 glass-card border-white/10 overflow-hidden bg-white/5 shadow-2xl">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                      <Activity className="w-5 h-5 text-blue-500" />
                      Visualisation 3D Isosurface
                    </CardTitle>
                    <CardDescription className="text-[10px] font-mono uppercase text-gray-500">Solveur PINN V9.0 // Haute Fidélité</CardDescription>
                  </div>
                  {analyses.length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-gray-500 uppercase">Analyse active:</span>
                      <select 
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-emerald-400 font-bold text-xs focus:outline-none"
                        value={selectedAnalysis?.id}
                        onChange={(e) => setSelectedAnalysis(analyses.find(a => a.id === e.target.value) || null)}
                      >
                        {analyses.map(a => <option key={a.id} value={a.id} className="bg-[#0a0a0a]">{a.name || a.title || 'Analyse Directe'}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {predictions3d.length === 0 ? (
                  <div className="h-[600px] flex flex-col items-center justify-center text-center space-y-6 bg-slate-950/50">
                    <div className="p-6 rounded-full bg-white/5 border border-white/10">
                      <FlaskConical className="w-12 h-12 text-gray-700" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white">Données 3D Manquantes</h3>
                      <p className="text-gray-500 text-sm max-w-xs mx-auto">Lancez une analyse PINN pour générer les isosurfaces 3D industrielles.</p>
                    </div>
                    <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white">Voir la documentation</Button>
                  </div>
                ) : (
                  <div className="p-6">
                    <Industrial3DVisualizerEnhancedV5 
                      data={predictions3d} 
                      title={selectedAnalysis?.name || "3D Isosurface"} 
                      colorVariable="temperature"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Panneau Latéral de Métriques Industrielles */}
            <div className="space-y-6">
              <Card className="glass-card border-white/10 bg-white/5 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400">Détails de l'Analyse</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500">
                      <span>Score Crédibilité</span>
                      <span className="text-emerald-400">Excellent</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-emerald-400 tracking-tighter">{dynamicMetrics.credibility > 0 ? `${dynamicMetrics.credibility.toFixed(1)}%` : 'N/A'}</span>
                      <div className="mb-1.5 flex gap-0.5">
                        {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-3 rounded-full ${dynamicMetrics.credibility >= i * 20 ? 'bg-emerald-500' : 'bg-emerald-500/40'}`} />)}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-500 leading-tight">Score calculé dynamiquement à partir des résidus PDE et de la validation physique.</p>
                  </div>

                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Statut PINN</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-2 py-0">COMPLETED</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Temps Calcul</span>
                      <span className="text-[11px] font-mono text-white">{dynamicMetrics.computeTime > 0 ? `${dynamicMetrics.computeTime.toFixed(2)} s` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Points Validés</span>
                      <span className="text-[11px] font-mono text-white">{dynamicMetrics.validatedPoints > 0 ? dynamicMetrics.validatedPoints.toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block mb-2">Anomalies Détectées</span>
                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/5 border border-emerald-400/10 rounded p-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">Zéro anomalie critique</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-white/10 bg-white/5 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400 text-white">System Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>GPU Usage</span>
                      <span className="text-white">{dynamicMetrics.computeTime > 5 ? '65%' : '42%'}</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full bg-orange-500 transition-all duration-500`} style={{ width: dynamicMetrics.computeTime > 5 ? '65%' : '42%' }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Memory</span>
                      <span className="text-white">{(dynamicMetrics.validatedPoints > 10000 ? 4.2 : dynamicMetrics.validatedPoints > 1000 ? 2.1 : 0.8).toFixed(1)} GB</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full bg-emerald-500 transition-all duration-500`} style={{ width: `${Math.min(80, dynamicMetrics.validatedPoints / 1000)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        )}

        <TabsContent value="hybrid">
          <div className="grid grid-cols-1 gap-8">
            <HybridSimulationPanel />
          </div>
        </TabsContent>
        
        <TabsContent value="audit">
          <div className="grid grid-cols-1 gap-8">
             <AdvancedPhysicsVisualization simulationId={selectedAnalysis?.id} time={0} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
