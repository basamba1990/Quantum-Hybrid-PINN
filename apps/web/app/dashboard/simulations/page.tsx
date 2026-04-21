'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Play, Download, Share2, Info, Loader2, AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Project } from '@/types'
import Link from 'next/link'

// Plotly must be imported dynamically for Next.js SSR
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

export default function SimulationsPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
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

  // Sample data for PINN results (In a real app, this would come from the database/API)
  const x = Array.from({length: 100}, (_, i) => i / 10)
  const pressure = x.map(v => Math.sin(v) * Math.exp(-v/5))
  const velocity = x.map(v => Math.cos(v) * Math.exp(-v/5))

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
          <div className="flex items-center gap-2 mt-2">
            <p className="text-gray-400">Visualisation pour : </p>
            <select 
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-blue-400 font-bold focus:outline-none"
              value={selectedProject?.id}
              onChange={(e) => setSelectedProject(projects.find(p => p.id === e.target.value) || null)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-[#0a0a0a]">{p.name}</option>
              ))}
            </select>
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
          <CardHeader>
            <CardTitle>Résultats du Solveur Hybride - {selectedProject?.name}</CardTitle>
          </CardHeader>
          <CardContent>
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
                    xaxis: { gridcolor: 'rgba(255,255,255,0.1)', tickfont: { color: '#94a3b8' } },
                    yaxis: { gridcolor: 'rgba(255,255,255,0.1)', tickfont: { color: '#94a3b8' } },
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
                    xaxis: { gridcolor: 'rgba(255,255,255,0.1)', tickfont: { color: '#94a3b8' } },
                    yaxis: { gridcolor: 'rgba(255,255,255,0.1)', tickfont: { color: '#94a3b8' } },
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%' }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="glass-card border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                Détails du Projet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Statut</span>
                <span className="font-mono text-blue-400 uppercase text-xs">{selectedProject?.status}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Date Init</span>
                <span className="font-mono">{selectedProject ? new Date(selectedProject.created_at).toLocaleDateString() : '--'}</span>
              </div>
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Description</span>
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-4">
                  {selectedProject?.description || "Aucune description fournie."}
                </p>
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
