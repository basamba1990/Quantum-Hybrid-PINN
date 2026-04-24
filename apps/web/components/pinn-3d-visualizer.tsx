import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js').then((mod) => mod.default), { 
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-50 animate-pulse rounded-lg text-slate-400 text-xs">Initialisation du moteur 3D...</div>
})

interface Prediction3D {
  time: number
  x: number
  y: number
  z: number
  pressure: number
  velocity_u: number
  velocity_v: number
  velocity_w: number
  temperature: number
  density: number
}

interface PINN3DVisualizerProps {
  predictions: Prediction3D[]
  title?: string
}

export default function PINN3DVisualizer({ predictions, title = "Visualisation 3D PINN V8" }: PINN3DVisualizerProps) {
  const [isMounted, setIsMounted] = useState(false)

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

  // For 3D visualization, we might want to show the spatial distribution or the evolution
  // If all points are at the same x,y,z (time series at one point), we add small offsets for visibility in 3D
  const isPointSeries = new Set(predictions.map(p => `${p.x},${p.y},${p.z}`)).size === 1;
  
  const x = predictions.map((p, i) => isPointSeries ? p.x + (i * 0.01) : p.x)
  const y = predictions.map((p, i) => isPointSeries ? p.y + (Math.sin(i) * 0.01) : p.y)
  const z = predictions.map((p, i) => isPointSeries ? p.z + (Math.cos(i) * 0.01) : p.z)
  const pressure = predictions.map(p => p.pressure)
  const u = predictions.map(p => p.velocity_u)
  const v = predictions.map(p => p.velocity_v)
  const w = predictions.map(p => p.velocity_w)

  return (
    <div className="space-y-8">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
        
        {/* Pressure Distribution Plot */}
        <div className="h-[400px] mb-8">
          <Plot
            data={[
              {
                type: 'scatter3d',
                mode: 'markers',
                x: x,
                y: y,
                z: z,
                marker: {
                  size: 8,
                  color: pressure,
                  colorscale: 'Viridis',
                  colorbar: { title: { text: 'Pression (Pa)' }, thickness: 15 },
                  opacity: 0.8
                },
                text: predictions.map(p => `P: ${p.pressure.toExponential(2)} Pa, T: ${p.temperature.toFixed(1)} K`),
                hoverinfo: 'text'
              }
            ]}
            layout={{
              title: 'Distribution de la Pression',
              autosize: true,
              margin: { l: 0, r: 0, b: 0, t: 30 },
              scene: {
                xaxis: { title: 'X' },
                yaxis: { title: 'Y' },
                zaxis: { title: 'Z' }
              }
            }}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true }}
          />
        </div>

        {/* Velocity Quiver/Cone Plot */}
        <div className="h-[400px]">
          <Plot
            data={[
              {
                type: 'cone',
                x: x,
                y: y,
                z: z,
                u: u,
                v: v,
                w: w,
                colorscale: 'Portland',
                sizemode: 'scaled',
                sizeref: 0.5,
                colorbar: { title: { text: 'Vitesse (m/s)' }, thickness: 15 }
              } as any
            ]}
            layout={{
              title: 'Vecteurs de Vitesse',
              autosize: true,
              margin: { l: 0, r: 0, b: 0, t: 30 },
              scene: {
                xaxis: { title: 'X' },
                yaxis: { title: 'Y' },
                zaxis: { title: 'Z' }
              }
            }}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true }}
          />
        </div>
      </div>
    </div>
  )
}
