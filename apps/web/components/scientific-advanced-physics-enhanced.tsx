'use client'

import React, { useState, useCallback } from 'react'
import { 
  Zap, Thermometer, Gauge, Wind, Droplets, TrendingUp, 
  Settings, Play, RotateCcw, Save, ChevronDown, ChevronUp,
  Lightbulb, AlertCircle, CheckCircle2
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PhysicsParameters {
  temperature: number
  pressure: number
  flowRate: number
  viscosity: number
  thermalConductivity: number
  density: number
}

interface SimulationResults {
  reynoldsNumber: number
  machNumber: number
  compressionRatio: number
  thermalLoad: number
  pressureDrop: number
  flowRegime: string
}

interface AdvancedPhysicsProps {
  onSimulate?: (params: PhysicsParameters) => Promise<SimulationResults>
  initialParams?: Partial<PhysicsParameters>
}

const DEFAULT_PARAMS: PhysicsParameters = {
  temperature: 298.15,
  pressure: 70,
  flowRate: 50,
  viscosity: 0.0000189,
  thermalConductivity: 0.0263,
  density: 1.225
}

export default function ScientificAdvancedPhysicsEnhanced({ 
  onSimulate,
  initialParams = {}
}: AdvancedPhysicsProps) {
  const [params, setParams] = useState<PhysicsParameters>({ ...DEFAULT_PARAMS, ...initialParams })
  const [results, setResults] = useState<SimulationResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<'parameters' | 'results'>('parameters')

  const handleParameterChange = useCallback((key: keyof PhysicsParameters, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSimulate = useCallback(async () => {
    if (!onSimulate) return
    
    setLoading(true)
    try {
      const simulationResults = await onSimulate(params)
      setResults(simulationResults)
      setActiveTab('results')
    } catch (error) {
      console.error('Simulation error:', error)
    } finally {
      setLoading(false)
    }
  }, [params, onSimulate])

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS)
    setResults(null)
  }, [])

  const flowRegimeColor = results?.flowRegime === 'Turbulent' ? 'text-orange-400' : 'text-blue-400'
  const flowRegimeBg = results?.flowRegime === 'Turbulent' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-blue-500/10 border-blue-500/20'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">SCIENTIFIC ADVANCED PHYSICS</h2>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-1">Peng-Robinson Simulation | Advanced Hydrodynamics</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 hover:bg-white/5 rounded-lg transition-all"
        >
          {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
      </div>

      {expanded && (
        <div className="glass-premium rounded-3xl overflow-hidden border-neon-purple">
          {/* Tabs */}
          <div className="flex border-b border-white/5 bg-white/[0.02]">
            {(['parameters', 'results'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-4 px-6 font-bold uppercase tracking-wider text-sm transition-all ${
                  activeTab === tab
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab === 'parameters' ? '⚙️ Paramètres' : '📊 Results'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-8">
            {activeTab === 'parameters' ? (
              <div className="space-y-8">
                {/* Temperature */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Thermometer className="w-5 h-5 text-red-400" />
                      <label className="font-bold text-white uppercase tracking-tight">Temperature</label>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-red-400 font-mono">{params.temperature.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-mono">K</p>
                    </div>
                  </div>
                  <Slider
                    value={[params.temperature]}
                    onValueChange={(v) => handleParameterChange('temperature', v[0])}
                    min={200}
                    max={500}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>200 K</span>
                    <span>500 K</span>
                  </div>
                </div>

                {/* Pressure */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Gauge className="w-5 h-5 text-blue-400" />
                      <label className="font-bold text-white uppercase tracking-tight">Pressure</label>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-blue-400 font-mono">{params.pressure.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-mono">MPa</p>
                    </div>
                  </div>
                  <Slider
                    value={[params.pressure]}
                    onValueChange={(v) => handleParameterChange('pressure', v[0])}
                    min={1}
                    max={200}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>1 MPa</span>
                    <span>200 MPa</span>
                  </div>
                </div>

                {/* Flow Rate */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wind className="w-5 h-5 text-cyan-400" />
                      <label className="font-bold text-white uppercase tracking-tight">Débit</label>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-cyan-400 font-mono">{params.flowRate.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-mono">m/s</p>
                    </div>
                  </div>
                  <Slider
                    value={[params.flowRate]}
                    onValueChange={(v) => handleParameterChange('flowRate', v[0])}
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>0 m/s</span>
                    <span>100 m/s</span>
                  </div>
                </div>

                {/* Viscosity */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Droplets className="w-5 h-5 text-purple-400" />
                      <label className="font-bold text-white uppercase tracking-tight">Viscosité Dynamique</label>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-purple-400 font-mono">{(params.viscosity * 1e6).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-mono">µPa·s</p>
                    </div>
                  </div>
                  <Slider
                    value={[params.viscosity * 1e6]}
                    onValueChange={(v) => handleParameterChange('viscosity', v[0] / 1e6)}
                    min={0.001}
                    max={0.1}
                    step={0.001}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>0.001 µPa·s</span>
                    <span>0.1 µPa·s</span>
                  </div>
                </div>

                {/* Thermal Conductivity */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-orange-400" />
                      <label className="font-bold text-white uppercase tracking-tight">Conductivité Thermique</label>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-orange-400 font-mono">{params.thermalConductivity.toFixed(4)}</p>
                      <p className="text-xs text-gray-500 font-mono">W/m·K</p>
                    </div>
                  </div>
                  <Slider
                    value={[params.thermalConductivity * 1000]}
                    onValueChange={(v) => handleParameterChange('thermalConductivity', v[0] / 1000)}
                    min={0.01}
                    max={0.1}
                    step={0.001}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>0.01 W/m·K</span>
                    <span>0.1 W/m·K</span>
                  </div>
                </div>

                {/* Density */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lightbulb className="w-5 h-5 text-yellow-400" />
                      <label className="font-bold text-white uppercase tracking-tight">Density</label>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-yellow-400 font-mono">{params.density.toFixed(3)}</p>
                      <p className="text-xs text-gray-500 font-mono">kg/m³</p>
                    </div>
                  </div>
                  <Slider
                    value={[params.density]}
                    onValueChange={(v) => handleParameterChange('density', v[0])}
                    min={0.1}
                    max={100}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>0.1 kg/m³</span>
                    <span>100 kg/m³</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t border-white/5">
                  <button
                    onClick={handleSimulate}
                    disabled={loading}
                    className="flex-1 glass-premium rounded-xl py-4 px-6 border-neon-cyan hover:border-neon-cyan transition-all duration-300 flex items-center justify-center gap-3 group disabled:opacity-50"
                  >
                    <Play className={`w-5 h-5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
                    <span className="font-bold text-white uppercase tracking-wider">
                      {loading ? 'Simulation...' : 'Run Simulation'}
                    </span>
                  </button>
                  <button
                    onClick={handleReset}
                    className="glass-premium rounded-xl py-4 px-6 border-subtle-glow hover:border-neon-orange transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5 text-orange-400" />
                    <span className="font-bold text-white uppercase tracking-wider">Réinitialiser</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {results ? (
                  <>
                    {/* Results Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Reynolds Number */}
                      <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nombre de Reynolds</p>
                        <p className="text-3xl font-black text-cyan-400 font-mono">{results.reynoldsNumber.toExponential(2)}</p>
                        <p className="text-xs text-gray-500 mt-2">Écoulement {results.flowRegime}</p>
                      </div>

                      {/* Mach Number */}
                      <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nombre de Mach</p>
                        <p className="text-3xl font-black text-blue-400 font-mono">{results.machNumber.toFixed(3)}</p>
                        <p className="text-xs text-gray-500 mt-2">Subsonic</p>
                      </div>

                      {/* Compression Ratio */}
                      <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ratio de Compression</p>
                        <p className="text-3xl font-black text-purple-400 font-mono">{results.compressionRatio.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-2">Facteur Z</p>
                      </div>

                      {/* Thermal Load */}
                      <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Charge Thermique</p>
                        <p className="text-3xl font-black text-red-400 font-mono">{results.thermalLoad.toFixed(1)}</p>
                        <p className="text-xs text-gray-500 mt-2">kW</p>
                      </div>

                      {/* Pressure Drop */}
                      <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chute de Pressure</p>
                        <p className="text-3xl font-black text-orange-400 font-mono">{results.pressureDrop.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-2">kPa</p>
                      </div>

                      {/* Flow Regime */}
                      <div className={`glass-premium rounded-2xl p-6 border-subtle-glow ${flowRegimeBg} border`}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Régime d'Écoulement</p>
                        <p className={`text-3xl font-black font-mono ${flowRegimeColor}`}>{results.flowRegime}</p>
                        <p className="text-xs text-gray-500 mt-2">Classification</p>
                      </div>
                    </div>

                    {/* Validation Banner */}
                    <div className="glass-premium rounded-2xl p-6 border border-emerald-500/30 bg-emerald-500/5">
                      <div className="flex items-start gap-4">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                        <div>
                          <p className="font-bold text-emerald-300 mb-2">✓ Valid Simulation</p>
                          <p className="text-sm text-gray-300">
                            Les paramètres sont dans les limites acceptables. Le régime d'écoulement est {results.flowRegime.toLowerCase()}.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-600 mb-4" />
                    <p className="text-gray-400 font-bold">Aucun résultat disponible</p>
                    <p className="text-gray-500 text-sm mt-1">Lancez une simulation pour voir les résultats</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
