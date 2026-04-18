'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

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
    return <div className="h-64 flex items-center justify-center bg-gray-100 rounded-lg">Chargement de la visualisation 3D...</div>
  }

  // Extract data for plotting
  const x = predictions.map(p => p.x)
  const y = predictions.map(p => p.y)
  const z = predictions.map(p => p.z)
  const pressure = predictions.map(p => p.pressure)
  const temperature = predictions.map(p => p.temperature)
  const density = predictions.map(p => p.density)

  // Velocity vectors
  const u = predictions.map(p => p.velocity_u)
  const v = predictions.map(p => p.velocity_v)
  const w = predictions.map(p => p.velocity_w)

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold mb-4 text-slate-800">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pressure Isosurface/Scatter */}
        <div className="h-[400px]">
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
                  colorbar: { title: 'Pression (Pa)', thickness: 15 },
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
                colorbar: { title: 'Vitesse (m/s)', thickness: 15 }
              }
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

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
        <div className="p-2 bg-slate-50 rounded">
          <span className="block font-bold text-slate-700">Densité Moyenne</span>
          {(density.reduce((a, b) => a + b, 0) / density.length).toFixed(2)} kg/m³
        </div>
        <div className="p-2 bg-slate-50 rounded">
          <span className="block font-bold text-slate-700">Temp. Max</span>
          {Math.max(...temperature).toFixed(1)} K
        </div>
        <div className="p-2 bg-slate-50 rounded">
          <span className="block font-bold text-slate-700">Pression Max</span>
          {Math.max(...pressure).toExponential(2)} Pa
        </div>
      </div>
    </div>
  )
}
