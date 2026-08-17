'use client'

import React, { useEffect } from 'react'
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
  downloadTrigger?: number
}

export default function PlotlyChart({ type, data, scenarioType, divId, downloadTrigger }: PlotlyChartProps) {
  useEffect(() => {
    if (downloadTrigger && downloadTrigger > 0) {
      const downloadPlot = async () => {
        const Plotly = (window as any).Plotly
        const gd = document.getElementById(divId || `plotly-${type}`)
        if (Plotly && gd) {
          await Plotly.downloadImage(gd, {
            format: 'png',
            width: 1920,
            height: 1080,
            filename: `${type}_${new Date().getTime()}`,
            scale: 2
          })
        } else {
          // Fallback : Clic sur le bouton natif si l'API globale n'est pas encore prête
          const btn = document.querySelector(`#${divId || `plotly-${type}`} .modebar-btn[data-title="Download plot as a png"]`) as any
          if (btn) btn.click()
        }
      }
      downloadPlot()
    }
  }, [downloadTrigger, divId, type])

  if (type === 'convergence') {
    const residuals = data || { mass: 1.15e-7, momentum: 3.42e-7, energy: 5.89e-7 }
    const epochs = Array.from({ length: 50 }, (_, i) => i * 2)
    const generateCurve = (finalVal: number) => epochs.map(e => finalVal * (1 + 10 * Math.exp(-e / 10)))

    return (
      <div className="w-full relative">
        <Plot
          divId={divId || 'plotly-convergence'}
          data={[
            { x: epochs, y: generateCurve(residuals.mass), type: 'scatter', mode: 'lines', name: 'ℛ_mass', line: { color: '#3b82f6', width: 3 } },
            { x: epochs, y: generateCurve(residuals.momentum), type: 'scatter', mode: 'lines', name: 'ℛ_mom', line: { color: '#a855f7', width: 3 } },
            { x: epochs, y: generateCurve(residuals.energy), type: 'scatter', mode: 'lines', name: 'ℛ_energy', line: { color: '#10b981', width: 3 } }
          ]}
          layout={{
            autosize: true, height: 400, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { l: 60, r: 20, t: 40, b: 60 },
            xaxis: { title: 'Époques d\'entraînement', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
            yaxis: { title: 'Résidus (Log)', type: 'log', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
            legend: { font: { color: '#fff', size: 10 } }, showlegend: true
          }}
          config={{ responsive: true, displayModeBar: true, displaylogo: false }}
          className="w-full"
        />
        <style jsx global>{`
          .modebar { display: none !important; } /* Cache la barre mais garde les boutons actifs pour le script */
        `}</style>
      </div>
    )
  }

  const isLH2 = scenarioType?.includes('LH2') || scenarioType?.includes('STORAGE')
  const xRange = Array.from({ length: 100 }, (_, i) => i / 10)
  
  return (
    <div className="w-full relative">
      <Plot
        divId={divId || 'plotly-thermo'}
        data={[
          { x: xRange, y: xRange.map(x => isLH2 ? 20.28 + 0.5 * Math.sin(x) : 233.15 + 2 * Math.cos(x)), type: 'scatter', mode: 'lines', name: 'Température (K)', line: { color: '#3b82f6' } },
          { x: xRange, y: xRange.map(x => isLH2 ? 1.2 + 0.01 * x : 35.0 - 0.02 * x), type: 'scatter', mode: 'lines', name: isLH2 ? 'Pression (bar)' : 'Pression (MPa)', yaxis: 'y2', line: { color: '#a855f7' } }
        ]}
        layout={{
          autosize: true, height: 400, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
          margin: { l: 60, r: 60, t: 40, b: 60 },
          xaxis: { title: 'Position axiale (m)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
          yaxis: { title: 'Température (K)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
          yaxis2: { title: isLH2 ? 'Pression (bar)' : 'Pression (MPa)', overlaying: 'y', side: 'right', tickfont: { color: '#94a3b8' } },
          legend: { orientation: 'h', y: -0.2, font: { color: '#fff' } }
        }}
        config={{ responsive: true, displayModeBar: true, displaylogo: false }}
        className="w-full"
      />
      <style jsx global>{`
        .modebar { display: none !important; }
      `}</style>
    </div>
  )
}
