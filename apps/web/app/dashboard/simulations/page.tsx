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
        if (data && data.length > 0) setSelectedProject(data[0])
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
        if (data && data.length > 0) setSelectedAnalysis(data[0])
        else setSelectedAnalysis(null)
      } catch (err) {
        console.error('Error fetching analyses:', err)
      }
    }
    fetchAnalyses()
  }, [selectedProject, supabase])

  const getChartData = () => {
    const predictions = selectedAnalysis?.results?.predictions3d || []
    if (predictions.length === 0) return { x: [], pressure: [], velocity: [], isEmpty: true }
    
    const x = predictions.map(p => p.time)
    // Convertir Pa en bar pour affichage lisible
    const pressure = predictions.map(p => p.pressure / 1e5)
    const velocity = predictions.map(p => Math.sqrt(p.velocity_u**2 + p.velocity_v**2 + p.velocity_w**2))
    return { x, pressure, velocity, isEmpty: false }
  }

  const { x, pressure, velocity, isEmpty } = getChartData()

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
                {projects.map(p => <option key={p.id} value={p.id} className="bg-[#0a0a0a]">{p.name}</option>)}
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
                  {analyses.map(a => <option key={a.id} value={a.id} className="bg-[#0a0a0a]">{a.name || a.title || 'Sans titre'}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none glass-card border-white/10 bg-white/5"><Share2 className="mr-2 h-4 w-4" /> Partager</Button>
          <Link href={selectedProject ? `/dashboard/projects/${selectedProject.id}/analyses/new` : '#'} className="flex-1 md:flex-none">
            <Button className="w-full bg-green-600/20 text-green-400 border border-green-500/20 hover:bg-green-600/30"><Play className="mr-2 h-4 w-4" /> Lancer Analyse</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 glass-card border-white/10 overflow-hidden bg-white/5">
          <CardHeader><CardTitle>Résultats du Solveur Hybride - {selectedAnalysis?.name || selectedProject?.name}</CardTitle></CardHeader>
          <CardContent>
            {isEmpty ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-white/5 rounded-3xl">
                <FlaskConical className="w-12 h-12 text-gray-700" />
                <div className="space-y-1">
                  <p className="text-white font-bold">Données Indisponibles</p>
                  <p className="text-gray-500 text-sm max-w-xs">Aucune donnée de prédiction trouvée pour cette analyse. Veuillez lancer une nouvelle simulation.</p>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="pressure" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1">
                  <TabsTrigger value="pressure">Pression</TabsTrigger>
                  <TabsTrigger value="velocity">Vitesse</TabsTrigger>
                </TabsList>
                <TabsContent value="pressure" className="mt-6 h-[400px]">
                  <Plot
                    data={[{ x, y: pressure, type: 'scatter', mode: 'lines+markers', line: { color: '#3b82f6', width: 3, shape: 'spline' }, marker: { size: 6, color: '#3b82f6' }, fill: 'tozeroy', fillcolor: 'rgba(59, 130, 246, 0.1)' }]}
                    layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { t: 20, r: 20, b: 40, l: 60 }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } }, yaxis: { title: 'Pression (bar)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } } }}
                    useResizeHandler={true} style={{ width: '100%', height: '100%' }} config={{ displayModeBar: false }}
                  />
                </TabsContent>
                <TabsContent value="velocity" className="mt-6 h-[400px]">
                  <Plot
                    data={[{ x, y: velocity, type: 'scatter', mode: 'lines+markers', line: { color: '#a855f7', width: 3, shape: 'spline' }, marker: { size: 6, color: '#a855f7' } }]}
                    layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { t: 20, r: 20, b: 40, l: 60 }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } }, yaxis: { title: 'Vitesse (m/s)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } } }}
                    useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                  />
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
              <div className="space-y-2 pt-2"><span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Anomalies</span><div className="max-h-[100px] overflow-y-auto space-y-1">{selectedAnalysis?.results?.anomalies?.map((a, i) => <p key={i} className="text-[10px] text-red-400 leading-tight">• {a}</p>) || <p className="text-[10px] text-emerald-400">Aucune anomalie.</p>}</div></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
