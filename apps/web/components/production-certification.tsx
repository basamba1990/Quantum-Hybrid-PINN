'use client'

import React from 'react'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

interface CertificationProps {
  convergenceOk: boolean
  physicsOk: boolean
  uncertaintyOk: boolean
  validationOk: boolean
  residualMax?: number
  residualAvg?: number
}

export function ProductionCertification({ 
  convergenceOk, 
  physicsOk, 
  uncertaintyOk, 
  validationOk,
  residualMax = 0,
  residualAvg = 0,
}: CertificationProps) {
  const allOk = convergenceOk && physicsOk && uncertaintyOk && validationOk
  
  return (
    <div className={`p-6 rounded-2xl border ${
      allOk 
        ? 'bg-emerald-500/10 border-emerald-500/30' 
        : 'bg-amber-500/10 border-amber-500/30'
    }`}>
      <div className="flex items-start gap-4">
        {allOk ? (
          <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
        ) : (
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
        )}
        <div className="flex-1">
          <h3 className={`text-lg font-bold ${
            allOk ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {allOk ? '✅ APPROUVÉ POUR PRODUCTION' : '⚠️ À RÉVISER'}
          </h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              {convergenceOk ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">Convergence: {convergenceOk ? 'OK' : 'ÉCHOUÉE'}</span>
            </div>
            <div className="flex items-center gap-2">
              {physicsOk ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">Physique: {physicsOk ? 'VALIDÉE' : 'INVALIDE'}</span>
            </div>
            <div className="flex items-center gap-2">
              {uncertaintyOk ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">Incertitude: {uncertaintyOk ? 'ACCEPTABLE' : 'TROP HAUTE'}</span>
            </div>
            <div className="flex items-center gap-2">
              {validationOk ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">Validation: {validationOk ? 'RÉUSSIE' : 'ÉCHOUÉE'}</span>
            </div>
          </div>
          
          {/* Métriques de convergence */}
          {(residualMax > 0 || residualAvg > 0) && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
              <p className="text-xs font-mono text-gray-400">Métriques de Convergence</p>
              <p className="text-xs text-gray-300">Résidu Max: {residualMax.toExponential(2)}</p>
              <p className="text-xs text-gray-300">Résidu Moy: {residualAvg.toExponential(2)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
