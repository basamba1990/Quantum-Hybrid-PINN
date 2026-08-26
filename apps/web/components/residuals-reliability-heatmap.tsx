'use client'

import React, { useMemo } from 'react'
import { AlertCircle, CheckCircle, TrendingUp } from 'lucide-react'

interface DataPoint {
  x: number;
  y: number;
  z: number;
  residual_continuity?: number;
  residual_momentum?: number;
  residual_energy?: number;
  temperature?: number;
  pressure?: number;
  velocity_magnitude?: number;
  velocity_u?: number; velocity_v?: number; velocity_w?: number;
  density?: number;
  stress?: number; sigma_1?: number; von_mises?: number;
  damage?: number;
}

interface Props {
  data?: DataPoint[];
  title?: string;
}

/**
 * RESIDUALS RELIABILITY HEATMAP
 * Visualise les résidus physiques pour identifier les zones de fiabilité du modèle PINN
 * - Vert : Résidus faibles (modèle très fiable)
 * - Jaune : Résidus modérés (acceptable)
 * - Rouge : Résidus élevés (zone d'incertitude)
 */
const ResidualsReliabilityHeatmap: React.FC<Props> = ({ 
  data = [],
  title = "RESIDUALS RELIABILITY ANALYSIS"
}) => {
  const analysis = useMemo(() => {
    if (!data.length) return null;

    // Calculer les statistiques des résidus
    const continuityResiduals = data.map(p => p.residual_continuity || 0)
    const momentumResiduals = data.map(p => p.residual_momentum || 0)
    const energyResiduals = data.map(p => p.residual_energy || 0)

    const stats = {
      continuity: {
        min: Math.min(...continuityResiduals),
        max: Math.max(...continuityResiduals),
        mean: continuityResiduals.reduce((a, b) => a + b, 0) / continuityResiduals.length,
        std: Math.sqrt(continuityResiduals.reduce((sq, n) => sq + Math.pow(n - (continuityResiduals.reduce((a, b) => a + b, 0) / continuityResiduals.length), 2), 0) / continuityResiduals.length)
      },
      momentum: {
        min: Math.min(...momentumResiduals),
        max: Math.max(...momentumResiduals),
        mean: momentumResiduals.reduce((a, b) => a + b, 0) / momentumResiduals.length,
        std: Math.sqrt(momentumResiduals.reduce((sq, n) => sq + Math.pow(n - (momentumResiduals.reduce((a, b) => a + b, 0) / momentumResiduals.length), 2), 0) / momentumResiduals.length)
      },
      energy: {
        min: Math.min(...energyResiduals),
        max: Math.max(...energyResiduals),
        mean: energyResiduals.reduce((a, b) => a + b, 0) / energyResiduals.length,
        std: Math.sqrt(energyResiduals.reduce((sq, n) => sq + Math.pow(n - (energyResiduals.reduce((a, b) => a + b, 0) / energyResiduals.length), 2), 0) / energyResiduals.length)
      }
    }

    // Calculer le score de fiabilité global (0-100)
    const globalMean = (stats.continuity.mean + stats.momentum.mean + stats.energy.mean) / 3
    const reliabilityScore = Math.max(0, 100 - (globalMean * 1e6)) // Inverse: moins de résidus = plus fiable

    return { stats, reliabilityScore }
  }, [data])

  if (!analysis) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-white/5 border border-white/10 rounded-[32px]">
        <p className="text-gray-500 text-sm">No residual data available</p>
      </div>
    )
  }

  const getReliabilityColor = (residual: number) => {
    if (residual < 1e-6) return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
    if (residual < 1e-5) return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
    return 'bg-red-500/20 border-red-500/30 text-red-400'
  }

  const getReliabilityIcon = (residual: number) => {
    if (residual < 1e-5) return <CheckCircle className="w-4 h-4" />
    return <AlertCircle className="w-4 h-4" />
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h3>
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-500 uppercase">Fiabilité Globale</p>
            <p className="text-2xl font-black text-white">{analysis.reliabilityScore.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Residuals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Continuity Residuals */}
        <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <div className="w-4 h-4 bg-blue-500 rounded" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Continuité</p>
              <p className="text-xs text-blue-400 font-mono">∇·(ρu) = 0</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className={`p-3 rounded-xl border ${getReliabilityColor(analysis.stats.continuity.mean)}`}>
              <div className="flex items-center gap-2 mb-2">
                {getReliabilityIcon(analysis.stats.continuity.mean)}
                <span className="text-[10px] font-bold uppercase">Moyenne</span>
              </div>
              <p className="text-sm font-mono font-bold">{analysis.stats.continuity.mean.toExponential(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-gray-600 uppercase mb-1">Min</p>
                <p className="font-mono text-blue-400">{analysis.stats.continuity.min.toExponential(1)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-gray-600 uppercase mb-1">Max</p>
                <p className="font-mono text-blue-400">{analysis.stats.continuity.max.toExponential(1)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Momentum Residuals */}
        <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <div className="w-4 h-4 bg-purple-500 rounded" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Momentum</p>
              <p className="text-xs text-purple-400 font-mono">ρ(∂u/∂t + u·∇u)</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className={`p-3 rounded-xl border ${getReliabilityColor(analysis.stats.momentum.mean)}`}>
              <div className="flex items-center gap-2 mb-2">
                {getReliabilityIcon(analysis.stats.momentum.mean)}
                <span className="text-[10px] font-bold uppercase">Moyenne</span>
              </div>
              <p className="text-sm font-mono font-bold">{analysis.stats.momentum.mean.toExponential(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-gray-600 uppercase mb-1">Min</p>
                <p className="font-mono text-purple-400">{analysis.stats.momentum.min.toExponential(1)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-gray-600 uppercase mb-1">Max</p>
                <p className="font-mono text-purple-400">{analysis.stats.momentum.max.toExponential(1)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Energy Residuals */}
        <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <div className="w-4 h-4 bg-orange-500 rounded" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Énergie</p>
              <p className="text-xs text-orange-400 font-mono">ρCp(∂T/∂t + u·∇T)</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className={`p-3 rounded-xl border ${getReliabilityColor(analysis.stats.energy.mean)}`}>
              <div className="flex items-center gap-2 mb-2">
                {getReliabilityIcon(analysis.stats.energy.mean)}
                <span className="text-[10px] font-bold uppercase">Moyenne</span>
              </div>
              <p className="text-sm font-mono font-bold">{analysis.stats.energy.mean.toExponential(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-gray-600 uppercase mb-1">Min</p>
                <p className="font-mono text-orange-400">{analysis.stats.energy.min.toExponential(1)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-gray-600 uppercase mb-1">Max</p>
                <p className="font-mono text-orange-400">{analysis.stats.energy.max.toExponential(1)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reliability Legend */}
      <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Légende de Fiabilité</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            <span className="text-xs text-gray-400">Très Fiable (&lt;1e-6)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span className="text-xs text-gray-400">Acceptable (1e-6 - 1e-5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span className="text-xs text-gray-400">À Vérifier (&gt;1e-5)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResidualsReliabilityHeatmap
