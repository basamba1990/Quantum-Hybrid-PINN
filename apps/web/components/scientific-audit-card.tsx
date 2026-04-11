'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Download,
  TrendingUp,
  Zap,
} from 'lucide-react'

interface AuditData {
  isPhysicallyCoherent: boolean
  credibilityScore: number
  anomalies: string[]
  extractedData: Record<string, number>
  predictions: Array<{
    time: number
    position: number
    pressure: number
    velocity: number
    temperature: number
  }>
}

interface ScientificAuditCardProps {
  auditData: AuditData
  projectName: string
  onDownloadReport?: () => void
  isLoading?: boolean
}

export default function ScientificAuditCard({
  auditData,
  projectName,
  onDownloadReport,
  isLoading = false,
}: ScientificAuditCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  const getCredibilityLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: 'text-green-600' }
    if (score >= 60) return { level: 'Acceptable', color: 'text-amber-600' }
    return { level: 'Critique', color: 'text-red-600' }
  }

  const credibility = getCredibilityLevel(auditData.credibilityScore)

  return (
    <div className="bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Audit de Cohérence Scientifique
            </h2>
            <p className="text-indigo-100 text-sm mt-1">{projectName}</p>
          </div>
          {auditData.isPhysicallyCoherent ? (
            <ShieldCheck className="w-8 h-8 text-green-300" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-red-300" />
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-2">Statut</div>
            <div
              className={`text-lg font-bold flex items-center gap-2 ${
                auditData.isPhysicallyCoherent
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {auditData.isPhysicallyCoherent ? (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Validé
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  Anomalies
                </>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-2">Score de Crédibilité</div>
            <div className={`text-lg font-bold ${credibility.color}`}>
              {auditData.credibilityScore.toFixed(1)}/100
            </div>
            <div className="text-xs text-slate-500 mt-1">{credibility.level}</div>
          </div>
        </div>

        {/* Credibility Bar */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">
              Indice de Faisabilité Technique
            </span>
            <span className="text-sm font-bold text-slate-800">
              {auditData.credibilityScore.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                auditData.credibilityScore >= 80
                  ? 'bg-green-500'
                  : auditData.credibilityScore >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${auditData.credibilityScore}%` }}
            />
          </div>
        </div>

        {/* Extracted Data Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Paramètres Physiques Extraits
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(auditData.extractedData).map(([key, value]) => (
              <div key={key} className="bg-slate-50 rounded p-3 border border-slate-200">
                <div className="text-xs text-slate-600 capitalize">
                  {key.replace(/_/g, ' ')}
                </div>
                <div className="text-sm font-bold text-slate-800">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomalies Section */}
        {auditData.anomalies.length > 0 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-900 w-full"
            >
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span>
                {auditData.anomalies.length} anomalie
                {auditData.anomalies.length > 1 ? 's' : ''} détectée
                {auditData.anomalies.length > 1 ? 's' : ''}
              </span>
              <span
                className={`ml-auto transform transition-transform ${
                  showDetails ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>

            {showDetails && (
              <ul className="mt-3 space-y-2">
                {auditData.anomalies.map((anomaly, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-red-700 bg-red-50 rounded p-2 flex gap-2 border border-red-200"
                  >
                    <span className="font-bold text-red-600 flex-shrink-0">•</span>
                    <span>{anomaly}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* PINN Predictions Summary */}
        {auditData.predictions.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Prédictions PINN (5 points de validation)
            </h3>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left py-2 px-2 font-semibold text-slate-700">
                      Temps (s)
                    </th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-700">
                      Pos.
                    </th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-700">
                      P (bar)
                    </th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-700">
                      V (m/s)
                    </th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-700">
                      T (K)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.predictions.map((pred, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-2 px-2">{pred.time.toFixed(1)}</td>
                      <td className="py-2 px-2">{pred.position.toFixed(2)}</td>
                      <td className="py-2 px-2">
                        {(pred.pressure / 1e5).toFixed(1)}
                      </td>
                      <td className="py-2 px-2">{pred.velocity.toFixed(2)}</td>
                      <td className="py-2 px-2">{pred.temperature.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t pt-4 flex gap-3">
          <button
            onClick={onDownloadReport}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isLoading ? 'Génération...' : 'Télécharger Rapport PDF'}
          </button>
          <button className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            Détails Techniques
          </button>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 text-xs text-slate-500">
          <p>
            Rapport généré par SpotBulle Science-Verify utilisant des Physics-Informed
            Neural Networks (PINNs) et l'équation d'état de Redlich-Kwong.
          </p>
        </div>
      </div>
    </div>
  )
}