'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Play, Download, Share2, Info, Loader2, AlertCircle, FlaskConical, Sparkles } from 'lucide-react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Project, Analysis } from '@/types'
import Link from 'next/link'
import { HybridSimulationPanel } from '@/components/HybridSimulationPanel'
import { HybridResultsVisualization } from '@/components/HybridResultsVisualization'

// Chargement dynamique de Plotly
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

// Interface pour les résultats hybrides (à adapter selon votre API)
interface HybridResultsData {
  jobId: string;
  totalTime: number;
  cfdTime: number;
  mlTime: number;
  totalSteps: number;
  cfdSteps: number;
  mlSteps: number;
  residuals: Array<{ step: number; continuity: number; momentum: number; energy: number }>;
  fieldComparisons: Array<{ field: string; cfdValue: number; mlValue: number; difference: number; percentError: number }>;
  accelerationFactor: number;
}

export default function SimulationsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [hybridResults, setHybridResults] = useState<HybridResultsData | null>(null)
  const supabase = createClient()

  // Chargement des projets
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

  // Chargement des analyses pour le projet sélectionné
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

  // Callback lorsqu'un job hybride est sélectionné/mis à jour
  const handleHybridJobSelected = (job: any) => {
    if (!job || !job.results) {
      setHybridResults(null);
      return;
    }

    // Cas 1: Structure imbriquée avec .metrics (format attendu initialement)
    if (job.results.metrics) {
      const transformed: HybridResultsData = {
        jobId: job.jobId || job.id,
        totalTime: job.results.metrics.total_execution_time || 0,
        cfdTime: job.results.metrics.cfd_execution_time || 0,
        mlTime: job.results.metrics.ml_execution_time || 0,
        totalSteps: job.results.metrics.total_steps || 0,
        cfdSteps: job.results.metrics.cfd_steps || 0,
        mlSteps: job.results.metrics.ml_steps || 0,
        residuals: job.results.metrics.residual_history || [],
        fieldComparisons: job.results.metrics.field_comparisons || [],
        accelerationFactor: job.results.metrics.acceleration_factor || 1,
      }
      setHybridResults(transformed)
    } 
    // Cas 2: Structure plate (format par défaut de l'orchestrateur et de la migration)
    else if (job.results.iteration !== undefined) {
      const transformed: HybridResultsData = {
        jobId: job.jobId || job.id,
        totalTime: (job.results.cfdTime || 0) + (job.results.mlTime || 0),
        cfdTime: job.results.cfdTime || 0,
        mlTime: job.results.mlTime || 0,
        totalSteps: job.results.iteration || 0,
        cfdSteps: Math.floor((job.results.iteration || 0) * 0.4), // Estimation si non fourni
        mlSteps: Math.ceil((job.results.iteration || 0) * 0.6),   // Estimation si non fourni
        residuals: job.results.residuals ? [job.results.residuals] : [],
        fieldComparisons: [],
        accelerationFactor: job.results.credibilityScore ? (job.results.credibilityScore / 100) + 1 : 1,
      }
      setHybridResults(transformed)
    }
    else {
      setHybridResults(null)
    }
  }

  // Données pour les graphiques Plotly (analyses existantes)
  const getChartData = () => {
    const predictions = selectedAnalysis?.results?.predictions3d || []
    const physicalMetrics = (selectedAnalysis?.results as any)?.physicalMetrics || null
    
    if (predictions.length === 0) return { x: [], pressure: [], velocity: [], residuals: null, isEmpty: true }
    
    const x = predictions.map(p => p.time)
    const pressure = predictions.map(p => p.pressure / 1e5)
    const velocity = predictions.map(p => Math.sqrt(p.velocity_u**2 + p.velocity_v**2 + p.velocity_w**2))
    
    // Extraction des résidus réels pour le graphique industriel
    const residuals = physicalMetrics?.residual_history || null
    
    return { x, pressure, velocity, residuals, isEmpty: false }
  }
  const { x, pressure, velocity, residuals, isEmpty } = getChartData()

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
          <TabsTrigger value="classic">Analyses classiques</TabsTrigger>
          <TabsTrigger value="hybrid">Simulation hybride (CFD+ML)</TabsTrigger>
        </TabsList>

        {/* Onglet Analyses existantes (votre ancienne vue) */}
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
                    <TabsList className="bg-white/5 border border-white/10 p-1">
                      <TabsTrigger value="pressure">Pression</TabsTrigger>
                      <TabsTrigger value="velocity">Vitesse</TabsTrigger>
                      <TabsTrigger value="residuals">Convergence (Résidus)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pressure" className="mt-6 h-[400px]">
                      <Plot data={[{ x, y: pressure, type: 'scatter', mode: 'lines+markers', line: { color: '#3b82f6', width: 3 }, fill: 'tozeroy', name: 'Pression (bar)' }]} layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }, yaxis: { title: 'Pression (bar)', gridcolor: 'rgba(255,255,255,0.1)' } }} useResizeHandler style={{ width: '100%', height: '100%' }} />
                    </TabsContent>
                    <TabsContent value="velocity" className="mt-6 h-[400px]">
                      <Plot data={[{ x, y: velocity, type: 'scatter', mode: 'lines+markers', line: { color: '#a855f7', width: 3 }, name: 'Vitesse (m/s)' }]} layout={{ autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, xaxis: { title: 'Temps (s)', gridcolor: 'rgba(255,255,255,0.1)' }, yaxis: { title: 'Vitesse (m/s)', gridcolor: 'rgba(255,255,255,0.1)' } }} useResizeHandler style={{ width: '100%', height: '100%' }} />
                    </TabsContent>
                    <TabsContent value="residuals" className="mt-6 h-[400px]">
                      {residuals ? (
                        <Plot 
                          data={[
                            { x, y: residuals.continuity, type: 'scatter', mode: 'lines', name: 'Masse', line: { color: '#ef4444' } },
                            { x, y: residuals.momentum, type: 'scatter', mode: 'lines', name: 'Momentum', line: { color: '#3b82f6' } },
                            { x, y: residuals.energy, type: 'scatter', mode: 'lines', name: 'Énergie', line: { color: '#10b981' } }
                          ]} 
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
                  <div className="space-y-2 pt-2"><span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Anomalies</span><div className="max-h-[100px] overflow-y-auto space-y-1">{selectedAnalysis?.results?.anomalies?.map((a, i) => <p key={i} className="text-[10px] text-red-400 leading-tight">• {a}</p>) || <p className="text-[10px] text-emerald-400">Aucune anomalie.</p>}</div></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Onglet Simulation hybride (CFD+ML) */}
        <TabsContent value="hybrid" className="space-y-8">
          <HybridSimulationPanel 
            projectId={selectedProject?.id} 
            onJobSelected={handleHybridJobSelected} 
          />
          {hybridResults && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Sparkles className="text-yellow-400" /> Résultats de la simulation hybride</h2>
              <HybridResultsVisualization results={hybridResults} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
