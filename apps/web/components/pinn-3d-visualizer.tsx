'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Prediction3D } from '@/types'
import XPBDVisualizer from './xpbd-visualizer'

const Plot = dynamic(() => import('react-plotly.js').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-50 animate-pulse rounded-lg text-slate-400 text-xs">
      Initialisation du moteur 3D...
    </div>
  ),
})

interface PINN3DVisualizerProps {
  predictions: Prediction3D[]
  title?: string
}

export default function PINN3DVisualizer({
  predictions,
  title = 'Visualisation 3D PINN V8',
}: PINN3DVisualizerProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('pressure')
  const [forceUpdate, setForceUpdate] = useState(0)
  const plotRefs = useRef<Record<string, any>>({})

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    setTimeout(() => {
      setForceUpdate(prev => prev + 1)
      if (plotRefs.current[newTab]) {
        try {
          window.Plotly?.Plots?.resize(plotRefs.current[newTab])
        } catch (e) {
          console.warn('Plotly resize failed:', e)
        }
      }
    }, 100)
  }

  const chartData = useMemo(() => {
    if (!isMounted || !predictions || !Array.isArray(predictions) || predictions.length === 0) return null;
    
    try {
      // Filtrer les points invalides (ex: coordonnées 0.5 si non pertinentes)
      const validPoints = predictions.filter(p => p !== null && typeof p === 'object');
      
      if (validPoints.length === 0) return null;

      const x = validPoints.map((p) => p.x ?? 0)
      const y = validPoints.map((p) => p.y ?? 0)
      const z = validPoints.map((p) => p.z ?? 0)
      const u = validPoints.map((p) => p.velocity_u ?? 0)
      const v = validPoints.map((p) => p.velocity_v ?? 0)
      const w = validPoints.map((p) => p.velocity_w ?? 0)

      return {
        x, y, z,
        pressure: validPoints.map((p) => {
          const rawP = p.pressure ?? 0;
                // ✅ CORRECTION : Si c'est déjà en bar (ex: 120), on garde. Si c'est en Pa (ex: 1.2e7), on convertit.
                return rawP > 1000 ? rawP / 1e5 : rawP;
        }),
        temperature: validPoints.map((p) => {
                const rawT = p.temperature ?? 0;
                // ✅ CORRECTION V8.3 : Gestion intelligente de la température
                // Si rawT < 100K, c'est de l'hydrogène liquide cryogénique (afficher tel quel)
                // Si rawT >= 100K, c'est déjà converti ou en ambiant (afficher tel quel)
                // Si rawT === 0, utiliser la température standard (288.15 K)
                if (rawT === 0) return 288.15;
                if (rawT < 100) return rawT; // Hydrogène liquide cryogénique (20-30 K)
                return rawT; // Température convertie ou ambiance
        }),
        density: validPoints.map((p) => p.density ?? 1.0),
        u, v, w,
        velocityMagnitude: validPoints.map(
          (p) => Math.sqrt((p.velocity_u || 0) ** 2 + (p.velocity_v || 0) ** 2 + (p.velocity_w || 0) ** 2)
        ),
      }
    } catch (err) {
      console.error("Error parsing 3D data:", err);
      return null;
    }
  }, [isMounted, predictions])

  const baseLayout = useMemo(
    () => ({
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 40 },
      scene: {
        xaxis: { title: 'X (m)', range: [-6, 6] },
        yaxis: { title: 'Y (m)', range: [-6, 6] },
        zaxis: { title: 'Z (m)', range: [-6, 6] },
        aspectmode: 'cube' as const,
      },
      title: { text: `${title} – Pression`, x: 0.5, xanchor: 'center' as const },
    }),
    [title]
  )

  const hoverText = useMemo(
    () => {
      try {
        return predictions.map(
          (p, i) => {
            const rawP = p?.pressure ?? 0;
            const displayP = rawP > 1000 ? rawP / 1e5 : rawP;
            const rawT = p?.temperature || 288.15;
            const displayT = rawT < 100 ? `${rawT.toFixed(1)} K (cryo)` : `${rawT.toFixed(1)} K`;
            return `t=${p?.time?.toFixed(2) || '0.00'}s<br>P=${displayP.toFixed(2)} bar<br>T=${displayT}<br>ρ=${(p?.density || 0).toFixed(4)} kg/m³<br>|V|=${Math.sqrt((p?.velocity_u || 0) ** 2 + (p?.velocity_v || 0) ** 2 + (p?.velocity_w || 0) ** 2).toFixed(3)} m/s`;
          }
        )
      } catch (e) {
        console.error("Error generating hover text:", e);
        return [];
      }
    },
    [predictions]
  )

  const velocityHoverText = useMemo(
    () => {
      try {
        return predictions.map(
          (p, i) => `t=${p?.time?.toFixed(2) || '0.00'}s<br>u=${(p?.velocity_u || 0).toFixed(3)} m/s<br>v=${(p?.velocity_v || 0).toFixed(3)} m/s<br>w=${(p?.velocity_w || 0).toFixed(3)} m/s<br>|V|=${Math.sqrt((p?.velocity_u || 0) ** 2 + (p?.velocity_v || 0) ** 2 + (p?.velocity_w || 0) ** 2).toFixed(3)} m/s`
        )
      } catch (e) {
        console.error("Error generating velocity hover text:", e);
        return [];
      }
    },
    [predictions]
  )

  const temperatureHoverText = useMemo(
    () => {
      try {
        return predictions.map(
          (p, i) => {
            const rawP = p?.pressure ?? 0;
            const displayP = rawP > 1000 ? rawP / 1e5 : rawP;
            const rawT = p?.temperature || 288.15;
            const displayT = rawT < 100 ? `${rawT.toFixed(1)} K (cryo)` : `${rawT.toFixed(1)} K`;
            return `t=${p?.time?.toFixed(2) || '0.00'}s<br>T=${displayT}<br>P=${displayP.toFixed(2)} bar`;
          }
        )
      } catch (e) {
        console.error("Error generating temperature hover text:", e);
        return [];
      }
    },
    [predictions]
  )

  if (!isMounted || !predictions || predictions.length === 0 || !chartData) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center bg-slate-50 rounded-lg text-slate-400 border border-dashed">
        En attente des données de prédiction...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Intégration du moteur XPBD de Fable 5 pour la visualisation interactive haute performance */}
      <XPBDVisualizer predictions={predictions} title={title} />

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">{title} - Données Détaillées</h3>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pressure">Pression</TabsTrigger>
            <TabsTrigger value="velocity">Vitesse</TabsTrigger>
            <TabsTrigger value="temperature">Température</TabsTrigger>
          </TabsList>

          <TabsContent value="pressure" className="h-[500px] w-full">
            <div className="w-full h-full" ref={(el) => { if (el) plotRefs.current['pressure'] = el }}>
              <Plot
                key={`pressure-${forceUpdate}`}
                data={[{
                  type: 'scatter3d',
                  mode: 'markers',
                  x: chartData.x,
                  y: chartData.y,
                  z: chartData.z,
                  marker: {
                    size: 6,
                    color: chartData.pressure,
                    colorscale: 'Viridis',
                    colorbar: { title: { text: 'Pression (bar)', font: { size: 12 } }, thickness: 15, len: 0.7, x: 1.1 },
                    opacity: 0.85,
                    line: { width: 0.5, color: 'rgba(0,0,0,0.2)' },
                  },
                  text: hoverText,
                  hoverinfo: 'text',
                  hovertemplate: '%{text}<extra></extra>',
                }]}
                layout={{ ...baseLayout, title: { ...baseLayout.title, text: `${title} – Pression` } }}
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="velocity" className="h-[500px] w-full">
            <div className="w-full h-full" ref={(el) => { if (el) plotRefs.current['velocity'] = el }}>
              <Plot
                key={`velocity-${forceUpdate}`}
                data={[{
                  type: 'cone',
                  x: chartData.x,
                  y: chartData.y,
                  z: chartData.z,
                  u: chartData.u,
                  v: chartData.v,
                  w: chartData.w,
                  colorscale: 'Portland',
                  sizemode: 'scaled',
                  sizeref: 2,
                  colorbar: { title: { text: 'Vitesse (m/s)', font: { size: 12 } }, thickness: 15, len: 0.7 },
                  text: velocityHoverText,
                  hoverinfo: 'text',
                  hovertemplate: '%{text}<extra></extra>',
                } as any]}
                layout={{ ...baseLayout, title: { ...baseLayout.title, text: `${title} – Vecteurs de Vitesse` } }}
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="temperature" className="h-[500px] w-full">
            <div className="w-full h-full" ref={(el) => { if (el) plotRefs.current['temperature'] = el }}>
              <Plot
                key={`temperature-${forceUpdate}`}
                data={[{
                  type: 'scatter3d',
                  mode: 'markers',
                  x: chartData.x,
                  y: chartData.y,
                  z: chartData.z,
                  marker: {
                    size: 6,
                    color: chartData.temperature,
                    colorscale: 'Hot',
                    colorbar: { title: { text: 'Température (K)', font: { size: 12 } }, thickness: 15, len: 0.7, x: 1.1 },
                    opacity: 0.85,
                    line: { width: 0.5, color: 'rgba(0,0,0,0.2)' },
                  },
                  text: temperatureHoverText,
                  hoverinfo: 'text',
                  hovertemplate: '%{text}<extra></extra>',
                }]}
                layout={{ ...baseLayout, title: { ...baseLayout.title, text: `${title} – Température` } }}
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
