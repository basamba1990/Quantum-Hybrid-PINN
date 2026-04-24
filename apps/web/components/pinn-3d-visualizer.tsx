'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Prediction3D } from '@/types'

// Dynamically import Plotly to avoid SSR issues
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

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || !predictions || predictions.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center bg-slate-50 rounded-lg text-slate-400 border border-dashed">
        En attente des données de prédiction...
      </div>
    )
  }

  // Memoized data transformation to avoid recalculation on every render
  const chartData = useMemo(() => {
    const isPointSeries = new Set(predictions.map((p) => `${p.x},${p.y},${p.z}`)).size === 1

    const x = predictions.map((p, i) => (isPointSeries ? p.x + i * 0.001 : p.x))
    const y = predictions.map((p, i) => (isPointSeries ? p.y + Math.sin(i * 0.1) * 0.001 : p.y))
    const z = predictions.map((p, i) => (isPointSeries ? p.z + Math.cos(i * 0.1) * 0.001 : p.z))

    // Velocity components with proper scaling for visualization
    const u = predictions.map((p) => p.velocity_u * 10)
    const v = predictions.map((p) => p.velocity_v * 10)
    const w = predictions.map((p) => p.velocity_w * 10)

    return {
      x,
      y,
      z,
      pressure: predictions.map((p) => p.pressure),
      temperature: predictions.map((p) => p.temperature),
      density: predictions.map((p) => p.density),
      u,
      v,
      w,
      velocityMagnitude: predictions.map(
        (p) => Math.sqrt(p.velocity_u ** 2 + p.velocity_v ** 2 + p.velocity_w ** 2) * 10
      ),
    }
  }, [predictions])

  // Memoized base layout configuration
  const baseLayout = useMemo(
    () => ({
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 40 },
      scene: {
        xaxis: { title: 'X (m)' },
        yaxis: { title: 'Y (m)' },
        zaxis: { title: 'Z (m)' },
      },
      title: { text: `${title} – Pression`, x: 0.5, xanchor: 'center' as const },
    }),
    [title]
  )

  // Memoized hover text for predictions
  const hoverText = useMemo(
    () =>
      predictions.map(
        (p, i) =>
          `t=${p.time.toFixed(2)}s<br>P=${p.pressure.toExponential(2)} Pa<br>T=${p.temperature.toFixed(1)} K<br>ρ=${p.density.toFixed(4)} kg/m³<br>|V|=${Math.sqrt(p.velocity_u ** 2 + p.velocity_v ** 2 + p.velocity_w ** 2).toFixed(3)} m/s`
      ),
    [predictions]
  )

  // Memoized velocity hover text
  const velocityHoverText = useMemo(
    () =>
      predictions.map(
        (p, i) =>
          `t=${p.time.toFixed(2)}s<br>u=${p.velocity_u.toFixed(3)} m/s<br>v=${p.velocity_v.toFixed(3)} m/s<br>w=${p.velocity_w.toFixed(3)} m/s<br>|V|=${Math.sqrt(p.velocity_u ** 2 + p.velocity_v ** 2 + p.velocity_w ** 2).toFixed(3)} m/s`
      ),
    [predictions]
  )

  // Memoized temperature hover text
  const temperatureHoverText = useMemo(
    () =>
      predictions.map(
        (p, i) =>
          `t=${p.time.toFixed(2)}s<br>T=${p.temperature.toFixed(1)} K<br>P=${p.pressure.toExponential(2)} Pa`
      ),
    [predictions]
  )

  // Callback for handling plot interactions
  const handlePlotlyClick = useCallback((event: any) => {
    console.log('Plot interaction:', event)
  }, [])

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">{title}</h3>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pressure">Pression</TabsTrigger>
            <TabsTrigger value="velocity">Vitesse</TabsTrigger>
            <TabsTrigger value="temperature">Température</TabsTrigger>
          </TabsList>

          {/* Pressure Distribution Plot */}
          <TabsContent value="pressure" className="h-[500px]">
            <Plot
              data={[
                {
                  type: 'scatter3d',
                  mode: 'markers',
                  x: chartData.x,
                  y: chartData.y,
                  z: chartData.z,
                  marker: {
                    size: 6,
                    color: chartData.pressure,
                    colorscale: 'Viridis',
                    colorbar: {
                      title: { text: 'Pression (Pa)', font: { size: 12 } },
                      thickness: 15,
                      len: 0.7,
                    },
                    opacity: 0.85,
                    line: { width: 0.5, color: 'rgba(0,0,0,0.2)' },
                  },
                  text: hoverText,
                  hoverinfo: 'text',
                  hovertemplate: '%{text}<extra></extra>',
                },
              ]}
              layout={{
                ...baseLayout,
                title: { ...baseLayout.title, text: `${title} – Pression` },
              }}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: '100%', height: '100%' }}
              onClick={handlePlotlyClick}
            />
          </TabsContent>

          {/* Velocity Cone Plot */}
          <TabsContent value="velocity" className="h-[500px]">
            <Plot
              data={[
                {
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
                  colorbar: {
                    title: { text: 'Vitesse (m/s)', font: { size: 12 } },
                    thickness: 15,
                    len: 0.7,
                  },
                  text: velocityHoverText,
                  hoverinfo: 'text',
                  hovertemplate: '%{text}<extra></extra>',
                } as any,
              ]}
              layout={{
                ...baseLayout,
                title: { ...baseLayout.title, text: `${title} – Vecteurs de Vitesse` },
              }}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: '100%', height: '100%' }}
              onClick={handlePlotlyClick}
            />
          </TabsContent>

          {/* Temperature Distribution Plot */}
          <TabsContent value="temperature" className="h-[500px]">
            <Plot
              data={[
                {
                  type: 'scatter3d',
                  mode: 'markers',
                  x: chartData.x,
                  y: chartData.y,
                  z: chartData.z,
                  marker: {
                    size: 6,
                    color: chartData.temperature,
                    colorscale: 'Hot',
                    colorbar: {
                      title: { text: 'Température (K)', font: { size: 12 } },
                      thickness: 15,
                      len: 0.7,
                    },
                    opacity: 0.85,
                    line: { width: 0.5, color: 'rgba(0,0,0,0.2)' },
                  },
                  text: temperatureHoverText,
                  hoverinfo: 'text',
                  hovertemplate: '%{text}<extra></extra>',
                },
              ]}
              layout={{
                ...baseLayout,
                title: { ...baseLayout.title, text: `${title} – Température` },
              }}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: '100%', height: '100%' }}
              onClick={handlePlotlyClick}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
