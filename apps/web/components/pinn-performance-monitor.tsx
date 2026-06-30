'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Activity, Zap, Clock, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'

interface PerformanceMetrics {
  convergenceRate: number           // % de convergence
  computationTime: number           // Temps en secondes
  memoryUsage: number               // Utilisation mémoire en MB
  gpuUtilization: number            // Utilisation GPU en %
  trainingLoss: number              // Loss de l'entraînement PINN
  validationError: number           // Erreur de validation
  residualNorm: number              // Norme des résidus
  quantumCoherence: number          // Cohérence quantique en %
  entanglementDepth: number         // Profondeur d'intrication
  gateErrorRate: number             // Taux d'erreur des portes quantiques
  throughput: number                // Débit de simulation en points/s
  latency: number                   // Latence en ms
  status: 'optimal' | 'good' | 'warning' | 'critical'
}

interface Props {
  metrics?: PerformanceMetrics
  isLive?: boolean
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void
}

const PINNPerformanceMonitor: React.FC<Props> = ({ 
  metrics, 
  isLive = false,
  onMetricsUpdate 
}) => {
  const [displayMetrics, setDisplayMetrics] = useState<PerformanceMetrics>(
    metrics || {
      convergenceRate: 98.64,
      computationTime: 42.178,
      memoryUsage: 1024,
      gpuUtilization: 82,
      trainingLoss: 0.00078,
      validationError: 0.00089,
      residualNorm: 1.32e-6,
      quantumCoherence: 99.92,
      entanglementDepth: 18,
      gateErrorRate: 0.00078,
      throughput: 2470000,
      latency: 2.45,
      status: 'optimal'
    }
  )

  // Simulation des métriques en temps réel
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setDisplayMetrics(prev => {
        const newMetrics: PerformanceMetrics = {
          convergenceRate: Math.min(100, prev.convergenceRate + Math.random() * 0.5),
          computationTime: prev.computationTime + Math.random() * 0.1,
          memoryUsage: Math.max(512, Math.min(2048, prev.memoryUsage + (Math.random() - 0.5) * 50)),
          gpuUtilization: Math.max(0, Math.min(100, prev.gpuUtilization + (Math.random() - 0.5) * 5)),
          trainingLoss: Math.max(0.0001, prev.trainingLoss * (0.99 + Math.random() * 0.02)),
          validationError: Math.max(0.0001, prev.validationError * (0.99 + Math.random() * 0.02)),
          residualNorm: prev.residualNorm * (0.98 + Math.random() * 0.04),
          quantumCoherence: Math.max(95, Math.min(100, prev.quantumCoherence + (Math.random() - 0.5) * 0.2)),
          entanglementDepth: prev.entanglementDepth,
          gateErrorRate: Math.max(0.0001, prev.gateErrorRate * (0.99 + Math.random() * 0.02)),
          throughput: Math.max(1000000, prev.throughput + (Math.random() - 0.5) * 100000),
          latency: Math.max(0.5, prev.latency + (Math.random() - 0.5) * 0.2),
          status: prev.convergenceRate > 99 && prev.gpuUtilization < 85 ? 'optimal' : 'good'
        }
        onMetricsUpdate?.(newMetrics)
        return newMetrics
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [isLive, onMetricsUpdate])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimal': return 'from-emerald-500 to-green-600'
      case 'good': return 'from-blue-500 to-cyan-600'
      case 'warning': return 'from-yellow-500 to-orange-600'
      case 'critical': return 'from-red-500 to-rose-600'
      default: return 'from-gray-500 to-slate-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'optimal':
      case 'good':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />
      default:
        return <Activity className="w-5 h-5 text-gray-400" />
    }
  }

  const MetricCard = ({ label, value, unit, icon: Icon, trend }: any) => (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 hover:border-white/20 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-blue-500" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
            <TrendingUp className="w-3 h-3" />
            {trend}%
          </div>
        )}
      </div>
      <p className="text-2xl font-black text-white">
        {typeof value === 'number' && value > 1000000 
          ? (value / 1e6).toFixed(2) + 'M'
          : typeof value === 'number' && value > 1000
          ? (value / 1e3).toFixed(2) + 'K'
          : typeof value === 'number' && value < 0.001
          ? value.toExponential(2)
          : typeof value === 'number'
          ? value.toFixed(2)
          : value
        }
        <span className="text-sm text-gray-500 ml-2">{unit}</span>
      </p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          PINN Performance Monitor
        </h2>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${getStatusColor(displayMetrics.status)} bg-opacity-10 border border-current border-opacity-20`}>
          {getStatusIcon(displayMetrics.status)}
          <span className="text-xs font-bold uppercase tracking-widest capitalize">
            {displayMetrics.status}
          </span>
          {isLive && <div className="w-2 h-2 rounded-full bg-current animate-pulse ml-2" />}
        </div>
      </div>

      {/* Convergence & Training */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Convergence & Training
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-400">Convergence Rate</span>
                <span className="text-sm font-black text-emerald-400">{displayMetrics.convergenceRate.toFixed(2)}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${displayMetrics.convergenceRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-400">Training Loss</span>
                <span className="text-sm font-mono text-red-400">{displayMetrics.trainingLoss.toExponential(2)}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, displayMetrics.trainingLoss * 1e6)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-400">Validation Error</span>
                <span className="text-sm font-mono text-orange-400">{displayMetrics.validationError.toExponential(2)}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, displayMetrics.validationError * 1e6)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quantum Metrics */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" />
            Quantum Metrics
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-400">Quantum Coherence</span>
                <span className="text-sm font-black text-purple-400">{displayMetrics.quantumCoherence.toFixed(2)}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${displayMetrics.quantumCoherence}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-400">Gate Error Rate</span>
                <span className="text-sm font-mono text-rose-400">{displayMetrics.gateErrorRate.toExponential(2)}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, displayMetrics.gateErrorRate * 1e4)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <span className="text-xs font-bold text-gray-400">Entanglement Depth</span>
              <span className="text-lg font-black text-purple-400">{displayMetrics.entanglementDepth}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Compute Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          label="GPU Utilization"
          value={displayMetrics.gpuUtilization}
          unit="%"
          icon={Zap}
          trend={5}
        />
        <MetricCard 
          label="Memory Usage"
          value={displayMetrics.memoryUsage}
          unit="MB"
          icon={Activity}
          trend={2}
        />
        <MetricCard 
          label="Computation Time"
          value={displayMetrics.computationTime}
          unit="s"
          icon={Clock}
          trend={-1}
        />
        <MetricCard 
          label="Residual Norm"
          value={displayMetrics.residualNorm}
          unit=""
          icon={TrendingUp}
          trend={-3}
        />
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Throughput</h3>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-4xl font-black text-cyan-400">
                {(displayMetrics.throughput / 1e6).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Million Points/s</p>
            </div>
            <div className="flex-1 h-16 bg-white/5 rounded-lg overflow-hidden flex items-end gap-1 p-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-cyan-500 to-blue-500 rounded-sm"
                  style={{ height: `${30 + Math.random() * 70}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Latency</h3>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-4xl font-black text-emerald-400">
                {displayMetrics.latency.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Milliseconds</p>
            </div>
            <div className="flex-1 h-16 bg-white/5 rounded-lg overflow-hidden flex items-end gap-1 p-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-emerald-500 to-green-500 rounded-sm"
                  style={{ height: `${20 + Math.random() * 60}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">System Health</h3>
          <div className="text-xs font-mono text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-xs text-gray-400">Simulation Engine</p>
              <p className="text-sm font-bold text-white">Running Normally</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-xs text-gray-400">Quantum Processor</p>
              <p className="text-sm font-bold text-white">Synchronized</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-xs text-gray-400">Data Pipeline</p>
              <p className="text-sm font-bold text-white">Optimal Flow</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PINNPerformanceMonitor
