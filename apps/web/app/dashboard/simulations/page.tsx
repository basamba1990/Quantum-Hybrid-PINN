"use client"

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
  Layers
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import dynamic from 'next/dynamic'
import { HybridSimulationPanel } from "@/components/simulation/hybrid-simulation-panel"

// Import dynamique de Plotly pour éviter les erreurs SSR
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false, loading: () => <div className="w-full h-[400px] bg-white/5 animate-pulse rounded-xl" /> })

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
        const projectsData = await projectsRes.json()
        setProjects(projectsData)
        
        if (projectsData.length > 0) {
          setSelectedProject(projectsData[0])
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
          const data = await res.json()
          setAnalyses(data)
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

  const getChartData = () => {
    // Sécurisation de l'accès aux résultats (peuvent être une chaîne JSON ou un objet)
    let results = selectedAnalysis?.results as any;
    if (typeof results === 'string') {
      try {
        results = JSON.parse(results);
      } catch (e) {
        results = {};
      }
    }

    const predictions = results?.predictions3d || results?.pinn_predictions || [];
    const residuals = results?.residuals || null;
    
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return { 
        x: [], 
        pressure: [], 
        velocity: [], 
        temperature: [], 
        damage: [],
        k: [],
        epsilon: [],
        stress: [],
        residuals, 
        isEmpty: true 
      };
    }

    try {
      const x = predictions.map(p => p?.time || 0);
      const pressure = predictions.map(p => (p?.pressure || 0) / 1e5);
      const temperature = predictions.map(p => p?.temperature || 0);
      const damage = predictions.map(p => p?.damage || 0);
      const k = predictions.map(p => p?.k || 0);
      const epsilon = predictions.map(p => p?.epsilon || 0);
      const stress = predictions.map(p => p?.stress || 0);
      const velocity = predictions.map(p => {
        const u = p?.velocity_u || 0;
        const v = p?.velocity_v || 0;
        const w = p?.velocity_w || 0;
        return Math.sqrt(u**2 + v**2 + w**2);
      });
      return { x, pressure, velocity, temperature, damage, k, epsilon, stress, residuals, isEmpty: false };
    } catch (err) {
      console.error("Error mapping chart data:", err);
      return { 
        x: [], 
        pressure: [], 
        velocity: [], 
        temperature: [], 
        damage: [],
        k: [],
        epsilon: [],
        stress: [],
        residuals, 
        isEmpty: true 
      };
    }
  }
  const { x, pressure, velocity, temperature, damage, k, epsilon, stress, residuals, isEmpty } = getChartData()

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Initialisation du visualiseur...</p>
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
      {/* En-tête avec sélecteur de projet */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold">Simulations & Analyses</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <p className="text-gray-400 text-sm">Projet : </p>
              <select 
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-blue-400 font-bold focus:outline-none text-sm"
                value={selectedProject?.id}
                onChange={(e) => setSelectedProject(projects.find(p => p.id === e.target.value) || null)}
              >
                {projects.map(p => <option key={p.id} value={p.id} className="bg-[#0a0a0a]">{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none glass-card border-white/10 bg-white/5"><Share2 className="mr-2 h-4 w-4" /> Partager</Button>
          <Link href={selectedProject ? `/dashboard/projects/${selectedProject.id}/analyses/new` : '#'} className="flex-1 md:flex-none">
            <Button className="w-full bg-green-600/20 text-green-400 border border-green-500/20 hover:bg-green-600/30"><Play className="mr-2 h-4 w-4" /> Analyse PINN</Button>
          </Link>
        </div>
      </div>

      {/* Onglets : Analyses existantes / Nouvelle simulation hybride */}
      <Tabs defaultValue="classic" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1 w-full max-w-md">
          <TabsTrigger value="classic">Analyses Avancées PINN V8</TabsTrigger>
          <TabsTrigger value="hybrid">Simulation hybride (CFD+ML)</TabsTrigger>
        </TabsList>

        {/* Onglet Analyses existantes */}
        <TabsContent value="classic" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 glass-card border-white/10 overflow-hidden bg-white/5">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Résultats du solveur PINN</CardTitle>
                  {analyses.length > 0 && (
                    <select 
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-emerald-400 font-bold text-xs"
                      value={selectedAnalysis?.id}
                      onChange={(e) => setSelectedAnalysis(analyses.find(a => a.id === e.target.value) || null)}
                    >
                      {analyses.map(a => <option key={a.id} value={a.id}>{a.name || a.title || 'Sans titre'}</option>)}
                    </select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEmpty || !selectedAnalysis ? (
                  <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-white/5 rounded-3xl">
                    <FlaskConical className="w-12 h-12 text-gray-700" />
                    <p className="text-gray-500 text-sm">Aucune donnée. Lancez une analyse PINN.</p>
                  </div>
                ) : (
                  <Tabs defaultValue="pressure" className="w-full">
                    <div className="overflow-x-auto pb-2">
                      <TabsList className="bg-white/5 border border-white/10 p-1 flex w-max">
                        <TabsTrigger value="pressure">Pression</TabsTrigger>
                        <TabsTrigger value="velocity">Vitesse</TabsTrigger>
                        <TabsTrigger value="temperature">Température</TabsTrigger>
                        <TabsTrigger value="damage" className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Endommagement</TabsTrigger>
                        <TabsTrigger value="turbulence" className="flex items-center gap-1"><Wind className="w-3 h-3" /> Turbulence (k,ε)</TabsTrigger>
                        <TabsTrigger value="stress" className="flex items-center gap-1"><Layers className="w-3 h-3" /> Contraintes</TabsTrigger>
                        <TabsTrigger value="residuals">Convergence (Résidus)</TabsTrigger>
                      </TabsList>
                    </div>
                    
                    <TabsContent value="pressure" className="mt-6 h-[400px]">
                      <Plot data={[{ x, y: pressure, type: 'scatter', mode: 'lines+markers', line: { color: '#3b82f6', width: 3 }, fill: 'tozeroy', name: 'Pression (bar)' }]} layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }, yaxis: { title: 'Pression (bar)', gridcolor: 'rgba(255,255,255,0.1)' } }} useResizeHandler style={{ width: '100%', height: '100%' }} />
                    </TabsContent>
                    
                    <TabsContent value="velocity" className="mt-6 h-[400px]">
                      <Plot data={[{ x, y: velocity, type: 'scatter', mode: 'lines+markers', line: { color: '#a855f7', width: 3 }, name: 'Vitesse (m/s)' }]} layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }, yaxis: { title: 'Vitesse (m/s)', gridcolor: 'rgba(255,255,255,0.1)' } }} useResizeHandler style={{ width: '100%', height: '100%' }} />
                    </TabsContent>
                    
                    <TabsContent value="temperature" className="mt-6 h-[400px]">
                      <Plot data={[{ x, y: temperature, type: 'scatter', mode: 'lines+markers', line: { color: '#f59e0b', width: 3 }, fill: 'tozeroy', name: 'Température (K)' }]} layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }, yaxis: { title: 'Température (K)', gridcolor: 'rgba(255,255,255,0.1)' } }} useResizeHandler style={{ width: '100%', height: '100%' }} />
                    </TabsContent>

                    <TabsContent value="damage" className="mt-6 h-[400px]">
                      <Plot data={[{ x, y: damage, type: 'scatter', mode: 'lines+markers', line: { color: '#ef4444', width: 3 }, name: 'Endommagement (%)' }]} layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }, yaxis: { title: 'Indice d\'endommagement', gridcolor: 'rgba(255,255,255,0.1)' } }} useResizeHandler style={{ width: '100%', height: '100%' }} />
                    </TabsContent>

                    <TabsContent value="turbulence" className="mt-6 h-[400px]">
                      <Plot 
                        data={[
                          { x, y: k, type: 'scatter', mode: 'lines', name: 'Énergie Cinétique (k)', line: { color: '#10b981' } },
                          { x, y: epsilon, type: 'scatter', mode: 'lines', name: 'Dissipation (ε)', line: { color: '#ec4899' } }
                        ]} 
                        layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }, yaxis: { title: 'Valeurs de Turbulence', gridcolor: 'rgba(255,255,255,0.1)', type: 'log' } }} 
                        useResizeHandler style={{ width: '100%', height: '100%' }} 
                      />
                    </TabsContent>

                    <TabsContent value="stress" className="mt-6 h-[400px]">
                      <Plot data={[{ x, y: stress, type: 'scatter', mode: 'lines+markers', line: { color: '#6366f1', width: 3 }, name: 'Contraintes (Pa)' }]} layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }, yaxis: { title: 'Contraintes de Von Mises (Pa)', gridcolor: 'rgba(255,255,255,0.1)' } }} useResizeHandler style={{ width: '100%', height: '100%' }} />
                    </TabsContent>
                    
                    <TabsContent value="residuals" className="mt-6 h-[400px]">
                      {residuals ? (
                        <Plot 
                          data={[
                            { x, y: residuals.continuity || residuals.continuity_residual, type: 'scatter' as const, mode: 'lines', name: 'Masse', line: { color: '#ef4444' } },
                            { x, y: residuals.momentum || residuals.momentum_x || residuals.momentum_residual, type: 'scatter' as const, mode: 'lines', name: 'Momentum', line: { color: '#3b82f6' } },
                            { x, y: residuals.energy || residuals.energy_residual, type: 'scatter' as const, mode: 'lines', name: 'Énergie', line: { color: '#10b981' } },
                            { x, y: residuals.k, type: 'scatter' as const, mode: 'lines', name: 'k', line: { color: '#f59e0b' } },
                            { x, y: residuals.epsilon, type: 'scatter' as const, mode: 'lines', name: 'epsilon', line: { color: '#ec4899' } }
                          ].filter(d => d.y !== undefined) as any} 
                          layout={{ 
                            autosize: true, 
                            paper_bgcolor: 'rgba(0,0,0,0)', 
                            plot_bgcolor: 'rgba(0,0,0,0)', 
                            font: { color: '#fff' },
                            yaxis: { type: 'log', title: 'Résidus (Log)', gridcolor: 'rgba(255,255,255,0.1)' },
                            xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }
                          }} 
                          useResizeHandler 
                          style={{ width: '100%', height: '100%' }} 
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 italic">Données de résidus non disponibles pour cette analyse.</div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
            <div className="space-y-8">
              <Card className="glass-card border-white/10 bg-white/5">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-blue-400" /> Détails de l'Analyse</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-gray-400">Score Crédibilité</span><span className={`font-mono font-bold ${(selectedAnalysis?.credibility_score || 0) > 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>{selectedAnalysis?.credibility_score ? `${selectedAnalysis.credibility_score.toFixed(1)}%` : '--'}</span></div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-gray-400">Statut PINN</span><span className="font-mono text-blue-400 uppercase text-xs">{selectedAnalysis?.status || 'N/A'}</span></div>
                  <div className="space-y-2 pt-2"><span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Anomalies</span><div className="max-h-[100px] overflow-y-auto space-y-1">{selectedAnalysis?.results?.anomalies?.map((a: any, i: number) => <p key={i} className="text-[10px] text-red-400 leading-tight">• {a}</p>) || <p className="text-[10px] text-emerald-400">Aucune anomalie.</p>}</div></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Onglet Simulation hybride (CFD+ML) */}
        <TabsContent value="hybrid" className="space-y-8">
          <HybridSimulationPanel projectId={selectedProject?.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
