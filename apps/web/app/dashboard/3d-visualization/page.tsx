'use client'

import { useState, useEffect } from 'react'
import Industrial3DVisualizer from '@/components/industrial-3d-visualizer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

export default function Visualization3DPage() {
  const [predictions, setPredictions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [visualizationType, setVisualizationType] = useState<'trajectories' | 'isosurfaces' | 'crosssections' | 'vectorfield' | 'combined'>('combined')

  // Génération de données de simulation pour la démonstration
  useEffect(() => {
    const generateMockData = () => {
      const data = []
      
      // Trajectoire de flux hélicoïdale
      for (let i = 0; i < 100; i++) {
        const t = i / 100
        const angle = t * Math.PI * 4
        
        data.push({
          x: 0.3 + 0.2 * Math.cos(angle),
          y: 0.2 + 0.3 * t,
          z: 0.3 + 0.2 * Math.sin(angle),
          temperature: 273.15 + 50 * t + Math.sin(angle) * 10,
          pressure: 101325 + 5000 * Math.sin(angle),
          velocity_u: 0.5 * Math.cos(angle),
          velocity_v: 0.3,
          velocity_w: 0.5 * Math.sin(angle),
          velocity_magnitude: Math.sqrt(0.25 * Math.cos(angle)**2 + 0.09 + 0.25 * Math.sin(angle)**2),
          density: 1.0 + 0.1 * Math.sin(angle)
        })
      }
      
      // Points supplémentaires pour les isosurfaces
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 0.8 + 0.1
        const y = Math.random() * 0.8 + 0.1
        const z = Math.random() * 0.8 + 0.1
        
        data.push({
          x, y, z,
          temperature: 273.15 + 50 * Math.sqrt((x-0.5)**2 + (y-0.5)**2 + (z-0.5)**2) * 100,
          pressure: 101325 + 10000 * Math.sin(x * Math.PI) * Math.cos(y * Math.PI),
          velocity_u: 0.5 * Math.sin(x * Math.PI),
          velocity_v: 0.3 * Math.cos(y * Math.PI),
          velocity_w: 0.2 * Math.sin(z * Math.PI),
          velocity_magnitude: 0.5,
          density: 1.0
        })
      }
      
      setPredictions(data)
      setLoading(false)
    }

    generateMockData()
  }, [])

  const stats = predictions.length > 0 ? {
    minTemp: Math.min(...predictions.map(p => p.temperature)),
    maxTemp: Math.max(...predictions.map(p => p.temperature)),
    avgVelocity: predictions.reduce((sum, p) => sum + (p.velocity_magnitude || 0), 0) / predictions.length,
    avgPressure: predictions.reduce((sum, p) => sum + (p.pressure || 0), 0) / predictions.length
  } : { minTemp: 0, maxTemp: 0, avgVelocity: 0, avgPressure: 0 }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-white">Visualisation 3D Industrielle</h1>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">V8.2 ENGINE</Badge>
          </div>
          <p className="text-white/60">Trajectoires, isosurfaces, coupes transversales et champs vectoriels interactifs</p>
        </div>

        {/* Sélecteur de type de visualisation */}
        <Card className="bg-black border-emerald-500/20">
          <CardHeader>
            <CardTitle className="text-emerald-400">Type de Visualisation</CardTitle>
            <CardDescription>Sélectionnez le mode de visualisation 3D</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {(['trajectories', 'isosurfaces', 'crosssections', 'vectorfield', 'combined'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setVisualizationType(type)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    visualizationType === type
                      ? 'bg-emerald-500 text-black'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                >
                  {type === 'trajectories' && '🔀 Trajectoires'}
                  {type === 'isosurfaces' && '🔷 Isosurfaces'}
                  {type === 'crosssections' && '✂️ Coupes'}
                  {type === 'vectorfield' && '➡️ Vecteurs'}
                  {type === 'combined' && '🎯 Combiné'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Visualisation 3D */}
        {!loading && (
          <Industrial3DVisualizer
            predictions={predictions}
            title={`Visualisation 3D - Mode ${visualizationType}`}
            visualizationType={visualizationType}
          />
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-black border-emerald-500/20">
            <CardContent className="pt-6">
              <p className="text-emerald-600/70 text-xs uppercase font-mono">Température Min</p>
              <p className="text-2xl font-black text-emerald-400">{stats.minTemp.toFixed(1)} K</p>
            </CardContent>
          </Card>
          <Card className="bg-black border-emerald-500/20">
            <CardContent className="pt-6">
              <p className="text-emerald-600/70 text-xs uppercase font-mono">Température Max</p>
              <p className="text-2xl font-black text-emerald-400">{stats.maxTemp.toFixed(1)} K</p>
            </CardContent>
          </Card>
          <Card className="bg-black border-emerald-500/20">
            <CardContent className="pt-6">
              <p className="text-emerald-600/70 text-xs uppercase font-mono">Vitesse Moyenne</p>
              <p className="text-2xl font-black text-emerald-400">{stats.avgVelocity.toFixed(3)} m/s</p>
            </CardContent>
          </Card>
          <Card className="bg-black border-emerald-500/20">
            <CardContent className="pt-6">
              <p className="text-emerald-600/70 text-xs uppercase font-mono">Pression Moyenne</p>
              <p className="text-2xl font-black text-emerald-400">{(stats.avgPressure / 1000).toFixed(1)} kPa</p>
            </CardContent>
          </Card>
        </div>

        {/* Informations techniques */}
        <Card className="bg-black border-emerald-500/20">
          <CardHeader>
            <CardTitle className="text-emerald-400">Informations Techniques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-emerald-600/70 font-mono text-xs">Points de données</p>
                <p className="text-white font-bold">{predictions.length}</p>
              </div>
              <div>
                <p className="text-emerald-600/70 font-mono text-xs">Moteur de rendu</p>
                <p className="text-white font-bold">Three.js WebGL</p>
              </div>
              <div>
                <p className="text-emerald-600/70 font-mono text-xs">Résolution</p>
                <p className="text-white font-bold">Haute définition</p>
              </div>
              <div>
                <p className="text-emerald-600/70 font-mono text-xs">Interaction</p>
                <p className="text-white font-bold">Rotation, Zoom, Pan</p>
              </div>
            </div>
            <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <p className="text-emerald-400 text-xs font-mono">
                ✓ Trajectoires 3D avec gradient thermique<br/>
                ✓ Isosurfaces de température/pression<br/>
                ✓ Coupes transversales XY/XZ/YZ<br/>
                ✓ Champs vectoriels de vitesse<br/>
                ✓ Grille et axes de référence
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
