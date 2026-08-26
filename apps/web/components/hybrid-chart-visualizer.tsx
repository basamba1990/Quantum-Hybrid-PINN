'use client'

import React, { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Prediction3D } from '@/types'

const Plot = dynamic(() => import('react-plotly.js').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-50 animate-pulse rounded-lg text-slate-400 text-xs">
      Chargement des graphiques...
    </div>
  ),
})

interface HybridChartVisualizerProps {
  predictions: Prediction3D[]
  title?: string
}

export default function HybridChartVisualizer({
  predictions,
  title = 'PINN V8 Temporal Analysis',
}: HybridChartVisualizerProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('pressure')

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

      // Keep ALL valid points - sort by time for smooth curves
      // No unique-time filtering: we want continuous curves, not scattered dots
      const allPoints = validPoints
        .filter(p => {
          const t = typeof p.time === 'number' ? p.time : parseFloat(p.time);
          return !isNaN(t);
        })
        .map(p => ({
          ...p,
          time: typeof p.time === 'number' ? p.time : parseFloat(p.time)
        }))
        .sort((a, b) => a.time - b.time);

      const times = allPoints.map((p) => p.time)
      
      // Pressure (conversion Pa -> bar si nécessaire)
      const pressure = allPoints.map((p) => {
        const rawP = p.pressure ?? 0
        return rawP > 1000 ? rawP / 1e5 : rawP
      })

      // Temperature (gestion des deux échelles : K brut et K converti)
      const temperatureBrut = allPoints.map((p) => p.temperature ?? 0)
      const temperatureConverted = allPoints.map((p) => {
        const rawT = p.temperature ?? 0
        if (rawT < 100) {
          return rawT // Afficher la valeur brute pour l'hydrogène liquide
        }
        return rawT
      })

      // Vitesse (magnitude)
      const velocity = allPoints.map((p) => {
        const u = p.velocity_u ?? 0
        const v = p.velocity_v ?? 0
        const w = p.velocity_w ?? 0
        return Math.sqrt(u ** 2 + v ** 2 + w ** 2)
      })

      // Density
      const density = allPoints.map((p) => p.density ?? 1.0)

      return {
        times,
        pressure,
        temperature: temperatureConverted,
        temperatureBrut,
        velocity,
        density,
      }
    } catch (err) {
      console.error('Error parsing chart data:', err)
      return null
    }
  }, [isMounted, predictions])

  if (!isMounted || !predictions || predictions.length === 0 || !chartData) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center bg-slate-50 rounded-lg text-slate-400 border border-dashed">
        Insufficient prediction data to display curves
      </div>
    )
  }

  return (
    <div className="bg-transparent p-0">
      <h3 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] mb-6">{title}</h3>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="pressure">Pressure</TabsTrigger>
          <TabsTrigger value="temperature">Temperature</TabsTrigger>
          <TabsTrigger value="velocity">Vitesse</TabsTrigger>
          <TabsTrigger value="density">Density</TabsTrigger>
        </TabsList>

        {/* Pressure */}
        <TabsContent value="pressure" className="h-[400px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.pressure,
                type: 'scatter',
                mode: 'lines',
                name: 'Pressure',
                line: { color: '#4f46e5', width: 3, shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(79, 70, 229, 0.05)',
                hoverinfo: 'x+y',
                hovertemplate: '<b>Time</b>: %{x:.2f}s<br><b>Pressure</b>: %{y:.3f} bar<extra></extra>',
              },
            ]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { color: '#94a3b8', family: 'Inter, sans-serif' },
              xaxis: { title: 'TEMPS (S)', gridcolor: 'rgba(255,255,255,0.05)', zeroline: false },
              yaxis: { title: 'BAR', gridcolor: 'rgba(255,255,255,0.05)', zeroline: false },
              hovermode: 'x unified',
              margin: { l: 40, r: 20, b: 40, t: 20 },
              autosize: true,
            }}
            config={{ responsive: true, displayModeBar: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>

        {/* Temperature */}
        <TabsContent value="temperature" className="h-[400px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.temperature,
                type: 'scatter',
                mode: 'lines',
                name: 'Temperature',
                line: { color: '#dc2626', width: 3, shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(220, 38, 38, 0.1)',
              },
            ]}
            layout={{
              title: `${title} – Temperature (K)`,
              xaxis: { title: 'Time (s)', zeroline: false },
              yaxis: { title: 'Temperature (K)', zeroline: false },
              hovermode: 'x unified',
              margin: { l: 60, r: 40, b: 60, t: 60 },
              autosize: true,
              annotations: chartData.temperature[0] < 100 ? [{
                text: 'Hydrogène liquide cryogénique',
                x: chartData.times[chartData.times.length - 1] * 0.5,
                y: chartData.temperature[0],
                showarrow: false,
                bgcolor: 'rgba(59, 130, 246, 0.8)',
                bordercolor: '#1e40af',
                borderwidth: 1,
                font: { color: 'white', size: 10 },
              }] : [],
            }}
            config={{ responsive: true, displayModeBar: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>

        {/* Vitesse */}
        <TabsContent value="velocity" className="h-[400px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.velocity,
                type: 'scatter',
                mode: 'lines',
                name: 'Vitesse',
                line: { color: '#16a34a', width: 3, shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(22, 163, 74, 0.1)',
              },
            ]}
            layout={{
              title: `${title} – Magnitude de Vitesse (m/s)`,
              xaxis: { title: 'Time (s)', zeroline: false },
              yaxis: { title: 'Vitesse (m/s)', zeroline: false },
              hovermode: 'x unified',
              margin: { l: 60, r: 40, b: 60, t: 60 },
              autosize: true,
            }}
            config={{ responsive: true, displayModeBar: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>

        {/* Density */}
        <TabsContent value="density" className="h-[400px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.density,
                type: 'scatter',
                mode: 'lines',
                name: 'Density',
                line: { color: '#f59e0b', width: 3, shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(245, 158, 11, 0.1)',
              },
            ]}
            layout={{
              title: `${title} – Density (kg/m³)`,
              xaxis: { title: 'Time (s)', zeroline: false },
              yaxis: { title: 'Density (kg/m³)', zeroline: false },
              hovermode: 'x unified',
              margin: { l: 60, r: 40, b: 60, t: 60 },
              autosize: true,
            }}
            config={{ responsive: true, displayModeBar: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
