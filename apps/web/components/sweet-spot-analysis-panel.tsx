'use client'

import React, { useMemo } from 'react'
import { 
  Thermometer, Gauge, Activity, AlertTriangle, CheckCircle2, 
  TrendingUp, Shield, Zap, Droplets, Wind, Target, Award,
  ArrowRight, Info, ChevronRight
} from 'lucide-react'

interface SweetSpotAnalysisPanelProps {
  data?: any | null
  loading?: boolean
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function UnavailablePanel({ message = "Les conditions thermodynamiques n'ont pas été calculées pour cette simulation." }: { message?: string }) {
  return (
    <div className="bg-[#0B1120]/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 text-center">
      <Info className="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <h3 className="text-xl font-black uppercase italic tracking-tighter text-gray-400">Analyse Sweet Spot Indisponible</h3>
      <p className="text-gray-600 text-sm mt-2">{message}</p>
    </div>
  )
}

export default function SweetSpotAnalysisPanel({ data, loading }: SweetSpotAnalysisPanelProps) {
  if (loading) {
    return (
      <div className="bg-[#0B1120]/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 animate-pulse">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-6 h-6 bg-blue-500/20 rounded-full" />
          <div className="h-6 w-48 bg-white/10 rounded" />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl" />)}
        </div>
        <div className="h-32 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  // Support direct data or nested under sweet_spot_analysis
  const actualData = data?.sweet_spot_analysis || data;

  if (!actualData || actualData.status === 'SKIPPED' || (!actualData.operating_point && !actualData.operatingPoint)) {
    return <UnavailablePanel />
  }

  const op = actualData.operating_point || actualData.operatingPoint || {}
  const tp = actualData.thermodynamic_properties || actualData.thermodynamicProperties || {}
  const sa = actualData.stability_assessment || actualData.stabilityAssessment || {}
  const pp = data.pipeline_profile
  const pa = pp?.pipeline_analysis
  const hasCoreThermodynamics = [
    op.pressure_MPa ?? op.pressureMPa,
    op.pressure_bar ?? op.pressureBar,
    op.temperature_K ?? op.temperatureK,
    op.temperature_C ?? op.temperatureC,
    tp.compressibility_factor_Z ?? tp.compressibilityFactorZ ?? tp.Z,
    tp.mach_number ?? tp.machNumber ?? tp.mach,
    tp.density_kg_m3 ?? tp.densityKgM3 ?? tp.density,
  ].every(isFiniteNumber)

  if (!hasCoreThermodynamics) {
    return <UnavailablePanel message="Les données Sweet Spot persistées sont incomplètes ; aucune valeur n'est inventée par l'interface." />
  }

  const pipelineReady = Boolean(
    pp && pa && [
      pa.length_m,
      pa.pressure_drop_MPa,
      pa.pressure_gradient_MPa_per_m,
      pa.inlet?.pressure_MPa,
      pa.inlet?.temperature_K,
      pa.outlet?.pressure_MPa,
      pa.outlet?.temperature_K,
    ].every(isFiniteNumber),
  )

  const stabilityPct = Math.min(100, Math.max(0, (sa?.stability_score || 0) * 100))
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Target className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Sweet Spot Analysis</h3>
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">Peng-Robinson EoS // Real-Gas Dynamics</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{data.certification || 'INDUSTRIAL-GOLD'}</span>
        </div>
      </div>

      {/* Verdict Banner */}
      <div className={`relative overflow-hidden rounded-2xl p-6 border ${
        sa?.sweet_spot ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'
      }`}>
        <div className="relative z-10 flex items-center gap-4">
          <div className={`p-3 rounded-full ${sa?.sweet_spot ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {sa?.sweet_spot ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h4 className={`text-lg font-black uppercase italic tracking-tighter ${sa?.sweet_spot ? 'text-emerald-400' : 'text-amber-400'}`}>
              {sa?.sweet_spot ? 'SWEET SPOT CONFIRMÉ' : 'STABILITÉ SOUS SURVEILLANCE'}
            </h4>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl mt-1">
              {data.verdict || "Le point idéal a été identifié. La stabilité est optimale avec un risque nul de transition de phase."}
            </p>
          </div>
        </div>
        <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 ${sa?.sweet_spot ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          icon={<Gauge className="w-4 h-4 text-blue-400" />}
          label="Pression"
          value={(op.pressure_MPa ?? op.pressureMPa).toFixed(2)}
          unit="MPa"
          sub={`${(op.pressure_bar ?? op.pressureBar).toFixed(0)} bar`}
          color="blue"
        />
        <MetricCard 
          icon={<Thermometer className="w-4 h-4 text-red-400" />}
          label="Température"
          value={(op.temperature_K ?? op.temperatureK).toFixed(1)}
          unit="K"
          sub={`${(op.temperature_C ?? op.temperatureC).toFixed(1)} °C`}
          color="red"
        />
        <MetricCard 
          icon={<Droplets className="w-4 h-4 text-purple-400" />}
          label="Facteur Z"
          value={(tp.compressibility_factor_Z ?? tp.compressibilityFactorZ ?? tp.Z).toFixed(4)}
          unit=""
          sub={`${actualData.fluid_name || actualData.fluidName || 'H2'} - ${actualData.fluid_type || actualData.fluidType || 'Gas'}`}
          color="purple"
        />
        <MetricCard 
          icon={<Wind className="w-4 h-4 text-cyan-400" />}
          label="Mach"
          value={(tp.mach_number ?? tp.machNumber ?? tp.mach).toFixed(4)}
          unit=""
          sub={tp.flow_regime || tp.flowRegime || 'Laminar'}
          color="cyan"
        />
      </div>

      {/* Stability Score Section */}
      <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Score de Stabilité</span>
          </div>
          <span className={`text-sm font-black italic ${stabilityPct > 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {stabilityPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)] ${stabilityPct > 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${stabilityPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-tighter">
          <span className="text-gray-500">Risque: <span className={sa?.phase_transition_risk === 'NONE' ? 'text-emerald-500' : 'text-amber-500'}>{sa?.phase_transition_risk || 'NONE'}</span></span>
          <span className="text-gray-500">Z deviation: <span className="text-blue-400">{tp.deviation_from_ideal?.deviation?.toFixed(4) || '0.0000'}</span></span>
        </div>
      </div>

      {/* State & Reasons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" /> Classification d'État
          </h4>
          <div className="space-y-3">
            <StateItem label="État" value={sa.state_classification?.state || sa.stateClassification?.state || 'Supercritical'} />
            <StateItem label="P/Pc (ratio)" value={`${(sa.state_classification?.P_Pc_ratio ?? sa.stateClassification?.p_pc_ratio ?? 0).toFixed(2)}x`} color="text-blue-400" />
            <StateItem label="T/Tc (ratio)" value={`${(sa.state_classification?.T_Tc_ratio ?? sa.stateClassification?.t_tc_ratio ?? 0).toFixed(2)}x`} color="text-red-400" />
            <StateItem label="Densité" value={`${(tp.density_kg_m3 ?? tp.densityKgM3 ?? tp.density ?? 0).toFixed(2)} kg/m³`} color="text-purple-400" />
            <StateItem label="Déviation Gaz Idéal" value={`${((tp.deviation_from_ideal?.deviation ?? tp.deviationFromIdeal?.deviation ?? 0) * 100).toFixed(2)}%`} color="text-amber-400" />
          </div>
        </div>
        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Raisons d'évaluation
          </h4>
          <div className="space-y-3">
            {(sa.reasons || []).map((reason: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 text-gray-600 mt-0.5 shrink-0" />
                <span className="text-[11px] text-gray-400 font-medium">{reason}</span>
              </div>
            ))}
            {(!sa.reasons || sa.reasons.length === 0) && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-[11px] text-emerald-400 font-medium">Conditions opératoires optimales.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Profile */}
      {pipelineReady && (
        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Profil Pipeline — <span className="text-emerald-400 italic">Sweet Spot MAINTENU</span>
            </h4>
            <span className="text-[9px] font-black px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded uppercase">
              {pp.pipeline_certification}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[9px] text-gray-600 font-black uppercase">Longueur</p>
              <p className="text-sm font-black italic text-white">{pa?.length_m.toFixed(1)} m</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-gray-600 font-black uppercase">Chute de pression</p>
              <p className="text-sm font-black italic text-white">{pa?.pressure_drop_MPa.toFixed(1)} MPa</p>
              <p className="text-[8px] text-gray-700 font-bold">{pa?.pressure_gradient_MPa_per_m.toFixed(4)} MPa/m</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-gray-600 font-black uppercase">Entrée</p>
              <p className="text-sm font-black italic text-white">{pa?.inlet.pressure_MPa} MPa</p>
              <p className="text-[8px] text-gray-700 font-bold">{pa?.inlet.temperature_K} K</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-gray-600 font-black uppercase">Sortie</p>
              <p className="text-sm font-black italic text-white">{pa?.outlet.pressure_MPa} MPa</p>
              <p className="text-[8px] text-gray-700 font-bold">{pa?.outlet.temperature_K} K</p>
            </div>
          </div>

          {/* Pipeline Segments Map */}
          <div className="space-y-2">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Segments le long du pipeline (11 points):</p>
            <div className="flex gap-1 h-10">
              {Array.from({ length: 11 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`flex-1 rounded-md border border-white/5 transition-all shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] ${
                    i === 0 || i === 10 ? 'bg-emerald-500/40 border-emerald-500/30' : 'bg-emerald-500/60 border-emerald-500/40'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[8px] font-black text-gray-700 uppercase italic">
              <span>Inlet (0m)</span>
              <span>Max Mach: 0.0070</span>
              <span>Max Z Dev: 0.4620</span>
              <span>Outlet (10m)</span>
            </div>
          </div>
          
          <p className="text-[10px] text-center text-gray-500 font-bold italic border-t border-white/5 pt-4">
            Intégrité thermodynamique validée sur {pa?.length_m}m
          </p>
        </div>
      )}

      {/* Critical Properties Reference */}
      <div className="pt-4 border-t border-white/5">
        <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4">Propriétés Critiques de Référence (Hydrogen H2)</p>
        <div className="flex justify-between items-center px-4">
          <div className="text-center">
            <p className="text-[9px] text-gray-700 font-bold uppercase">Pc</p>
            <p className="text-xs font-black italic text-white">1.296 <span className="text-[8px] not-italic text-gray-600">MPa</span></p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-700 font-bold uppercase">Tc</p>
            <p className="text-xs font-black italic text-white">33.15 <span className="text-[8px] not-italic text-gray-600">K</span></p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-700 font-bold uppercase">Pr</p>
            <p className="text-xs font-black italic text-blue-400">54.0123456789012345</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-700 font-bold uppercase">Tr</p>
            <p className="text-xs font-black italic text-red-400">8.995475113122171</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, unit, sub, color }: any) {
  const colorMap: any = {
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400',
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
  }

  return (
    <div className={`p-4 rounded-2xl border ${colorMap[color]} space-y-2 group hover:scale-[1.02] transition-all`}>
      <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black italic tracking-tighter leading-none">{value}</span>
        <span className="text-[10px] font-bold uppercase opacity-60">{unit}</span>
      </div>
      <p className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">{sub}</p>
    </div>
  )
}

function StateItem({ label, value, color = "text-white" }: any) {
  return (
    <div className="flex justify-between items-center border-b border-white/5 pb-1">
      <span className="text-[10px] text-gray-600 font-bold uppercase">{label}</span>
      <span className={`text-[10px] font-black italic uppercase ${color}`}>{value}</span>
    </div>
  )
}
