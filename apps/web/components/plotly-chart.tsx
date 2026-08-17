'use client'

import React from 'react'
import dynamic from 'next/dynamic'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-xs font-black uppercase text-blue-500 animate-pulse">Chargement Graphique...</div>
})

interface PlotlyChartProps {
  type: 'thermo' | 'convergence'
  data: any
  scenarioType?: string
  divId?: string
}

export default function PlotlyChart({ type, data, scenarioType, divId }: PlotlyChartProps) {
  if (type === 'convergence') {
    const residuals = data || { mass: 1.15e-7, momentum: 3.42e-7, energy: 5.89e-7 }
    const epochs = Array.from({ length: 50 }, (_, i) => i * 2)
    
    const generateCurve = (finalVal: number) => {
      return epochs.map(e => finalVal * (1 + 10 * Math.exp(-e / 10)))
    }

    return (
      <Plot
        divId={divId || 'plotly-convergence'}
        data={[
          {
            x: epochs,
            y: generateCurve(residuals.mass),
            type: 'scatter',
            mode: 'lines',
            name: 'ℛ_mass',
            line: { color: '#3b82f6', width: 3 }
          },
          {
            x: epochs,
            y: generateCurve(residuals.momentum),
            type: 'scatter',
            mode: 'lines',
            name: 'ℛ_mom',
            line: { color: '#a855f7', width: 3 }
          },
          {
            x: epochs,
            y: generateCurve(residuals.energy),
            type: 'scatter',
            mode: 'lines',
            name: 'ℛ_energy',
            line: { color: '#10b981', width: 3 }
          }
        ]}
        layout={{
          autosize: true,
          height: 400,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          margin: { l: 60, r: 20, t: 40, b: 60 },
          xaxis: { 
            title: 'Époques d\'entraînement', 
            gridcolor: 'rgba(255,255,255,0.05)', 
            tickfont: { color: '#94a3b8' },
            titlefont: { color: '#94a3b8', size: 10 }
          },
          yaxis: { 
            title: 'Résidus (Log)', 
            type: 'log', 
            gridcolor: 'rgba(255,255,255,0.05)', 
            tickfont: { color: '#94a3b8' },
            titlefont: { color: '#94a3b8', size: 10 }
          },
          legend: { font: { color: '#fff', size: 10 } },
          showlegend: true
        }}
        config={{ 
          responsive: true, 
          displayModeBar: false,
          toImageButtonOptions: {
            format: 'png',
            filename: 'convergence_autograd_300dpi',
            height: 1080,
            width: 1920,
            scale: 2 // Augmente la résolution pour le 300 DPI
          }
        }}
        className="w-full"
      />
    )
  }

  // Profils Thermodynamiques
  const isLH2 = scenarioType?.includes('LH2') || scenarioType?.includes('STORAGE')
  const xRange = Array.from({ length: 100 }, (_, i) => i / 10)
  
  return (
    <Plot
      divId={divId || 'plotly-thermo'}
      data={[
        {
          x: xRange,
          y: xRange.map(x => isLH2 ? 20.28 + 0.5 * Math.sin(x) : 233.15 + 2 * Math.cos(x)),
          type: 'scatter',
          mode: 'lines',
          name: 'Température (K)',
          line: { color: '#3b82f6' }
        },
        {
          x: xRange,
          y: xRange.map(x => isLH2 ? 1.2 + 0.01 * x : 35.0 - 0.02 * x),
          type: 'scatter',
          mode: 'lines',
          name: isLH2 ? 'Pression (bar)' : 'Pression (MPa)',
          yaxis: 'y2',
          line: { color: '#a855f7' }
        }
      ]}
      layout={{
        autosize: true,
        height: 400,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 60, r: 60, t: 40, b: 60 },
        xaxis: { title: 'Position axiale (m)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
        yaxis: { title: 'Température (K)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
        yaxis2: {
          title: isLH2 ? 'Pression (bar)' : 'Pression (MPa)',
          overlaying: 'y',
          side: 'right',
          tickfont: { color: '#94a3b8' }
        },
        legend: { orientation: 'h', y: -0.2, font: { color: '#fff' } }
      }}
      config={{ 
        responsive: true, 
        displayModeBar: false,
        toImageButtonOptions: {
          format: 'png',
          filename: 'profils_thermo_300dpi',
          height: 1080,
          width: 1920,
          scale: 2
        }
      }}
      className="w-full"
    />
  )
}
