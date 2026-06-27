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
  title = 'Analyse Temporelle PINN V8',
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

      // Extraction des données temporelles
      const times = validPoints.map((p) => p.time ?? 0)
      
      // Pression (conversion Pa -> bar si nécessaire)
      const pressure = validPoints.map((p) => {
        const rawP = p.pressure ?? 0
        return rawP > 1000 ? rawP / 1e5 : rawP
      })

      // Température (gestion des deux échelles : K brut et K converti)
      const temperatureBrut = validPoints.map((p) => p.temperature ?? 0)
      const temperatureConverted = validPoints.map((p) => {
        const rawT = p.temperature ?? 0
        // Si la température est très basse (< 100K), c'est du liquide cryogénique
        if (rawT < 100) {
          return rawT // Afficher la valeur brute pour l'hydrogène liquide
        }
        return rawT
      })

      // Vitesse (magnitude)
      const velocity = validPoints.map((p) => {
        const u = p.velocity_u ?? 0
        const v = p.velocity_v ?? 0
        const w = p.velocity_w ?? 0
        return Math.sqrt(u ** 2 + v ** 2 + w ** 2)
      })

      // Densité
      const density = validPoints.map((p) => p.density ?? 1.0)

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
        Données de prédiction insuffisantes pour afficher les courbes
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">{title} - Courbes Temporelles</h3>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="pressure">Pression</TabsTrigger>
          <TabsTrigger value="temperature">Température</TabsTrigger>
          <TabsTrigger value="velocity">Vitesse</TabsTrigger>
          <TabsTrigger value="density">Densité</TabsTrigger>
        </TabsList>

        {/* Pression */}
        <TabsContent value="pressure" className="h-[400px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.pressure,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Pression',
                line: { color: '#4f46e5', width: 2 },
                marker: { size: 5, color: '#4f46e5' },
                fill: 'tozeroy',
                fillcolor: 'rgba(79, 70, 229, 0.1)',
              },
            ]}
            layout={{
              title: `${title} – Pression (bar)`,
              xaxis: { title: 'Temps (s)', zeroline: false },
              yaxis: { title: 'Pression (bar)', zeroline: false },
              hovermode: 'x unified',
              margin: { l: 60, r: 40, b: 60, t: 60 },
              autosize: true,
            }}
            config={{ responsive: true, displayModeBar: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>

        {/* Température */}
        <TabsContent value="temperature" className="h-[400px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.temperature,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Température',
                line: { color: '#dc2626', width: 2 },
                marker: { size: 5, color: '#dc2626' },
                fill: 'tozeroy',
                fillcolor: 'rgba(220, 38, 38, 0.1)',
              },
            ]}
            layout={{
              title: `${title} – Température (K)`,
              xaxis: { title: 'Temps (s)', zeroline: false },
              yaxis: { title: 'Température (K)', zeroline: false },
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
                mode: 'lines+markers',
                name: 'Vitesse',
                line: { color: '#16a34a', width: 2 },
                marker: { size: 5, color: '#16a34a' },
                fill: 'tozeroy',
                fillcolor: 'rgba(22, 163, 74, 0.1)',
              },
            ]}
            layout={{
              title: `${title} – Magnitude de Vitesse (m/s)`,
              xaxis: { title: 'Temps (s)', zeroline: false },
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

        {/* Densité */}
        <TabsContent value="density" className="h-[400px] w-full">
          <Plot
            data={[
              {
                x: chartData.times,
                y: chartData.density,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Densité',
                line: { color: '#f59e0b', width: 2 },
                marker: { size: 5, color: '#f59e0b' },
                fill: 'tozeroy',
                fillcolor: 'rgba(245, 158, 11, 0.1)',
              },
            ]}
            layout={{
              title: `${title} – Densité (kg/m³)`,
              xaxis: { title: 'Temps (s)', zeroline: false },
              yaxis: { title: 'Densité (kg/m³)', zeroline: false },
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
