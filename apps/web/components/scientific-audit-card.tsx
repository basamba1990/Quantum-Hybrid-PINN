'use client'

import React, { useState, useMemo } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Download,
  Zap,
  Activity,
  Cpu,
  Database,
  Layers,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import CFDViewer from './cfd/CFDViewer'
import type { CfdBufferDataset } from '@/lib/cfd/cfd-contract'
import type { Prediction3D } from '@/types'

interface ConfidenceMetrics {
  model_confidence: number;
  uncertainty_range: [number, number];
  anomaly_z_score: number;
  ood_detected: boolean;
  physics_violations: number;
}

interface AuditData {
  isPhysicallyCoherent: boolean
  credibilityScore: number
  credibility_score?: number
  anomalies: string[]
  extractedData: Record<string, number>
  predictions3d?: Prediction3D[]
  cfdDataset?: CfdBufferDataset | null
  confidenceMetrics?: ConfidenceMetrics;
  analysisId?: string;
}

interface ScientificAuditCardProps {
  auditData: AuditData
  projectName: string
  onDownloadReport?: () => void
  isLoading?: boolean
  scenarioType?: any
}

export default function ScientificAuditCard({
  auditData,
  projectName,
  onDownloadReport,
  isLoading = false,
  scenarioType,
}: ScientificAuditCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [visualizationType, setVisualizationType] = useState<'trajectory' | 'field'>('field')

  const getCredibilityLevel = (score: number) => {
    if (!Number.isFinite(score)) return { level: 'EVIDENCE-REQUIRED', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' }
    if (score >= 90) return { level: 'INDUSTRIAL-GOLD', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
    if (score >= 75) return { level: 'CERTIFIED-PRO', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
    if (score >= 50) return { level: 'VALIDATION-REQUIRED', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
    return { level: 'CRITICAL-FAILURE', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
  }

  const scoreRaw = auditData.credibilityScore ?? auditData.credibility_score;
  const score = typeof scoreRaw === 'number' ? scoreRaw : (typeof scoreRaw === 'string' ? parseFloat(scoreRaw) : Number.NaN);
  const credibility = getCredibilityLevel(score)

  const sessionId = useMemo(() => auditData.analysisId || 'UNIDENTIFIED_ANALYSIS', [auditData.analysisId]);

  return (
    <div className="bg-[#0B1120] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden backdrop-blur-3xl relative">
      <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
      
      <div className="px-10 py-8 border-b border-white/5 bg-white/[0.02]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-xl border border-blue-500/30">
                <Cpu className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                Scientific Consistency Audit
              </h2>
            </div>
            <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
              <Database className="w-4 h-4" /> {projectName} // REF: {sessionId}
            </p>
          </div>
          
          <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border ${credibility.bg} ${credibility.border}`}>
            <div className="text-right">
              <div className={`text-[10px] font-black uppercase tracking-widest ${credibility.color}`}>Certification Level</div>
              <div className="text-lg font-black text-white">{credibility.level}</div>
            </div>
            {auditData.isPhysicallyCoherent ? (
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-red-400" />
            )}
          </div>
        </div>
      </div>

      <div className="p-10 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Credibility Score</span>
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-white">{Number.isFinite(score) ? score.toFixed(1) : 'N/A'}</span>
              <span className="text-xl font-bold text-gray-600">/100</span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-1000 ${score >= 90 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0}%` }} />
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Physical Consistency</span>
              <Layers className="w-4 h-4 text-emerald-500" />
            </div>
            <div className={`text-3xl font-black ${auditData.isPhysicallyCoherent ? 'text-emerald-400' : 'text-red-400'}`}>
              {auditData.isPhysicallyCoherent ? 'VALIDATED' : 'ANOMALY'}
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">PDE residual analysis performed on the volumetric domain.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Uncertainty (MC)</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-white">
              {auditData.confidenceMetrics ? `${(auditData.confidenceMetrics.uncertainty_range[1] * 100).toFixed(2)}%` : 'N/A'}
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">Statistical uncertainty estimated by stochastic sampling.</p>
          </div>
        </div>

        {auditData.cfdDataset && (
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <div className="w-1 h-8 bg-blue-600 rounded-full" />
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">3D Analytical Visualization</h3>
              </div>
              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                <button onClick={() => setVisualizationType('field')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${visualizationType === 'field' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>SCALAR FIELD</button>
                <button onClick={() => setVisualizationType('trajectory')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${visualizationType === 'trajectory' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>TRAJECTORY</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-black/40 border border-white/10 rounded-[40px] overflow-hidden shadow-inner relative group h-[600px]">
                <CFDViewer dataset={auditData.cfdDataset} className="min-h-[600px]" />
              </div>

              <div className="space-y-6">
                <div className="bg-white/[0.03] border border-white/10 rounded-[32px] p-6 h-full">
                   <p className="text-sm text-gray-400">Historical time series are not displayed here: they must be provided by the versioned CFD contract.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <div className="w-1 h-8 bg-emerald-600 rounded-full" />
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">PINN Output Variables</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(auditData.extractedData)
              .filter(([key]) => !['x', 'y', 'z'].includes(key))
              .map(([key, value]) => (
              <div key={key} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-blue-500/30 transition-all group">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-2 group-hover:text-blue-400 transition-colors">{key.replace(/_/g, ' ')}</div>
                <div className="text-xl font-black text-white">{typeof value === 'number' ? (value > 1000 ? value.toExponential(2) : value.toFixed(3)) : value}</div>
              </div>
            ))}
          </div>
        </div>

        {auditData.anomalies.length > 0 && (
          <div className="border border-red-500/20 rounded-[32px] overflow-hidden bg-red-500/[0.02]">
            <button onClick={() => setShowDetails(!showDetails)} className="w-full px-8 py-6 flex items-center justify-between text-red-400 hover:bg-red-500/[0.05] transition-all">
              <div className="flex items-center gap-4">
                <AlertTriangle className="w-6 h-6" />
                <span className="text-sm font-black uppercase tracking-widest">{auditData.anomalies.length} Scientific Anomaly Detected</span>
              </div>
              {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showDetails && (
              <div className="px-8 pb-8 space-y-3">
                {auditData.anomalies.map((anomaly, idx) => (
                  <div key={idx} className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-4 items-start">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2" />
                    <p className="text-sm text-red-300/80 font-medium leading-relaxed">{anomaly}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button onClick={onDownloadReport} disabled={isLoading} className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-blue-600 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 active:scale-95">
            <Download className="w-5 h-5" />
            {isLoading ? 'Generating...' : 'Export Industrial PDF Report'}
          </button>
        </div>
      </div>
      
      <div className="px-10 py-6 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em]">Certification PINN // Quantum-Hybrid Engine // © 2026</p>
        <div className="flex gap-4">
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
           <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75" />
           <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    </div>
  )
}
