/**
 * ============================================================================
 * SWEET SPOT ANALYSIS PANEL — Quantum-Hybrid-PINN
 * Industrial Grade Thermodynamic Stability Visualization
 * Peng-Robinson EoS | ANSYS-level accuracy | Automatically triggered per simulation
 * ============================================================================
 */
'use client'

import React, { useMemo } from 'react'
import { 
  Thermometer, Gauge, Activity, AlertTriangle, CheckCircle2, 
  TrendingUp, Shield, Zap, Droplets, Wind, Target, Award,
  ArrowRight, Info
} from 'lucide-react'

// ============================================================================
// TYPES — Matching backend sweet_spot_analyzer.py output schema
// ============================================================================

interface OperatingPoint {
  pressure_Pa: number
  pressure_MPa: number
  pressure_bar: number
  temperature_K: number
  temperature_C: number
}

interface ThermodynamicProperties {
  compressibility_factor_Z: number
  density_kg_m3: number
  mach_number: number
  reynolds_number_DN300: string
  flow_regime: string
  deviation_from_ideal: {
    deviation: number
    level: string
    description: string
  }
}

interface StateClassification {
  state: string
  P_Pc_ratio: number
  T_Tc_ratio: number
}

interface StabilityAssessment {
  stability_score: number
  phase_transition_risk: string
  reasons: string[]
  state_classification: StateClassification
  sweet_spot: boolean
}

interface PipelineSegment {
  position_m: number
  pressure_MPa: number
  temperature_K: number
  Z: number
  density_kg_m3: number
  mach: number
  stability_score: number
  sweet_spot: boolean
}

interface PipelineAnalysis {
  length_m: number
  inlet: { pressure_MPa: number; temperature_K: number }
  outlet: { pressure_MPa: number; temperature_K: number }
  pressure_drop_MPa: number
  pressure_gradient_MPa_per_m: number
  cooling_K: number
  temperature_gradient_K_per_m: number
}

interface PipelineProfile {
  pipeline_analysis: PipelineAnalysis
  sweet_spot_maintained: boolean
  min_stability_score: number
  max_mach: number
  max_Z_deviation: number
  pipeline_verdict: string
  pipeline_certification: string
  segments: PipelineSegment[]
  critical_properties: { Pc_MPa: number; Tc_K: number }
}

interface SweetSpotData {
  fluid_type: string
  fluid_name: string
  operating_point: OperatingPoint
  thermodynamic_properties: ThermodynamicProperties
  state_classification: StateClassification
  stability_assessment: StabilityAssessment
  verdict: string
  certification: string
  pipeline_profile: PipelineProfile
  generated_at?: string
}

interface SweetSpotAnalysisPanelProps {
  data?: SweetSpotData | null
  loading?: boolean
}

// ============================================================================
// CERTIFICATION BADGE COLORS
// ============================================================================

const CERT_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  'INDUSTRIAL-GOLD': {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  'INDUSTRIAL-SILVER': {
    bg: 'bg-gray-400/10',
    border: 'border-gray-400/40',
    text: 'text-gray-300',
    glow: 'shadow-gray-400/20',
  },
  'INDUSTRIAL-BRONZE': {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    glow: 'shadow-orange-500/20',
  },
}

