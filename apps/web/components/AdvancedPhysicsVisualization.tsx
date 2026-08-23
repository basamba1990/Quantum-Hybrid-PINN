'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import CFDViewer from '@/components/cfd/CFDViewer'
import { loadCertifiedCfdDataset } from '@/lib/cfd/cfd-repository'
import type { CfdVolumeDataset } from '@/lib/cfd/cfd-contract'

type AdvancedPhysicsProps = {
  simulationId?: string
  time?: number
  data3d?: unknown[]
  scenarioType?: string
  onDataFetch?: (data: unknown) => void
  cfdDataset?: unknown
}

function fieldRows(dataset: CfdVolumeDataset | null, name: string) {
  const field = dataset?.frames[0]?.fields.find((candidate) => candidate.name === name)
  if (!field) return []
  return field.values.map((value, index) => ({ index, value }))
}

export default function AdvancedPhysicsVisualization({
  scenarioType = 'CFD_ANALYSIS',
  cfdDataset,
}: AdvancedPhysicsProps) {
  const [activeTab, setActiveTab] = useState('volumetric')
  const loaded = useMemo(
    () => loadCertifiedCfdDataset({ results: { cfd_dataset: cfdDataset } }),
    [cfdDataset],
  )
  const chartData = useMemo(() => ({
    temperature: fieldRows(loaded.dataset, 'temperature'),
    pressure: fieldRows(loaded.dataset, 'pressure'),
    velocity: fieldRows(loaded.dataset, 'velocity'),
  }), [loaded.dataset])

  if (!loaded.dataset || !loaded.buffers) {
    return (
      <Card className="bg-black border-white/10">
        <CardHeader>
          <CardTitle>CFD contractuel indisponible</CardTitle>
          <CardDescription>
            Aucun dataset cfd-volume.v1 complet n’est disponible pour cette analyse. Les données ponctuelles et les fallbacks synthétiques sont refusés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-400">Statut : UNVALIDATED</p>
          {loaded.report?.issues.map((issue) => <p key={issue.code} className="mt-2 text-xs text-slate-400">{issue.code}: {issue.message}</p>)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black border-white/10 overflow-hidden">
      <CardHeader className="border-b border-white/5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>CFD contractuel — {scenarioType.replace(/_/g, ' ')}</CardTitle>
            <CardDescription>Rendu et profils issus exclusivement de cfd-volume.v1.</CardDescription>
          </div>
          <Badge variant="outline">{loaded.dataset.pointCount.toLocaleString()} points / {loaded.dataset.cellCount.toLocaleString()} cellules</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="volumetric">Vue volumétrique</TabsTrigger>
            <TabsTrigger value="thermal">Température</TabsTrigger>
            <TabsTrigger value="pressure">Pression</TabsTrigger>
            <TabsTrigger value="velocity">Vitesse</TabsTrigger>
          </TabsList>
          <TabsContent value="volumetric"><CFDViewer dataset={loaded.buffers} className="min-h-[600px]" /></TabsContent>
          <TabsContent value="thermal"><ProfileChart data={chartData.temperature} label="Température" unit="K" color="#f87171" /></TabsContent>
          <TabsContent value="pressure"><ProfileChart data={chartData.pressure} label="Pression" unit="Pa" color="#60a5fa" /></TabsContent>
          <TabsContent value="velocity"><ProfileChart data={chartData.velocity} label="Vitesse" unit="m/s" color="#34d399" /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function ProfileChart({ data, label, unit, color }: { data: { index: number; value: number }[]; label: string; unit: string; color: string }) {
  if (!data.length) return <p className="p-8 text-center text-slate-400">Champ {label} indisponible dans le contrat CFD.</p>
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="index" stroke="#94a3b8" />
          <YAxis stroke={color} label={{ value: `${label} (${unit})`, angle: -90, position: 'insideLeft', fill: color }} />
          <Tooltip formatter={(value: number) => [`${value} ${unit}`, label]} />
          <Line type="monotone" dataKey="value" stroke={color} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
