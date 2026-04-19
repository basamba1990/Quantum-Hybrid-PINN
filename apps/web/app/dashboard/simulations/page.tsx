'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Play, Download, Share2, Info } from 'lucide-react'
import dynamic from 'next/dynamic'

// Plotly must be imported dynamically for Next.js SSR
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

export default function SimulationsPage() {
  const [isRunning, setIsRunning] = useState(false)

  // Sample data for PINN results
  const x = Array.from({length: 100}, (_, i) => i / 10)
  const pressure = x.map(v => Math.sin(v) * Math.exp(-v/5))
  const velocity = x.map(v => Math.cos(v) * Math.exp(-v/5))

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Analyse de Simulation</h1>
          <p className="text-gray-400 mt-2">Visualisation des données physiques du modèle PINN</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="glass-card border-white/10">
            <Share2 className="mr-2 h-4 w-4" /> Partager
          </Button>
          <Button 
            onClick={() => setIsRunning(!isRunning)}
            className={`glass-button ${isRunning ? 'bg-red-500/20 text-red-400 border-red-500/20' : 'bg-green-500/20 text-green-400 border-green-500/20'}`}
          >
            <Play className={`mr-2 h-4 w-4 ${isRunning ? 'animate-pulse' : ''}`} />
            {isRunning ? 'Arrêter' : 'Lancer Simulation'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Charts */}
        <Card className="lg:col-span-2 glass-card border-white/10 overflow-hidden">
          <CardHeader>
            <CardTitle>Résultats du Solveur Hybride</CardTitle>
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

        {/* Sidebar Info */}
        <div className="space-y-8">
          <Card className="glass-card border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                Paramètres PINN
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Epochs</span>
                <span className="font-mono">5000</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Learning Rate</span>
                <span className="font-mono">0.001</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Optimizer</span>
                <span className="font-mono text-primary">Adam + L-BFGS</span>
              </div>
              <Button className="w-full glass-button mt-4">
                Modifier Paramètres
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10">
            <CardHeader>
              <CardTitle className="text-lg">Exportation</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="glass-card border-white/10 text-xs">
                <Download className="mr-2 h-3 w-3" /> CSV
              </Button>
              <Button variant="outline" className="glass-card border-white/10 text-xs">
                <Download className="mr-2 h-3 w-3" /> JSON
              </Button>
              <Button variant="outline" className="glass-card border-white/10 text-xs col-span-2">
                <Download className="mr-2 h-3 w-3" /> Rapport PDF (GENUP)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