const RISK_COLORS: Record<string, string> = {
  NONE: 'text-emerald-400',
  LOW: 'text-yellow-400',
  MODERATE: 'text-orange-400',
  HIGH: 'text-red-400',
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SweetSpotAnalysisPanel({ data, loading }: SweetSpotAnalysisPanelProps) {
  // If no data provided, show placeholder
  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <h3 className="text-lg font-bold text-white">Analyse Sweet Spot en cours...</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Calcul Peng-Robinson EoS + Grille de stabilité...
        </div>
      </div>
    )
  }

  if (!data || data.status === 'SKIPPED') {
    return (
      <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-bold text-white">Analyse Sweet Spot</h3>
        </div>
        <p className="text-gray-500 text-sm">
          L'analyse de stabilité thermodynamique n'est pas disponible pour cette simulation.
        </p>
      </div>
    )
  }

  const certColor = CERT_COLORS[data.certification] || CERT_COLORS['INDUSTRIAL-BRONZE']
  const op = data.operating_point
  const tp = data.thermodynamic_properties
  const sa = data.stability_assessment
  const pp = data.pipeline_profile
  const pa = pp.pipeline_analysis

  // Stability bar percentage
  const stabilityPct = useMemo(() => Math.min(100, Math.max(0, sa.stability_score * 100)), [sa.stability_score])
  const stabilityColor = stabilityPct >= 85 ? 'bg-emerald-500' : stabilityPct >= 60 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-6">
      {/* Header with Certification */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Sweet Spot Analysis</h3>
          <span className="text-xs text-gray-500 font-mono">Peng-Robinson EoS</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${certColor.bg} ${certColor.border} ${certColor.text}`}>
          <Award className="w-4 h-4" />
          <span className="text-xs font-bold tracking-wide">{data.certification}</span>
        </div>
      </div>

      {/* Verdict Banner */}
      <div className={`bg-gradient-to-r ${
        sa.sweet_spot ? 'from-emerald-900/30 to-green-900/30' : 'from-amber-900/20 to-orange-900/20'
      } border ${sa.sweet_spot ? 'border-emerald-500/30' : 'border-amber-500/30'} rounded-xl p-4`}>
        <div className="flex items-center gap-3">
          {sa.sweet_spot ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
          )}
          <div>
            <p className={`font-bold text-lg ${sa.sweet_spot ? 'text-emerald-300' : 'text-amber-300'}`}>
              {sa.sweet_spot ? 'SWEET SPOT CONFIRMÉ' : 'Conditions sub-optimales'}
            </p>
            <p className="text-sm text-gray-400 mt-1">{data.verdict}</p>
          </div>
        </div>
      </div>

      {/* Operating Point Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={<Gauge className="w-4 h-4" />}
          label="Pression"
          value={`${op.pressure_MPa.toFixed(2)} MPa`}
          sub={`${op.pressure_bar.toFixed(0)} bar`}
          color="text-blue-400"
        />
        <MetricCard
          icon={<Thermometer className="w-4 h-4" />}
          label="Température"
          value={`${op.temperature_K.toFixed(1)} K`}
          sub={`${op.temperature_C.toFixed(1)} °C`}
          color="text-red-400"
        />
        <MetricCard
          icon={<Droplets className="w-4 h-4" />}
          label="Facteur Z"
          value={tp.compressibility_factor_Z.toFixed(4)}
          sub={`${data.fluid_type} — ${data.fluid_name}`}
          color="text-purple-400"
        />
        <MetricCard
          icon={<Wind className="w-4 h-4" />}
          label="Mach"
          value={tp.mach_number.toFixed(4)}
          sub={tp.flow_regime}
          color="text-cyan-400"
        />
      </div>

      {/* Stability Score Bar */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Score de Stabilité
          </span>
          <span className={`text-sm font-bold ${
            stabilityPct >= 85 ? 'text-emerald-400' : stabilityPct >= 60 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {stabilityPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${stabilityColor}`}
            style={{ width: `${stabilityPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Risque: <span className={RISK_COLORS[sa.phase_transition_risk] || 'text-gray-400'}>{sa.phase_transition_risk}</span></span>
          <span>Z déviation: {tp.deviation_from_ideal.deviation.toFixed(4)} ({tp.deviation_from_ideal.level})</span>
        </div>
      </div>

      {/* State Classification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Classification d'État
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">État thermodynamique</span>
              <span className="text-xs font-mono text-white">{sa.state_classification.state}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">P/Pc (ratio pression)</span>
              <span className="text-xs font-mono text-blue-400">{sa.state_classification.P_Pc_ratio}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">T/Tc (ratio température)</span>
              <span className="text-xs font-mono text-red-400">{sa.state_classification.T_Tc_ratio}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Densité</span>
              <span className="text-xs font-mono text-purple-400">{tp.density_kg_m3.toFixed(4)} kg/m³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Déviation du gaz idéal</span>
              <span className="text-xs font-mono text-amber-400">{(tp.deviation_from_ideal.deviation * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Raisons d'évaluation
          </h4>
          <div className="space-y-2">
            {sa.reasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 text-gray-600 mt-0.5 shrink-0" />
                <span className="text-xs text-gray-400">{reason}</span>
              </div>
            ))}
            {sa.reasons.length === 0 && (
              <p className="text-xs text-emerald-400">Conditions optimales — supercritique stable</p>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Profile */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Profil Pipeline — {pp.sweet_spot_maintained ? (
              <span className="text-emerald-400">Sweet Spot MAINTENU</span>
            ) : (
              <span className="text-amber-400">Surveillance requise</span>
            )}
          </h4>
          <span className={`text-xs font-bold px-2 py-1 rounded ${
            pp.pipeline_certification === 'INDUSTRIAL-GOLD' ? 'bg-amber-500/10 text-amber-400' :
            pp.pipeline_certification === 'INDUSTRIAL-SILVER' ? 'bg-gray-400/10 text-gray-300' :
            'bg-orange-500/10 text-orange-400'
          }`}>
            {pp.pipeline_certification}
          </span>
        </div>

        {/* Pipeline metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Longueur</p>
            <p className="text-sm font-bold text-white">{pa.length_m.toFixed(1)} m</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Chute de pression</p>
            <p className="text-sm font-bold text-white">{pa.pressure_drop_MPa.toFixed(1)} MPa</p>
            <p className="text-xs text-gray-600">{pa.pressure_gradient_MPa_per_m.toFixed(4)} MPa/m</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Entrée</p>
            <p className="text-sm font-bold text-white">{pa.inlet.pressure_MPa} MPa</p>
            <p className="text-xs text-gray-600">{pa.inlet.temperature_K} K</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Sortie</p>
            <p className="text-sm font-bold text-white">{pa.outlet.pressure_MPa} MPa</p>
            <p className="text-xs text-gray-600">{pa.outlet.temperature_K} K</p>
          </div>
        </div>

        {/* Segments mini-map */}
        <div className="space-y-1">
          <p className="text-xs text-gray-500 mb-2">Segments le long du pipeline ({pp.segments.length} points):</p>
          <div className="flex gap-0.5 h-8 rounded overflow-hidden">
            {pp.segments.map((seg, idx) => {
              const color = seg.sweet_spot ? 'bg-emerald-500' : seg.stability_score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
              return (
                <div
                  key={idx}
                  className={`${color} flex-1 min-w-0`}
                  title={`Pos: ${seg.position_m}m | P: ${seg.pressure_MPa}MPa | Z: ${seg.Z.toFixed(3)} | Score: ${seg.stability_score.toFixed(2)}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Entrée (0m)</span>
            <span>Max Mach: {pp.max_mach.toFixed(4)}</span>
            <span>Max |Z-1|: {pp.max_Z_deviation.toFixed(4)}</span>
            <span>Sortie ({pa.length_m}m)</span>
          </div>
        </div>

        {/* Verdict */}
        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-white/5">
          <p className="text-xs text-gray-400">{pp.pipeline_verdict}</p>
        </div>
      </div>

      {/* Critical Properties Reference */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
        <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          Propriétés critiques de référence ({data.fluid_name})
        </h4>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <p className="text-xs text-gray-600">Pc</p>
            <p className="text-xs font-mono text-white">
              {(pp.critical_properties.Pc_MPa).toFixed(3)} MPa
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Tc</p>
            <p className="text-xs font-mono text-white">
              {pp.critical_properties.Tc_K.toFixed(2)} K
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">P/Pc</p>
            <p className="text-xs font-mono text-blue-400">
              {data.operating_point.pressure_MPa / pp.critical_properties.Pc_MPa}x
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">T/Tc</p>
            <p className="text-xs font-mono text-red-400">
              {data.operating_point.temperature_K / pp.critical_properties.Tc_K}x
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT: Metric Card
// ============================================================================

function MetricCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-white font-mono">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  )
}
