'use client'

import React from 'react'
import { Shield, Lock, Globe, Zap } from 'lucide-react'

interface SovereigntyScore {
  dataSecurityScore: number
  intellectualPropertyScore: number
  independenceScore: number
  overallSovereigntyIndex: number
}

interface SovereigntyIndicatorProps {
  score: SovereigntyScore
  projectName?: string
}

export default function SovereigntyIndicator({
  score,
}: SovereigntyIndicatorProps) {
  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-green-600'
    if (value >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (value: number) => {
    if (value >= 80) return 'bg-green-50 border-green-200'
    if (value >= 60) return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

  const ScoreCard = ({
    icon: Icon,
    label,
    value,
    description,
  }: {
    icon: React.ReactNode
    label: string
    value: number
    description: string
  }) => (
    <div className={`rounded-lg border-2 p-4 ${getScoreBgColor(value)}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`${getScoreColor(value)}`}>{Icon}</div>
          <h3 className="font-semibold text-slate-800">{label}</h3>
        </div>
        <div className={`text-2xl font-bold ${getScoreColor(value)}`}>
          {value.toFixed(0)}
        </div>
      </div>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-3 w-full bg-slate-300 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            value >= 80
              ? 'bg-green-500'
              : value >= 60
                ? 'bg-amber-500'
                : 'bg-red-500'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Main Sovereignty Index */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Indice de Souveraineté</h2>
          <Shield className="w-8 h-8 opacity-80" />
        </div>
        <p className="text-indigo-100 mb-6">
          Évaluation de la sécurité des données et de l'indépendance technologique
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <div className="text-indigo-100 text-sm mb-1">Score Global</div>
            <div className="text-4xl font-bold">{score.overallSovereigntyIndex.toFixed(0)}</div>
            <div className="text-xs text-indigo-200 mt-2">/100</div>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <div className="text-indigo-100 text-sm mb-1">Région</div>
            <div className="text-xl font-bold">🌍 Afrique</div>
            <div className="text-xs text-indigo-200 mt-2">Données Sécurisées</div>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <div className="text-indigo-100 text-sm mb-1">Statut</div>
            <div className="text-xl font-bold">
              {score.overallSovereigntyIndex >= 70 ? '✓ Conforme' : '⚠ À Améliorer'}
            </div>
            <div className="text-xs text-indigo-200 mt-2">
              {score.overallSovereigntyIndex >= 70
                ? 'Données Protégées'
                : 'Risques Identifiés'}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScoreCard
          icon={<Lock className="w-5 h-5" />}
          label="Sécurité des Données"
          value={score.dataSecurityScore}
          description="Chiffrement, conformité RGPD, hébergement sécurisé"
        />

        <ScoreCard
          icon={<Zap className="w-5 h-5" />}
          label="Propriété Intellectuelle"
          value={score.intellectualPropertyScore}
          description="Brevets, secrets commerciaux, droits d'auteur"
        />

        <ScoreCard
          icon={<Globe className="w-5 h-5" />}
          label="Indépendance Technologique"
          value={score.independenceScore}
          description="Réduction de la dépendance externe, autonomie"
        />
      </div>

      {/* Recommendations */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Recommandations</h3>
        <ul className="space-y-2 text-sm text-slate-700">
          {score.dataSecurityScore < 80 && (
            <li className="flex gap-2">
              <span className="text-amber-600 font-bold">•</span>
              <span>Renforcer les mesures de chiffrement des données</span>
            </li>
          )}
          {score.intellectualPropertyScore < 80 && (
            <li className="flex gap-2">
              <span className="text-amber-600 font-bold">•</span>
              <span>Documenter et protéger les actifs intellectuels</span>
            </li>
          )}
          {score.independenceScore < 80 && (
            <li className="flex gap-2">
              <span className="text-amber-600 font-bold">•</span>
              <span>Développer des capacités technologiques locales</span>
            </li>
          )}
          {score.overallSovereigntyIndex >= 80 && (
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>Excellent niveau de souveraineté technologique</span>
            </li>
          )}
        </ul>
      </div>

      {/* Legal Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-slate-700">
        <p>
          <strong>Conformité Légale:</strong> Ce projet respecte les normes de
          souveraineté numérique africaine et les directives de protection des données.
          Les données sont hébergées localement et ne sont pas transférées hors du
          continent.
        </p>
      </div>
    </div>
  )
}
