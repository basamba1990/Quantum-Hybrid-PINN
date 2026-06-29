'use client'

import React from 'react'
import { Clock, User, CheckCircle, AlertCircle } from 'lucide-react'

interface AuditEntry {
  timestamp: string
  action: string
  user?: string
  status: 'success' | 'warning' | 'error'
  details?: string
}

interface AuditTrailProps {
  entries: AuditEntry[]
  title?: string
}

export function AuditTrail({ entries, title = 'Traçabilité Audit' }: AuditTrailProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Aucune entrée audit</p>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border flex items-start gap-3 ${
                entry.status === 'success'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : entry.status === 'warning'
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}
            >
              <div className="mt-0.5">
                {entry.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono text-gray-300">{entry.timestamp}</span>
                  {entry.user && (
                    <>
                      <span className="text-gray-600">•</span>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <User className="w-3 h-3" />
                        {entry.user}
                      </div>
                    </>
                  )}
                </div>
                <p className="text-sm text-white font-medium">{entry.action}</p>
                {entry.details && (
                  <p className="text-xs text-gray-400 mt-1">{entry.details}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-4 border-t border-white/10 text-xs text-gray-500">
        <p>Total: {entries.length} événement{entries.length > 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}
