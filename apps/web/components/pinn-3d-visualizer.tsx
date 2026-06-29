'use client'
import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'

interface PINN3DVisualizerProps {
  predictions: any[]
  title?: string
  colorScale?: string
}

const PINN3DVisualizer: React.FC<PINN3DVisualizerProps> = ({ 
  predictions, 
  title = "Visualisation PINN 3D",
  colorScale = "Viridis"
}) => {
  const data = useMemo(() => {
    if (!predictions || predictions.length === 0) return []

    const x = predictions.map(p => p.x)
    const y = predictions.map(p => p.y)
    const z = predictions.map(p => p.z)
    const temp = predictions.map(p => p.temperature)
    const vel = predictions.map(p => p.velocity_magnitude || p.velocity_u || p.velocity || 0)

    // Détection du type de visualisation : Stratification vs Trajectoire
    const isStratification = predictions.length > 50 && Math.abs(Math.max(...z) - Math.min(...z)) > 0.1

    if (isStratification) {
      // Rendu de surface pour la stratification (Design Industriel)
      return [{
        type: 'mesh3d',
        x: x,
        y: y,
        z: z,
        intensity: temp,
        colorscale: 'RdYlBu_r',
        opacity: 0.9,
        showscale: true,
        colorbar: { 
          title: 'Température (K)', 
          tickfont: { color: '#fff' },
          // Force l'échelle pour montrer la stratification même si les écarts sont faibles
          tickvals: [Math.min(...temp), (Math.min(...temp) + Math.max(...temp))/2, Math.max(...temp)],
          ticktext: [Math.min(...temp).toFixed(1) + 'K', 'Interface', Math.max(...temp).toFixed(1) + 'K']
        },
        name: 'Stratification Thermique'
      }]
    } else {
      // Rendu de trajectoires et vecteurs de flux
      return [
        {
          type: 'scatter3d',
          mode: 'lines+markers',
          x: x,
          y: y,
          z: z,
          line: {
            width: 6,
            color: vel,
            colorscale: 'Bluered',
          },
          marker: {
            size: 4,
            color: vel,
            colorscale: 'Bluered',
            opacity: 0.8
          },
          name: 'Trajectoire de Flux'
        },
        {
          type: 'cone',
          x: x.filter((_, i) => i % 5 === 0),
          y: y.filter((_, i) => i % 5 === 0),
          z: z.filter((_, i) => i % 5 === 0),
          u: predictions.filter((_, i) => i % 5 === 0).map(p => p.velocity_u || 1),
          v: predictions.filter((_, i) => i % 5 === 0).map(p => p.velocity_v || 0),
          w: predictions.filter((_, i) => i % 5 === 0).map(p => p.velocity_w || 0),
          sizemode: 'scaled',
          sizeref: 0.5,
          showscale: false,
          colorscale: 'Greys',
          opacity: 0.3,
          name: 'Vecteurs de Vitesse'
        }
      ]
    }
  }, [predictions])

  return (
    <div className="w-full h-[500px] bg-[#0f172a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <Plot
        data={data as any}
        layout={{
          title: { text: title, font: { color: '#fff', size: 18 } },
          autosize: true,
          margin: { l: 0, r: 0, b: 0, t: 40 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          scene: {
            xaxis: { title: 'X (m)', gridcolor: '#1e293b', zerolinecolor: '#1e293b', tickfont: { color: '#94a3b8' } },
            yaxis: { title: 'Y (m)', gridcolor: '#1e293b', zerolinecolor: '#1e293b', tickfont: { color: '#94a3b8' } },
            zaxis: { title: 'Z (m)', gridcolor: '#1e293b', zerolinecolor: '#1e293b', tickfont: { color: '#94a3b8' } },
            aspectmode: 'data'
          },
          legend: { font: { color: '#fff' } }
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ responsive: true, displaylogo: false }}
      />
    </div>
  )
}

export default PINN3DVisualizer
