import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, Thermometer, Gauge, ShieldCheck, Activity } from 'lucide-react'

interface SweetSpotData {
  sweet_spot: {
    temperature: number
    pressure: number
    density: number
    x: number
    y: number
    z: number
  }
  analysis_metadata: {
    stability_score: number
    gas: string
    recommendation: string
  }
}

export default function SweetSpotCard({ data }: { data: SweetSpotData }) {
  return (
    <Card className="bg-black/40 border-blue-500/30 backdrop-blur-xl overflow-hidden group hover:border-blue-500/50 transition-all duration-500">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-50" />
      <CardHeader className="relative border-b border-white/5 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white tracking-tight">Sweet Spot Analysis</CardTitle>
              <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-0.5">V12.0 Industrial Grade</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-tighter">Stable</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-gray-400">
              <Thermometer className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Température Idéale</span>
            </div>
            <p className="text-2xl font-bold text-white font-mono">
              {data.sweet_spot.temperature.toFixed(2)}<span className="text-sm ml-1 text-blue-400">K</span>
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-gray-400">
              <Gauge className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Pression Idéale</span>
            </div>
            <p className="text-2xl font-bold text-white font-mono">
              {(data.sweet_spot.pressure / 1000).toFixed(1)}<span className="text-sm ml-1 text-blue-400">kPa</span>
            </p>
          </div>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Score de Stabilité</span>
            <span className="text-[10px] font-mono text-blue-400">{(data.analysis_metadata.stability_score * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" 
              style={{ width: `${Math.min(100, data.analysis_metadata.stability_score * 100)}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-400">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Recommandation IA</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed italic">
            "{data.analysis_metadata.recommendation}"
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
