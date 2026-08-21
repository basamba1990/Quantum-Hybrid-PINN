'use client'

import React, { useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-xs font-black uppercase text-blue-500 animate-pulse">Chargement graphique…</div>,
})

interface PlotlyChartProps {
  type: 'thermo' | 'convergence'
  data: unknown
  scenarioType?: string
  divId?: string
  downloadTrigger?: number
}

type RecordLike = Record<string, any>

const asRecord = (value: unknown): RecordLike => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordLike : {}
)

const asFinite = (value: unknown): number | undefined => {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []

const unavailable = (message: string) => (
  <div className="min-h-[360px] flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-2xl px-6">
    <p className="text-sm font-black uppercase tracking-widest text-amber-300">Données insuffisantes</p>
    <p className="mt-3 max-w-xl text-xs leading-5 text-slate-400">{message}</p>
  </div>
)

function pointSeries(data: unknown) {
  const root = asRecord(data)
  const candidates = [
    root.pinn_predictions,
    root.predictions3d,
    root.predictions,
    root.points,
    root.spatial_profiles,
    root.thermodynamic_profiles,
    root.thermodynamic_profile,
    root.profiles,
  ]

  for (const candidate of candidates) {
    const values = asArray(candidate)
      .map((value) => asRecord(value))
      .filter((value) => asFinite(value.temperature) !== undefined || asFinite(value.temp) !== undefined || asFinite(value.T) !== undefined)
    if (values.length > 0) return values
  }
  return []
}

function getSeriesValue(point: RecordLike, field: 'temperature' | 'pressure') {
  const aliases = field === 'temperature' ? ['temperature', 'temp', 'T'] : ['pressure', 'p', 'P']
  for (const alias of aliases) {
    const value = asFinite(point[alias])
    if (value !== undefined) return value
  }
  return undefined
}

function convergenceHistory(data: unknown) {
  const root = asRecord(data)
  const candidates = [
    root.residual_history,
    root.residuals_history,
    root.convergence_history,
    root.training_history,
    asRecord(root.training).residual_history,
    asRecord(root.training).residuals_history,
    asRecord(root.training).history,
    root.convergence,
  ]

  for (const candidate of candidates) {
    const rows = asArray(candidate)
    if (!rows.length) continue
    const normalized = rows.map((row, index) => {
      if (typeof row === 'number') return { epoch: index, mass: row }
      const record = asRecord(row)
      return {
        epoch: asFinite(record.epoch ?? record.iteration ?? record.step ?? record.index) ?? index,
        mass: asFinite(record.mass ?? record.continuity ?? record.r_mass),
        momentum: asFinite(record.momentum ?? record.mom ?? record.r_momentum),
        energy: asFinite(record.energy ?? record.r_energy),
      }
    }).filter((row) => row.mass !== undefined || row.momentum !== undefined || row.energy !== undefined)
    if (normalized.length > 0) return normalized
  }
  return []
}

export default function PlotlyChart({ type, data, scenarioType, divId, downloadTrigger }: PlotlyChartProps) {
  const containerId = divId || `plotly-container-${type}`

  useEffect(() => {
    if (!downloadTrigger || downloadTrigger < 1) return
    const downloadPlot = async () => {
      const Plotly = (window as any).Plotly
      const container = document.getElementById(containerId)
      const graph = container?.querySelector('.js-plotly-plot')
      if (Plotly && graph) {
        await Plotly.downloadImage(graph, {
          format: 'png',
          width: 1920,
          height: 1080,
          filename: `${type}_${Date.now()}`,
          scale: 2,
        })
      }
    }
    void downloadPlot()
  }, [containerId, downloadTrigger, type])

  const history = useMemo(() => convergenceHistory(data), [data])
  const points = useMemo(() => pointSeries(data), [data])

  if (type === 'convergence') {
    if (history.length === 0) {
      const residuals = asRecord(asRecord(data).residuals)
      const finalRows = [
        { name: 'ℛ_mass', value: asFinite(residuals.mass ?? residuals.continuity) },
        { name: 'ℛ_mom', value: asFinite(residuals.momentum) },
        { name: 'ℛ_energy', value: asFinite(residuals.energy) },
      ].flatMap((row) => row.value === undefined ? [] : [{ name: row.name, value: row.value }])
      if (finalRows.length === 0) return unavailable('Aucun historique de convergence Autograd n’est persisté pour cette analyse. Le dashboard ne génère pas de trajectoire artificielle.')
      return (
        <div id={containerId}>
          <div className="mb-4 text-xs text-amber-200/80">Historique absent : seules les valeurs finales réellement reçues sont présentées.</div>
          <Plot
            data={[{
              x: finalRows.map((row) => row.name),
              y: finalRows.map((row) => row.value),
              type: 'bar',
              marker: { color: ['#3b82f6', '#a855f7', '#10b981'] },
              name: 'Résidu final',
            }]}
            layout={{
              autosize: true, height: 360, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
              margin: { l: 70, r: 20, t: 30, b: 60 },
              xaxis: { title: 'Résidu', tickfont: { color: '#94a3b8' } },
              yaxis: { title: 'Valeur reçue', type: 'log', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
              showlegend: false,
            }}
            config={{ responsive: true, displayModeBar: false, displaylogo: false }}
            className="w-full"
          />
        </div>
      )
    }

    const traces = [
      { key: 'mass', name: 'ℛ_mass', color: '#3b82f6' },
      { key: 'momentum', name: 'ℛ_mom', color: '#a855f7' },
      { key: 'energy', name: 'ℛ_energy', color: '#10b981' },
    ].map((series) => ({
      x: history.map((row) => row.epoch),
      y: history.map((row) => row[series.key as keyof typeof row]).map((value) => value ?? null),
      type: 'scatter', mode: 'lines+markers', name: series.name,
      line: { color: series.color, width: 2 }, marker: { size: 4 }, connectgaps: false,
    })).filter((trace) => trace.y.some((value) => value !== null))

    return (
      <div className="w-full relative" id={containerId}>
        <Plot
          data={traces as any}
          layout={{
            autosize: true, height: 400, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { l: 70, r: 20, t: 30, b: 60 },
            xaxis: { title: 'Itération / étape persistée', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
            yaxis: { title: 'Résidu', type: 'log', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
            legend: { font: { color: '#fff', size: 10 } }, showlegend: true,
          }}
          config={{ responsive: true, displayModeBar: false, displaylogo: false }}
          className="w-full"
        />
      </div>
    )
  }

  if (points.length === 0) return unavailable(`Aucun profil thermodynamique persisté pour ${scenarioType ?? 'ce scénario'}. Le graphique n’invente ni température ni pression.`)

  const sorted = [...points].sort((a, b) => (asFinite(a.x ?? a.position ?? a.distance) ?? 0) - (asFinite(b.x ?? b.position ?? b.distance) ?? 0))
  const chartRows = sorted.map((point, index) => ({
    x: asFinite(point.x ?? point.position ?? point.distance) ?? index,
    temperature: getSeriesValue(point, 'temperature'),
    pressure: getSeriesValue(point, 'pressure'),
  })).filter((row) => row.temperature !== undefined || row.pressure !== undefined)
  if (chartRows.length === 0) return unavailable('Les points persistés ne contiennent pas les champs température ou pression nécessaires au profil.')

  const hasTemperature = chartRows.some((row) => row.temperature !== undefined)
  const hasPressure = chartRows.some((row) => row.pressure !== undefined)
  return (
    <div className="w-full relative" id={containerId}>
      <Plot
        data={[
          hasTemperature && { x: chartRows.map((row) => row.x), y: chartRows.map((row) => row.temperature ?? null), type: 'scatter', mode: 'lines+markers', name: 'Température (unité persistée)', line: { color: '#3b82f6', width: 2 }, marker: { size: 3 }, connectgaps: false },
          hasPressure && { x: chartRows.map((row) => row.x), y: chartRows.map((row) => row.pressure ?? null), type: 'scatter', mode: 'lines+markers', name: 'Pression (unité persistée)', yaxis: 'y2', line: { color: '#a855f7', width: 2 }, marker: { size: 3 }, connectgaps: false },
        ].filter(Boolean) as any}
        layout={{
          autosize: true, height: 400, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
          margin: { l: 70, r: 70, t: 30, b: 60 },
          xaxis: { title: 'Coordonnée persistée (m ou unité du champ)', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
          yaxis: { title: 'Température — unité persistée', gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#94a3b8' } },
          yaxis2: { title: 'Pression — unité persistée', overlaying: 'y', side: 'right', tickfont: { color: '#94a3b8' } },
          legend: { orientation: 'h', y: -0.2, font: { color: '#fff' } },
        }}
        config={{ responsive: true, displayModeBar: false, displaylogo: false }}
        className="w-full"
      />
    </div>
  )
}
