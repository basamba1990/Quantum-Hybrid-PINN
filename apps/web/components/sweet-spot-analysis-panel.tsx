'use client'

import {
  Thermometer, Gauge, Info, Droplets, Shield, Target, Award,
} from 'lucide-react'

interface SweetSpotAnalysisPanelProps {
  data?: unknown | null
  loading?: boolean
}

const asRecord = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
)

const finite = (value: unknown): number | undefined => {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const firstFinite = (...values: unknown[]) => values.map(finite).find((value) => value !== undefined)

function UnavailablePanel({ message = 'Les conditions thermodynamiques n’ont pas été calculées ou persistées pour cette analyse.' }: { message?: string }) {
  return (
    <div className="bg-[#0B1120]/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 text-center">
      <Info className="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <h3 className="text-xl font-black uppercase italic tracking-tighter text-gray-400">Sweet Spot analysis unavailable</h3>
      <p className="text-gray-500 text-sm mt-2">{message}</p>
    </div>
  )
}

export default function SweetSpotAnalysisPanel({ data, loading }: SweetSpotAnalysisPanelProps) {
  if (loading) {
    return (
      <div className="bg-[#0B1120]/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 animate-pulse">
        <div className="flex items-center gap-3 mb-8"><div className="w-6 h-6 bg-blue-500/20 rounded-full" /><div className="h-6 w-48 bg-white/10 rounded" /></div>
        <div className="grid grid-cols-4 gap-4 mb-8">{[1, 2, 3, 4].map((item) => <div key={item} className="h-24 bg-white/5 rounded-2xl" />)}</div>
        <div className="h-32 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  const root = asRecord(data)
  const actualData = asRecord(root.sweet_spot_analysis ?? root)
  const hasSweetSpotData = Object.keys(actualData).length > 0 && (
    actualData.operating_point !== undefined ||
    actualData.operatingPoint !== undefined ||
    actualData.thermodynamic_properties !== undefined ||
    actualData.thermodynamicProperties !== undefined ||
    actualData.stability_assessment !== undefined ||
    actualData.stabilityAssessment !== undefined ||
    actualData.verdict !== undefined
  )
  if (!hasSweetSpotData) return <UnavailablePanel />

  const operatingPoint = asRecord(actualData.operating_point ?? actualData.operatingPoint)
  const properties = asRecord(actualData.thermodynamic_properties ?? actualData.thermodynamicProperties)
  const stability = asRecord(actualData.stability_assessment ?? actualData.stabilityAssessment)
  const pressureMPa = firstFinite(operatingPoint.pressure_MPa, operatingPoint.pressureMPa, operatingPoint.pressure_mpa, operatingPoint.pressure_Pa !== undefined ? finite(operatingPoint.pressure_Pa)! / 1e6 : undefined)
  const temperatureK = firstFinite(operatingPoint.temperature_K, operatingPoint.temperatureK, operatingPoint.temperature_k)
  const z = firstFinite(properties.compressibility_factor_Z, properties.compressibilityFactorZ, properties.Z)
  const stabilityScore = firstFinite(stability.stability_score, stability.stabilityScore)
  const stabilityPercent = stabilityScore === undefined ? undefined : stabilityScore <= 1 ? stabilityScore * 100 : stabilityScore
  const riskLevel = typeof stability.risk_level === 'string' ? stability.risk_level : typeof stability.riskLevel === 'string' ? stability.riskLevel : undefined
  const verdict = typeof actualData.verdict === 'string' ? actualData.verdict : undefined
  const certification = typeof actualData.certification === 'string' ? actualData.certification : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400"><Target className="w-5 h-5" /></div>
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Industrial Sweet Spot Analysis</h3>
            <p className="text-xs text-gray-400 font-mono">Results thermodynamiques persistés — unités selon provenance</p>
          </div>
        </div>
        <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest">{certification ?? 'PROVENANCE À VÉRIFIER'}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={<Gauge className="w-4 h-4 text-blue-400" />} label="Pressure" value={pressureMPa === undefined ? 'N/D' : pressureMPa.toFixed(3)} unit="MPa" sub="Valeur persistée" color="blue" />
        <MetricCard icon={<Thermometer className="w-4 h-4 text-red-400" />} label="Temperature" value={temperatureK === undefined ? 'N/D' : temperatureK.toFixed(3)} unit="K" sub="Valeur persistée" color="red" />
        <MetricCard icon={<Droplets className="w-4 h-4 text-purple-400" />} label="Facteur Z" value={z === undefined ? 'N/D' : z.toFixed(5)} unit="" sub="Valeur persistée" color="purple" />
        <MetricCard icon={<Shield className="w-4 h-4 text-emerald-400" />} label="Score stabilité" value={stabilityPercent === undefined ? 'N/D' : stabilityPercent.toFixed(2)} unit="%" sub={riskLevel ?? 'Niveau non persisté'} color="emerald" />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5"><Award className="w-4 h-4" /></div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-white mb-1">Verdict thermodynamique</h4>
          <p className="text-sm text-gray-300 leading-relaxed font-medium">{verdict ?? 'Aucun verdict persisté pour cette analyse.'}</p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, unit, sub, color }: { icon: React.ReactNode; label: string; value: string; unit: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
  }

  return (
    <div className={`p-5 rounded-2xl border backdrop-blur-xl ${colorMap[color] ?? 'border-white/10 bg-white/5 text-white'}`}>
      <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>{icon}</div>
      <div className="flex items-baseline gap-1.5"><span className="text-2xl font-black tracking-tight text-white">{value}</span><span className="text-xs font-bold text-gray-400">{unit}</span></div>
      <div className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-wider">{sub}</div>
    </div>
  )
}
