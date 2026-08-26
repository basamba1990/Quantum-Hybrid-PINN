'use client'

import React, { useState, useEffect } from 'react'
import { 
  Target, Activity, ShieldCheck, Thermometer, Gauge, Box, 
  TrendingUp, AlertCircle, CheckCircle2, Zap, Wind, Droplets,
  Award, ArrowRight, Info, Lightbulb
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
    total_points_analyzed: number
    critical_distance: number
  }
}

interface EnhancedSweetSpotProps {
  data: SweetSpotData | null
  loading?: boolean
  onRefresh?: () => void
}

export default function SweetSpotAnalysisEnhanced({ data, loading = false, onRefresh }: EnhancedSweetSpotProps) {
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    setIsAnimating(true)
  }, [data])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass-premium rounded-3xl p-8 border-neon-cyan">
          <div className="flex items-center justify-center gap-4 h-48">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/10 border-r-purple-500 animate-spin" style={{ animationDirection: 'reverse' }} />
            </div>
            <div className="space-y-2">
              <p className="text-cyan-400 font-mono text-sm font-bold uppercase tracking-widest">Analysis in progress...</p>
              <p className="text-gray-500 text-xs">Calcul Peng-Robinson EoS + Grille de stabilité</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass-premium rounded-3xl p-8 border-neon-cyan">
        <div className="flex items-center gap-4">
          <Info className="w-6 h-6 text-blue-400 shrink-0" />
          <div>
            <p className="text-white font-bold">No data available</p>
            <p className="text-gray-400 text-sm">Lancez une simulation pour générer l'analyse du Sweet Spot</p>
          </div>
        </div>
      </div>
    )
  }

  const stabilityScore = data.analysis_metadata.stability_score * 100
  const isOptimal = stabilityScore >= 85
  const statusColor = isOptimal ? 'border-neon-cyan' : 'border-neon-orange'
  const statusGlow = isOptimal ? 'animate-glow-cyan' : 'animate-glow-orange'

  return (
    <div className="space-y-6">
      {/* Main Card */}
      <div className={`glass-premium rounded-3xl overflow-hidden ${statusColor} ${statusGlow} transition-all duration-500`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border-b border-white/5 p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
                <Target className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">SWEET SPOT ANALYSIS</h2>
                <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-1">Peng-Robinson EoS | V12.0 Industrial Grade</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${isOptimal ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
              {isOptimal ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className={`text-xs font-bold uppercase tracking-tighter ${isOptimal ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {isOptimal ? 'OPTIMAL' : 'SUB-OPTIMAL'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-bold uppercase tracking-tighter text-orange-400">SUB-OPTIMAL</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Verdict Banner */}
          <div className={`relative rounded-2xl border overflow-hidden p-6 ${isOptimal ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
            <div className="absolute inset-0 opacity-10">
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl ${isOptimal ? 'bg-emerald-500' : 'bg-orange-500'}`} />
            </div>
            <div className="relative flex items-start gap-4">
              {isOptimal ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0 mt-1" />
              ) : (
                <AlertCircle className="w-8 h-8 text-orange-400 shrink-0 mt-1" />
              )}
              <div className="flex-1">
                <p className={`font-bold text-lg mb-2 ${isOptimal ? 'text-emerald-300' : 'text-orange-300'}`}>
                  {isOptimal ? '✓ SWEET SPOT CONFIRMÉ' : '⚠ CONDITIONS SUB-OPTIMALES'}
                </p>
                <p className="text-gray-300 leading-relaxed italic">
                  "{data.analysis_metadata.recommendation}"
                </p>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Temperature */}
            <div className="glass-premium rounded-2xl p-4 border-subtle-glow hover:border-neon-cyan transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Thermometer className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Temperature</span>
              </div>
              <p className="text-2xl font-black text-white font-mono">
                {data.sweet_spot.temperature.toFixed(1)}<span className="text-sm ml-1 text-red-400">K</span>
              </p>
              <p className="text-xs text-gray-500 mt-2 font-mono">
                {(data.sweet_spot.temperature - 273.15).toFixed(1)}°C
              </p>
            </div>

            {/* Pressure */}
            <div className="glass-premium rounded-2xl p-4 border-subtle-glow hover:border-neon-cyan transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pressure</span>
              </div>
              <p className="text-2xl font-black text-white font-mono">
                {(data.sweet_spot.pressure / 1e6).toFixed(2)}<span className="text-sm ml-1 text-blue-400">MPa</span>
              </p>
              <p className="text-xs text-gray-500 mt-2 font-mono">
                {(data.sweet_spot.pressure / 1e5).toFixed(0)} bar
              </p>
            </div>

            {/* Density */}
            <div className="glass-premium rounded-2xl p-4 border-subtle-glow hover:border-neon-cyan transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Density</span>
              </div>
              <p className="text-2xl font-black text-white font-mono">
                {data.sweet_spot.density.toFixed(2)}<span className="text-sm ml-1 text-cyan-400">kg/m³</span>
              </p>
              <p className="text-xs text-gray-500 mt-2 font-mono">État gazeux</p>
            </div>

            {/* Stability Score */}
            <div className="glass-premium rounded-2xl p-4 border-subtle-glow hover:border-neon-cyan transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stabilité</span>
              </div>
              <p className="text-2xl font-black text-white font-mono">
                {stabilityScore.toFixed(1)}<span className="text-sm ml-1 text-emerald-400">%</span>
              </p>
              <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOptimal ? 'bg-gradient-to-r from-cyan-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-yellow-500'
                  }`}
                  style={{ width: `${Math.min(100, stabilityScore)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Domain Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fluid Info */}
            <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
              <div className="flex items-center gap-3 mb-4">
                <Box className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white uppercase tracking-tight text-sm">Fluide Analysé</h3>
              </div>
              <p className="text-lg font-mono text-white mb-2">{data.analysis_metadata.gas}</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Points analysés:</span>
                  <span className="text-gray-300 font-mono">{data.analysis_metadata.total_points_analyzed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance critique:</span>
                  <span className="text-gray-300 font-mono">{(data.analysis_metadata.critical_distance * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Modèle EoS:</span>
                  <span className="text-gray-300 font-mono">Peng-Robinson V12</span>
                </div>
              </div>
            </div>

            {/* Coordinates */}
            <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-white uppercase tracking-tight text-sm">Coordonnées 3D</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">X:</span>
                  <span className="text-cyan-400 font-mono font-bold">{data.sweet_spot.x.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Y:</span>
                  <span className="text-purple-400 font-mono font-bold">{data.sweet_spot.y.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Z:</span>
                  <span className="text-orange-400 font-mono font-bold">{data.sweet_spot.z.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t border-white/5">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="flex-1 glass-premium rounded-xl py-3 px-4 border-subtle-glow hover:border-neon-cyan transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                <Activity className="w-4 h-4 text-cyan-400 group-hover:animate-spin" />
                <span className="text-sm font-bold text-white uppercase tracking-wider">Actualiser</span>
              </button>
            )}
            <button className="flex-1 glass-premium rounded-xl py-3 px-4 border-subtle-glow hover:border-neon-cyan transition-all duration-300 flex items-center justify-center gap-2">
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">Détails</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
