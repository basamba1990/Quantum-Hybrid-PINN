'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Download,
  TrendingUp,
  Zap,
  Box,
  Activity
} from 'lucide-react'
import PINN3DVisualizer from './pinn-3d-visualizer'

interface Prediction3D {
  time: number
  x: number
  y: number
  z: number
  pressure: number
  velocity_u: number
  velocity_v: number
  velocity_w: number
  temperature: number
  density: number
}

interface AuditData {
  isPhysicallyCoherent: boolean
  credibilityScore: number
  anomalies: string[]
  extractedData: Record<string, number>
  predictions?: Array<{
    time: number
    position: number
    pressure: number
    velocity: number
    temperature: number
  }>
  predictions3d?: Prediction3D[]
  assimilation?: {
    initial_state: number[]
    observation: number[]
    assimilated_state: number[]
  }
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
  const [show3D, setShow3D] = useState(true)

  const getCredibilityLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: 'text-green-600' }
    if (score >= 60) return { level: 'Acceptable', color: 'text-amber-600' }
    return { level: 'Critique', color: 'text-red-600' }
  }

  const credibility = getCredibilityLevel(auditData.credibilityScore)

  return (
    <div className="bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-cyan-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">
                Audit de Cohérence Scientifique V8
              </h2>
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">3D + QNN Ready</span>
            </div>
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
            <div className="text-sm text-slate-600 mb-2">Statut de Validation</div>
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
                  Physiquement Cohérent
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  Anomalies Détectées
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
              Indice de Faisabilité Technique (Modèle V8)
            </span>
            <span className="text-sm font-bold text-slate-800">
              {auditData.credibilityScore.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
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

        {/* 3D Visualization Section */}
        {auditData.predictions3d && auditData.predictions3d.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-600" />
                Analyse de Simulation 3D (V8)
              </h3>
              <button 
                onClick={() => setShow3D(!show3D)}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                {show3D ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            {show3D && (
              <div className="space-y-4">
                <PINN3DVisualizer predictions={auditData.predictions3d} />
                
                {/* Data Assimilation Info */}
                {auditData.assimilation && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                    <h4 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Correction Kalman (DKF)
                    </h4>
                    <p className="text-[10px] text-indigo-700 leading-relaxed">
                      Le filtre de Kalman profond a synchronisé les paramètres extraits avec le modèle PINN. 
                      L'état a été ajusté pour minimiser les résidus de Navier-Stokes.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Extracted Data Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Paramètres Physiques Extraits
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(auditData.extractedData).map(([key, value]) => (
              <div key={key} className="bg-slate-50 rounded p-3 border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                  {key.replace(/_/g, ' ')}
                </div>
                <div className="text-sm font-bold text-slate-800">
                  {typeof value === 'number' ? (
                    value > 1000 ? value.toExponential(2) : value.toFixed(2)
                  ) : value}
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

        {/* Action Buttons */}
        <div className="border-t pt-4 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onDownloadReport}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isLoading ? 'Génération...' : 'Télécharger Rapport Scientifique'}
          </button>
          <button className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            Spécifications V8
          </button>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 text-[10px] text-slate-500 italic">
          <p>
            Analyse certifiée par le moteur Quantum-Hybrid PINN V8. Utilise l'équation d'état de Silvera-Goldman rigoureuse pour l'hydrogène liquide et l'assimilation de données par Deep Kalman Filter.
          </p>
        </div>
      </div>
    </div>
  )
}
