'use client'

import React, { useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2, TrendingUp } from 'lucide-react'

interface VerificationBadgeProps {
  status: 'idle' | 'loading' | 'coherent' | 'anomaly' | 'impossible'
  score?: number
  anomalies?: string[]
  onExplain?: () => void
}

export default function VerificationBadge({
  status,
  score = 0,
  anomalies = [],
  onExplain,
}: VerificationBadgeProps) {
  const [expanded, setExpanded] = useState(false)

  const getStatusConfig = () => {
    switch (status) {
      case 'coherent':
        return {
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: 'Physiquement Cohérent',
          description: 'Les paramètres respectent les lois physiques',
        }
      case 'anomaly':
        return {
          icon: AlertCircle,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          label: 'Anomalies Détectées',
          description: 'Écarts détectés avec les prédictions PINN',
        }
      case 'impossible':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: 'Physiquement Impossible',
          description: 'Violation des lois physiques fondamentales',
        }
      case 'loading':
        return {
          icon: Loader2,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: 'Vérification en cours...',
          description: 'Analyse des paramètres physiques',
        }
      default:
        return {
          icon: TrendingUp,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Physics-Check',
          description: 'Cliquez pour vérifier la cohérence physique',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div
      className={`rounded-lg border-2 p-4 ${config.bgColor} ${config.borderColor} transition-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon
            className={`w-6 h-6 ${config.color} ${status === 'loading' ? 'animate-spin' : ''}`}
          />
          <div>
            <h3 className={`font-semibold ${config.color}`}>{config.label}</h3>
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>
        </div>
        {score > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800">{score}</div>
            <div className="text-xs text-gray-500">/100</div>
          </div>
        )}
      </div>

      {/* Score Bar */}
      {score > 0 && (
        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Indice de Faisabilité
            </span>
            <span className="text-sm font-semibold text-gray-800">{score}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                score >= 80
                  ? 'bg-green-500'
                  : score >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      )}

      {/* Anomalies Section */}
      {anomalies.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <span>
              {anomalies.length} anomalie{anomalies.length > 1 ? 's' : ''}{' '}
              détectée{anomalies.length > 1 ? 's' : ''}
            </span>
            <span className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {expanded && (
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {anomalies.map((anomaly, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>{anomaly}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {onExplain && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={onExplain}
            className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Explications
          </button>
          <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            Voir le Rapport
          </button>
        </div>
      )}
    </div>
  )
}