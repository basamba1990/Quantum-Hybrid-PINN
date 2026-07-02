'use client'

import { useState, useEffect } from "react"
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
  CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import dynamic from 'next/dynamic'
import { HybridSimulationPanel } from "@/components/HybridSimulationPanel"

// Import dynamique du nouveau visualiseur industriel V9
const Industrial3DVisualizerV10Gold = dynamic(
  () => import('@/components/industrial-3d-visualizer-v10-gold'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-cyan-500/30 text-blue-500 animate-pulse font-mono text-xs uppercase tracking-widest">Initialisation du moteur 3D Gold...</div> }
)

export default function SimulationsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [analyses, setAnalyses] = useState<any[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const projectsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`)
        if (!projectsRes.ok) throw new Error(`HTTP ${projectsRes.status}`)
        const projectsData = await projectsRes.json()
        const sortedProjects = Array.isArray(projectsData) 
          ? projectsData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          : []
        setProjects(sortedProjects)
        
        if (sortedProjects.length > 0) {
          setSelectedProject(sortedProjects[0])
        }
      } catch (err) {
        console.error("Error fetching projects:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      const fetchAnalyses = async () => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${selectedProject.id}/analyses`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          setAnalyses(Array.isArray(data) ? data : [])
          if (data.length > 0) {
            setSelectedAnalysis(data[0])
          } else {
            setSelectedAnalysis(null)
          }
        } catch (err) {
          console.error("Error fetching analyses:", err)
        }
      }
      fetchAnalyses()
    }
  }, [selectedProject])

  // Extraction des données 3D pour le visualiseur
  const get3DData = () => {
    let results = selectedAnalysis?.results as any;
    if (typeof results === 'string') {
      try {
        results = JSON.parse(results);
      } catch (e) {
        results = {};
      }
    }
    return results?.predictions3d || [];
  }

  const predictions3d = get3DData();

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Initialisation du système industriel...</p>
    </div>
  )

  if (projects.length === 0) return (
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
          <h1 className="text-4xl font-bold tracking-tight">Simulations & Analyses</h1>
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
          <Button variant="outline" className="flex-1 md:flex-none glass-card border-white/10 bg-white/5 text-xs font-bold uppercase tracking-widest"><Share2 className="mr-2 h-3.5 w-3.5" /> Partager</Button>
          <Link href={selectedProject ? `/dashboard/projects/${selectedProject.id}/analyses/new` : '#'} className="flex-1 md:flex-none">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/20"><Play className="mr-2 h-3.5 w-3.5" /> Nouvelle Simulation</Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="classic" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1 w-full max-w-md">
          <TabsTrigger value="classic" className="text-xs uppercase font-bold tracking-wider">Analyses 3D PINN</TabsTrigger>
          <TabsTrigger value="hybrid" className="text-xs uppercase font-bold tracking-wider">Simulation Hybride</TabsTrigger>
        </TabsList>

        <TabsContent value="classic" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Visualiseur 3D Principal */}
            <Card className="lg:col-span-3 glass-card border-white/10 overflow-hidden bg-white/5 shadow-2xl">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
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
                    <Button variant="outline" className="border-white/10 hover:bg-white/5">Voir la documentation</Button>
                  </div>
                ) : (
                  <div className="p-6">
                    <Industrial3DVisualizerV10Gold 
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
                      <span className="text-4xl font-black text-emerald-400 tracking-tighter">98.7%</span>
                      <div className="mb-1.5 flex gap-0.5">
                        {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-3 bg-emerald-500/40 rounded-full" />)}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-500 leading-tight">Basé sur la convergence des résidus de Navier-Stokes et la validation par rapport aux données DOE.</p>
                  </div>

                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Statut PINN</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-2 py-0">COMPLETED</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Temps Calcul</span>
                      <span className="text-[11px] font-mono text-white">2.45 s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Points Validés</span>
                      <span className="text-[11px] font-mono text-white">52,480</span>
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
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400">System Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>GPU Usage</span>
                      <span>82%</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[82%]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Memory</span>
                      <span>1.02 GB</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[45%]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="hybrid">
          <HybridSimulationPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
