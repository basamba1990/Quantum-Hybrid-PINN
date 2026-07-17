'use client'

import React, { useState, useCallback } from 'react'
import { Sliders, Play, Pause, RotateCcw, Zap } from 'lucide-react'

interface SimulationParameters {
  flowRate?: number;
  thermalFlux?: number;
  pressure?: number;
  temperature?: number;
  viscosity?: number;
  density?: number;
  timeStep?: number;
}

interface Props {
  onParametersChange?: (params: SimulationParameters) => void;
  isRunning?: boolean;
  onToggleSimulation?: (running: boolean) => void;
  onReset?: () => void;
}

/**
 * REALTIME PARAMETER CONTROLS
 * Permet à l'utilisateur de modifier les paramètres de simulation en temps réel
 * et de voir l'impact immédiat sur les visualisations PINN
 */
const RealtimeParameterControls: React.FC<Props> = ({
  onParametersChange,
  isRunning = false,
  onToggleSimulation,
  onReset
}) => {
  const [params, setParams] = useState<SimulationParameters>({
    flowRate: 0.5,
    thermalFlux: 3.5,
    pressure: 1.0,
    temperature: 293.0,
    viscosity: 1.81e-5,
    density: 1.225,
    timeStep: 0.001
  })

  const [history, setHistory] = useState<SimulationParameters[]>([])

  const handleParameterChange = useCallback((key: keyof SimulationParameters, value: number) => {
    const newParams = { ...params, [key]: value }
    setParams(newParams)
    setHistory([...history, newParams])
    onParametersChange?.(newParams)
  }, [params, history, onParametersChange])

  const handleReset = useCallback(() => {
    const defaultParams: SimulationParameters = {
      flowRate: 0.5,
      thermalFlux: 3.5,
      pressure: 1.0,
      temperature: 293.0,
      viscosity: 1.81e-5,
      density: 1.225,
      timeStep: 0.001
    }
    setParams(defaultParams)
    setHistory([])
    onParametersChange?.(defaultParams)
    onReset?.()
  }, [onParametersChange, onReset])

  const ParameterSlider = ({ 
    label, 
    key, 
    min, 
    max, 
    step, 
    unit, 
    icon: Icon 
  }: { 
    label: string; 
    key: keyof SimulationParameters; 
    min: number; 
    max: number; 
    step: number; 
    unit: string;
    icon: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <span className="text-blue-400">{Icon}</span>
          {label}
        </label>
        <span className="text-xs font-mono text-white bg-white/5 px-2 py-1 rounded">
          {(params[key] as number).toFixed(key === 'viscosity' || key === 'density' ? 2 : 2)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={params[key] as number}
        onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-[9px] text-gray-600">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-500" />
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">
            REALTIME PARAMETERS
          </h3>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${isRunning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
          {isRunning ? '● RUNNING' : '● PAUSED'}
        </span>
      </div>

      {/* Control Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fluid Dynamics */}
        <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <h4 className="text-sm font-bold text-white uppercase">Dynamique des Fluides</h4>
          </div>

          <ParameterSlider
            label="Débit (m³/s)"
            key="flowRate"
            min={0}
            max={2}
            step={0.01}
            unit="m³/s"
            icon={<span>💨</span>}
          />

          <ParameterSlider
            label="Pression (bar)"
            key="pressure"
            min={0.5}
            max={10}
            step={0.1}
            unit="bar"
            icon={<span>📊</span>}
          />

          <ParameterSlider
            label="Viscosité (Pa·s)"
            key="viscosity"
            min={1e-6}
            max={1e-4}
            step={1e-6}
            unit="Pa·s"
            icon={<span>🌊</span>}
          />

          <ParameterSlider
            label="Densité (kg/m³)"
            key="density"
            min={0.5}
            max={2}
            step={0.01}
            unit="kg/m³"
            icon={<span>⚖️</span>}
          />
        </div>

        {/* Thermal & Numerical */}
        <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Zap className="w-4 h-4 text-orange-400" />
            </div>
            <h4 className="text-sm font-bold text-white uppercase">Thermique & Numérique</h4>
          </div>

          <ParameterSlider
            label="Flux Thermique (W/m²)"
            key="thermalFlux"
            min={0}
            max={10}
            step={0.1}
            unit="W/m²"
            icon={<span>🔥</span>}
          />

          <ParameterSlider
            label="Température (K)"
            key="temperature"
            min={250}
            max={350}
            step={1}
            unit="K"
            icon={<span>🌡️</span>}
          />

          <ParameterSlider
            label="Pas de Temps (s)"
            key="timeStep"
            min={0.0001}
            max={0.01}
            step={0.0001}
            unit="s"
            icon={<span>⏱️</span>}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => onToggleSimulation?.(!isRunning)}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-[24px] transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          {isRunning ? (
            <>
              <Pause className="w-5 h-5" />
              PAUSE
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              RUN
            </>
          )}
        </button>

        <button
          onClick={handleReset}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-[24px] border border-white/20 transition-all active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
          RESET
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
            Historique des Modifications
          </p>
          <p className="text-xs text-gray-400">
            {history.length} changement{history.length > 1 ? 's' : ''} appliqué{history.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

export default RealtimeParameterControls
