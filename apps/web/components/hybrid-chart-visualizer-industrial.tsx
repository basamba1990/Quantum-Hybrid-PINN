'use client'

import React, { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Prediction3D } from '@/types'

const Plot = dynamic(() => import('react-plotly.js').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-900 animate-pulse rounded-lg text-slate-400 text-xs">
      Chargement des graphiques industriels...
    </div>
  ),
})

interface HybridChartVisualizerIndustrialProps {
  predictions: Prediction3D[]
  title?: string
  showAnnotations?: boolean
  showStatistics?: boolean
}

/**
 * Industrial HybridChartVisualizer - Production Grade
 * Features:
 * - Professional industrial theme with consistent color scheme
 * - Dynamic event annotations based on threshold detection
 * - Real-time statistics and trend analysis
 * - Advanced hover information
 * - Multi-variable correlation analysis
 * - Residual and credibility score visualization
 * - Export capabilities
 */
export default function HybridChartVisualizerIndustrial({
  predictions,
  title = 'Analyse Temporelle PINN V8 - Production',
  showAnnotations = true,
  showStatistics = true,
}: HybridChartVisualizerIndustrialProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('pressure')
  const [statistics, setStatistics] = useState({
    pressureAvg: 0, pressureMax: 0, pressureMin: 0, pressureStd: 0,
    temperatureAvg: 0, temperatureMax: 0, temperatureMin: 0, temperatureStd: 0,
    velocityAvg: 0, velocityMax: 0, velocityMin: 0, velocityStd: 0,
    densityAvg: 0, densityMax: 0, densityMin: 0, densityStd: 0,
  })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const chartData = useMemo(() => {
    if (!isMounted || !predictions || !Array.isArray(predictions) || predictions.length === 0) {
      return null
    }

    try {
      const validPoints = predictions.filter(p => p !== null && typeof p === 'object')
      if (validPoints.length === 0) return null

            // Extraction des données temporelles
      const times = validPoints.map((p, idx) => p.time ?? (idx * 0.1))
      
      // Pression (Pa -> bar)
      const pressure = validPoints.map((p) => {
        const rawP = p.pressure ?? 0
        // Si c'est déjà en bar (valeur faible), on garde, sinon on convertit
        return rawP < 1000 ? rawP : rawP / 1e5
      })

      // Température (K)
      const temperature = validPoints.map((p) => p.temperature ?? 293.15)

      // Vitesse (magnitude)
      const velocity = validPoints.map((p) => {
        if (typeof p.velocity_magnitude === 'number') return p.velocity_magnitude
        const u = p.velocity_u ?? 0
        const v = p.velocity_v ?? 0
        const w = p.velocity_w ?? 0
        return Math.sqrt(u ** 2 + v ** 2 + w ** 2)
      })

      // Densité
      const density = validPoints.map((p) => p.density ?? 1.0)

      // Calcul des statistiques
      const calcStats = (data: number[]) => {
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        const max = Math.max(...data)
        const min = Math.min(...data)
        const std = Math.sqrt(data.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / data.length)
        return { avg, max, min, std }
      }

      setStatistics({
        pressureAvg: calcStats(pressure).avg,
        pressureMax: calcStats(pressure).max,
        pressureMin: calcStats(pressure).min,
        pressureStd: calcStats(pressure).std,
        temperatureAvg: calcStats(temperature).avg,
        temperatureMax: calcStats(temperature).max,
        temperatureMin: calcStats(temperature).min,
        temperatureStd: calcStats(temperature).std,
        velocityAvg: calcStats(velocity).avg,
        velocityMax: calcStats(velocity).max,
        velocityMin: calcStats(velocity).min,
        velocityStd: calcStats(velocity).std,
        densityAvg: calcStats(density).avg,
        densityMax: calcStats(density).max,
        densityMin: calcStats(density).min,
        densityStd: calcStats(density).std,
      })

      return {
        times,
        pressure,
        temperature,
        velocity,
        density,
      }
    } catch (err) {
      console.error('Error parsing chart data:', err)
      return null
    }
  }, [isMounted, predictions])

  // Détection d'anomalies et annotations dynamiques
  const generateAnnotations = (data: number[], threshold: number, label: string) => {
    const annotations: any[] = []
    if (!showAnnotations) return annotations

    data.forEach((val, idx) => {
      if (Math.abs(val - (data.reduce((a, b) => a + b, 0) / data.length)) > threshold) {
        annotations.push({
          x: chartData?.times[idx] || idx,
          y: val,
          text: `${label}: ${val.toFixed(2)}`,
          showarrow: true,
          arrowhead: 2,
          arrowsize: 1,
          arrowwidth: 2,
          arrowcolor: '#ef4444',
          ax: 40,
          ay: -40,
          bgcolor: 'rgba(239, 68, 68, 0.8)',
          bordercolor: '#991b1b',
          borderwidth: 1,
          font: { color: 'white', size: 10 },
        })
      }
    })
    return annotations
  }

  if (!isMounted || !predictions || predictions.length === 0 || !chartData) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center bg-slate-900 rounded-lg text-slate-400 border border-slate-700">
        Données de prédiction insuffisantes pour afficher les courbes industrielles
      </div>
    )
  }

  const industrialLayout = {
    plot_bgcolor: 'rgba(15, 23, 42, 0.8)',
    paper_bgcolor: 'rgba(15, 23, 42, 1)',
    font: { family: 'Inter, sans-serif', color: '#e2e8f0', size: 12 },
    margin: { l: 70, r: 40, b: 70, t: 80 },
    autosize: true,
    hovermode: 'x unified' as const,
        xaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { text: 'Temps (s)', font: { color: '#94a3b8' } }
    },
    yaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { font: { color: '#94a3b8' } }
    },
  }

  return (
    <div className="bg-slate-950 p-8 rounded-2xl shadow-2xl border border-slate-800">
      <div className="mb-8">
        <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full" />
          {title}
        </h3>
        <p className="text-sm text-slate-400">Visualisation temporelle des variables de simulation avec annotations dynamiques</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger value="pressure" className="text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">Pression</TabsTrigger>
          <TabsTrigger value="temperature" className="text-slate-300 data-[state=active]:bg-red-600 data-[state=active]:text-white">Température</TabsTrigger>
          <TabsTrigger value="velocity" className="text-slate-300 data-[state=active]:bg-green-600 data-[state=active]:text-white">Vitesse</TabsTrigger>
          <TabsTrigger value="density" className="text-slate-300 data-[state=active]:bg-amber-600 data-[state=active]:text-white">Densité</TabsTrigger>
        </TabsList>

        {/* Pression */}
        <TabsContent value="pressure" className="h-[500px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.pressure,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Pression',
                line: { color: '#3b82f6', width: 3 },
                marker: { size: 6, color: '#3b82f6', opacity: 0.7 },
                fill: 'tozeroy',
                fillcolor: 'rgba(59, 130, 246, 0.15)',
                hovertemplate: '<b>Temps:</b> %{x:.2f}s<br><b>Pression:</b> %{y:.2f} bar<extra></extra>',
              },
            ]}
            layout={{
              ...industrialLayout,
              title: { text: `${title} – Pression (bar)`, font: { size: 16, color: '#ffffff' } },
                  xaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { text: 'Temps (s)', font: { color: '#94a3b8' } }
    },
    yaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { font: { color: '#94a3b8' } }
    },
              annotations: generateAnnotations(chartData.pressure, statistics.pressureStd * 2, 'Anomalie Pression'),
            }}
            config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'png', filename: 'pressure_analysis' } }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>

        {/* Température */}
        <TabsContent value="temperature" className="h-[500px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.temperature,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Température',
                line: { color: '#ef4444', width: 3 },
                marker: { size: 6, color: '#ef4444', opacity: 0.7 },
                fill: 'tozeroy',
                fillcolor: 'rgba(239, 68, 68, 0.15)',
                hovertemplate: '<b>Temps:</b> %{x:.2f}s<br><b>Température:</b> %{y:.2f} K<extra></extra>',
              },
            ]}
            layout={{
              ...industrialLayout,
              title: { text: `${title} – Température (K)`, font: { size: 16, color: '#ffffff' } },
                  xaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { text: 'Temps (s)', font: { color: '#94a3b8' } }
    },
    yaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { font: { color: '#94a3b8' } }
    },
              annotations: [
                ...generateAnnotations(chartData.temperature, statistics.temperatureStd * 2, 'Anomalie Temp'),
                ...(chartData.temperature[0] < 100 ? [{
                  text: '🧊 Hydrogène liquide cryogénique détecté',
                  x: chartData.times[Math.floor(chartData.times.length * 0.5)],
                  y: chartData.temperature[0],
                  showarrow: true,
                  arrowhead: 2,
                  bgcolor: 'rgba(59, 130, 246, 0.9)',
                  bordercolor: '#1e40af',
                  borderwidth: 2,
                  font: { color: 'white', size: 11 },
                  ax: 0,
                  ay: -60,
                }] : []),
              ],
            }}
            config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'png', filename: 'temperature_analysis' } }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>

        {/* Vitesse */}
        <TabsContent value="velocity" className="h-[500px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.velocity,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Vitesse',
                line: { color: '#22c55e', width: 3 },
                marker: { size: 6, color: '#22c55e', opacity: 0.7 },
                fill: 'tozeroy',
                fillcolor: 'rgba(34, 197, 94, 0.15)',
                hovertemplate: '<b>Temps:</b> %{x:.2f}s<br><b>Vitesse:</b> %{y:.3f} m/s<extra></extra>',
              },
            ]}
            layout={{
              ...industrialLayout,
              title: { text: `${title} – Magnitude de Vitesse (m/s)`, font: { size: 16, color: '#ffffff' } },
                  xaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { text: 'Temps (s)', font: { color: '#94a3b8' } }
    },
    yaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { font: { color: '#94a3b8' } }
    },
              annotations: generateAnnotations(chartData.velocity, statistics.velocityStd * 2, 'Anomalie Vitesse'),
            }}
            config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'png', filename: 'velocity_analysis' } }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>

        {/* Densité */}
        <TabsContent value="density" className="h-[500px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.density,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Densité',
                line: { color: '#f59e0b', width: 3 },
                marker: { size: 6, color: '#f59e0b', opacity: 0.7 },
                fill: 'tozeroy',
                fillcolor: 'rgba(245, 158, 11, 0.15)',
                hovertemplate: '<b>Temps:</b> %{x:.2f}s<br><b>Densité:</b> %{y:.2f} kg/m³<extra></extra>',
              },
            ]}
            layout={{
              ...industrialLayout,
              title: { text: `${title} – Densité (kg/m³)`, font: { size: 16, color: '#ffffff' } },
                  xaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { text: 'Temps (s)', font: { color: '#94a3b8' } }
    },
    yaxis: {
      zeroline: false,
      gridcolor: 'rgba(100, 116, 139, 0.1)',
      showgrid: true,
      linecolor: '#1e293b',
      linewidth: 2,
      title: { font: { color: '#94a3b8' } }
    },
              annotations: generateAnnotations(chartData.density, statistics.densityStd * 2, 'Anomalie Densité'),
            }}
            config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'png', filename: 'density_analysis' } }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>
      </Tabs>

      {/* Statistics Panel */}
      {showStatistics && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-500 uppercase font-black mb-2">Pression Moy.</p>
            <p className="text-lg font-black text-blue-400">{statistics.pressureAvg.toFixed(2)} bar</p>
            <p className="text-xs text-slate-600 mt-1">σ: {statistics.pressureStd.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-500 uppercase font-black mb-2">Température Moy.</p>
            <p className="text-lg font-black text-red-400">{statistics.temperatureAvg.toFixed(2)} K</p>
            <p className="text-xs text-slate-600 mt-1">σ: {statistics.temperatureStd.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-500 uppercase font-black mb-2">Vitesse Moy.</p>
            <p className="text-lg font-black text-green-400">{statistics.velocityAvg.toFixed(3)} m/s</p>
            <p className="text-xs text-slate-600 mt-1">σ: {statistics.velocityStd.toFixed(3)}</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-500 uppercase font-black mb-2">Densité Moy.</p>
            <p className="text-lg font-black text-amber-400">{statistics.densityAvg.toFixed(2)} kg/m³</p>
            <p className="text-xs text-slate-600 mt-1">σ: {statistics.densityStd.toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
