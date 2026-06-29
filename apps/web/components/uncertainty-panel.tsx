'use client'

import React from 'react'
import { AlertCircle, TrendingUp } from 'lucide-react'

interface UncertaintyData {
  overall: number
  temperature?: number
  pressure?: number
  velocity?: number
  convergence?: number
}

interface UncertaintyPanelProps {
  data: UncertaintyData
  threshold?: number
}

export function UncertaintyPanel({ data, threshold = 0.1 }: UncertaintyPanelProps) {
  const isAcceptable = data.overall <= threshold
  const percentUncertainty = (data.overall * 100).toFixed(1)

  return (
    <div className={`p-6 rounded-2xl border ${
      isAcceptable
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : 'bg-amber-500/5 border-amber-500/20'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${
          isAcceptable
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'bg-amber-500/10 text-amber-500'
        }`}>
          <TrendingUp className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-bold ${
            isAcceptable ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            Analyse des Incertitudes
          </h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Incertitude Globale</span>
              <span className={`text-lg font-bold ${
                isAcceptable ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                ±{percentUncertainty}%
              </span>
            </div>

            {/* Barre de progression */}
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isAcceptable ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(data.overall * 1000, 100)}%` }}
              />
            </div>

            {/* Détails par composante */}
            {(data.temperature || data.pressure || data.velocity || data.convergence) && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                <p className="text-xs font-mono text-gray-400 uppercase">Détails par Composante</p>
                {data.temperature && (
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>Température</span>
                    <span className="font-mono">±{(data.temperature * 100).toFixed(1)}%</span>
                  </div>
                )}
                {data.pressure && (
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>Pression</span>
                    <span className="font-mono">±{(data.pressure * 100).toFixed(1)}%</span>
                  </div>
                )}
                {data.velocity && (
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>Vitesse</span>
                    <span className="font-mono">±{(data.velocity * 100).toFixed(1)}%</span>
                  </div>
                )}
                {data.convergence && (
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>Convergence</span>
                    <span className="font-mono">±{(data.convergence * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Message de statut */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-start gap-2">
                <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                  isAcceptable ? 'text-emerald-500' : 'text-amber-500'
                }`} />
                <p className="text-xs text-gray-300">
                  {isAcceptable
                    ? `Les incertitudes sont acceptables (< ${(threshold * 100).toFixed(1)}%)`
                    : `Attention: les incertitudes dépassent le seuil (${(threshold * 100).toFixed(1)}%)`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
