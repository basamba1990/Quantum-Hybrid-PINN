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
          <CardTitle>CFD contract unavailable</CardTitle>
          <CardDescription>
            No complete cfd-volume.v1 dataset is available for this analysis. Point data and synthetic fallbacks are rejected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-400">Status: UNVALIDATED</p>
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
            <CardTitle>CFD contract — {scenarioType.replace(/_/g, ' ')}</CardTitle>
            <CardDescription>Rendering and profiles sourced exclusively from cfd-volume.v1.</CardDescription>
          </div>
          <Badge variant="outline">{loaded.dataset.pointCount.toLocaleString()} points / {loaded.dataset.cellCount.toLocaleString()} cells</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="volumetric">Volumetric view</TabsTrigger>
            <TabsTrigger value="thermal">Temperature</TabsTrigger>
            <TabsTrigger value="pressure">Pressure</TabsTrigger>
            <TabsTrigger value="velocity">Velocity</TabsTrigger>
          </TabsList>
          <TabsContent value="volumetric"><CFDViewer dataset={loaded.buffers} className="min-h-[600px]" /></TabsContent>
          <TabsContent value="thermal"><ProfileChart data={chartData.temperature} label="Temperature" unit="K" color="#f87171" /></TabsContent>
          <TabsContent value="pressure"><ProfileChart data={chartData.pressure} label="Pressure" unit="Pa" color="#60a5fa" /></TabsContent>
          <TabsContent value="velocity"><ProfileChart data={chartData.velocity} label="Velocity" unit="m/s" color="#34d399" /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function ProfileChart({ data, label, unit, color }: { data: { index: number; value: number }[]; label: string; unit: string; color: string }) {
  if (!data.length) return <p className="p-8 text-center text-slate-400">Field {label} is unavailable in the CFD contract.</p>
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
