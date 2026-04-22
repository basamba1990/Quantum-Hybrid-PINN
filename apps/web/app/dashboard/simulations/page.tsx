'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Play, Download, Share2, Info, Loader2, AlertCircle, FlaskConical } from 'lucide-react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Project, Analysis } from '@/types'
import Link from 'next/link'

// Plotly must be imported dynamically for Next.js SSR
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

export default function SimulationsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setProjects(data || [])
        if (data && data.length > 0) {
          setSelectedProject(data[0])
        }
      } catch (err) {
        console.error('Error fetching projects:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [supabase])

  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!selectedProject) return
      
      try {
        const { data, error } = await supabase
          .from('analyses')
          .select('*')
          .eq('project_id', selectedProject.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })

        if (error) throw error
        setAnalyses(data || [])
        if (data && data.length > 0) {
          setSelectedAnalysis(data[0])
        } else {
          setSelectedAnalysis(null)
        }
      } catch (err) {
        console.error('Error fetching analyses:', err)
      }
    }

    fetchAnalyses()
  }, [selectedProject, supabase])

  // Process data for Plotly
  const getChartData = () => {
    if (!selectedAnalysis?.results?.predictions3d || selectedAnalysis.results.predictions3d.length === 0) {
      // Fallback/Placeholder if no data
      const x = Array.from({length: 100}, (_, i) => i / 10)
      const pressure = x.map(v => Math.sin(v) * Math.exp(-v/5))
      const velocity = x.map(v => Math.cos(v) * Math.exp(-v/5))
      return { x, pressure, velocity, isPlaceholder: true }
    }

    const predictions = selectedAnalysis.results.predictions3d
    // We'll use index as X-axis or time if available
    const x = predictions.map((_, i) => i)
    const pressure = predictions.map(p => p.pressure)
    const velocity = predictions.map(p => Math.sqrt(p.velocity_u**2 + p.velocity_v**2 + p.velocity_w**2))
    
    return { x, pressure, velocity, isPlaceholder: false }
  }

  const { x, pressure, velocity, isPlaceholder } = getChartData()

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
      <p className="text-gray-500 mt-2 max-w-md mx-auto">Vous devez créer un projet de simulation avant de pouvoir visualiser les analyses PINN.</p>
      <Link href="/dashboard/projects/new">
        <Button className="mt-8 bg-blue-600 hover:bg-blue-700">
          Créer mon premier projet
        </Button>
      </Link>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold">Analyse de Simulation</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <p className="text-gray-400 text-sm">Projet : </p>
              <select 
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-blue-400 font-bold focus:outline-none text-sm"
                value={selectedProject?.id}
                onChange={(e) => setSelectedProject(projects.find(p => p.id === e.target.value) || null)}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#0a0a0a]">{p.name}</option>
                ))}
              </select>
            </div>
            
            {analyses.length > 0 && (
              <div className="flex items-center gap-2">
                <p className="text-gray-400 text-sm">Analyse : </p>
                <select 
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-emerald-400 font-bold focus:outline-none text-sm"
                  value={selectedAnalysis?.id}
                  onChange={(e) => setSelectedAnalysis(analyses.find(a => a.id === e.target.value) || null)}
                >
                  {analyses.map(a => (
                    <option key={a.id} value={a.id} className="bg-[#0a0a0a]">{a.name || a.title || 'Sans titre'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none glass-card border-white/10 bg-white/5">
            <Share2 className="mr-2 h-4 w-4" /> Partager
          </Button>
          <Link href={selectedProject ? `/dashboard/projects/${selectedProject.id}/analyses/new` : '#'} className="flex-1 md:flex-none">
            <Button 
              className="w-full bg-green-600/20 text-green-400 border border-green-500/20 hover:bg-green-600/30"
            >
              <Play className="mr-2 h-4 w-4" />
              Lancer Analyse
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 glass-card border-white/10 overflow-hidden bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Résultats du Solveur Hybride - {selectedAnalysis?.name || selectedProject?.name}</CardTitle>
            {isPlaceholder && (
              <div className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-500 font-mono uppercase">
                Données de Démo
              </div>
            )}
          </CardHeader>
          <CardContent>
            {analyses.length === 0 ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-white/5 rounded-3xl">
                <FlaskConical className="w-12 h-12 text-gray-700" />
                <div className="space-y-1">
                  <p className="text-white font-bold">Aucune analyse terminée</p>
                  <p className="text-gray-500 text-sm max-w-xs">Lancez une analyse scientifique pour visualiser les données réelles du moteur PINN.</p>
                </div>
                <Link href={`/dashboard/projects/${selectedProject?.id}/analyses/new`}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Démarrer l'analyse</Button>
                </Link>
              </div>
            ) : (
              <Tabs defaultValue="pressure" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1">
                  <TabsTrigger value="pressure">Pression</TabsTrigger>
                  <TabsTrigger value="velocity">Vitesse</TabsTrigger>
                  <TabsTrigger value="3d">Vue 3D</TabsTrigger>
                </TabsList>
                <TabsContent value="pressure" className="mt-6 h-[400px] flex items-center justify-center">
                  <Plot
                    data={[{
                      x: x,
                      y: pressure,
                      type: 'scatter',
                      mode: 'lines',
                      line: { color: '#3b82f6', width: 3 },
                      fill: 'tozeroy',
                      fillcolor: 'rgba(59, 130, 246, 0.1)'
                    }]}
                    layout={{
                      autosize: true,
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      margin: { t: 0, r: 0, b: 40, l: 40 },
                      xaxis: { 
                        gridcolor: 'rgba(255,255,255,0.05)', 
                        tickfont: { color: '#94a3b8' },
                        title: { text: 'Points de mesure', font: { size: 10, color: '#475569' } }
                      },
                      yaxis: { 
                        gridcolor: 'rgba(255,255,255,0.05)', 
                        tickfont: { color: '#94a3b8' },
                        title: { text: 'Pression (Pa)', font: { size: 10, color: '#475569' } }
                      },
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </TabsContent>
                <TabsContent value="velocity" className="mt-6 h-[400px]">
                  <Plot
                    data={[{
                      x: x,
                      y: velocity,
                      type: 'scatter',
                      mode: 'lines',
                      line: { color: '#a855f7', width: 3 }
                    }]}
                    layout={{
                      autosize: true,
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      margin: { t: 0, r: 0, b: 40, l: 40 },
                      xaxis: { 
                        gridcolor: 'rgba(255,255,255,0.05)', 
                        tickfont: { color: '#94a3b8' },
                        title: { text: 'Points de mesure', font: { size: 10, color: '#475569' } }
                      },
                      yaxis: { 
                        gridcolor: 'rgba(255,255,255,0.05)', 
                        tickfont: { color: '#94a3b8' },
                        title: { text: 'Vitesse (m/s)', font: { size: 10, color: '#475569' } }
                      },
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                  />
                </TabsContent>
                <TabsContent value="3d" className="mt-6 h-[400px] flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
                      <Activity className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-gray-400 max-w-xs">Le visualiseur 3D interactif nécessite l'activation de l'accélération matérielle WebGL.</p>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="glass-card border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                Détails de l'Analyse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Score Crédibilité</span>
                <span className={`font-mono font-bold ${
                  (selectedAnalysis?.credibility_score || 0) > 80 ? 'text-emerald-400' : 'text-yellow-400'
                }`}>
                  {selectedAnalysis?.credibility_score ? `${selectedAnalysis.credibility_score.toFixed(1)}%` : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Statut PINN</span>
                <span className="font-mono text-blue-400 uppercase text-xs">{selectedAnalysis?.status || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Date</span>
                <span className="font-mono text-xs">
                  {selectedAnalysis ? new Date(selectedAnalysis.created_at).toLocaleString() : '--'}
                </span>
              </div>
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Anomalies Détectées</span>
                <div className="max-h-[100px] overflow-y-auto space-y-1">
                  {selectedAnalysis?.results?.anomalies && selectedAnalysis.results.anomalies.length > 0 ? (
                    selectedAnalysis.results.anomalies.map((anomaly, i) => (
                      <p key={i} className="text-[10px] text-red-400 leading-tight">• {anomaly}</p>
                    ))
                  ) : (
                    <p className="text-[10px] text-emerald-400">Aucune anomalie physique détectée.</p>
                  )}
                </div>
              </div>
              <Link href={`/dashboard/projects/${selectedProject?.id}`} className="block mt-4">
                <Button className="w-full glass-button bg-white/5 hover:bg-white/10">
                  Voir Unité Complète
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-lg">Exportation</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="glass-card border-white/10 text-xs bg-white/5">
                <Download className="mr-2 h-3 w-3" /> CSV
              </Button>
              <Button variant="outline" className="glass-card border-white/10 text-xs bg-white/5">
                <Download className="mr-2 h-3 w-3" /> JSON
              </Button>
              <Button variant="outline" className="glass-card border-white/10 text-xs col-span-2 bg-white/5">
                <Download className="mr-2 h-3 w-3" /> Rapport PDF (GENUP)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
