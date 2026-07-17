'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Sliders, Play, Pause, RotateCcw, Zap, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

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
  projectId?: string;
}

/**
 * REALTIME PARAMETER CONTROLS - INTERACTIVE TAB
 * Permet à l'utilisateur de modifier les paramètres de simulation en temps réel
 * et de voir l'impact immédiat sur les visualisations PINN via l'API backend
 */
const RealtimeParameterControls: React.FC<Props> = ({
  onParametersChange,
  isRunning = false,
  onToggleSimulation,
  onReset,
  projectId
}) => {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams?.get('projectId') || projectId;
  
  const [params, setParams] = useState<SimulationParameters>({
    flowRate: 0.5,
    thermalFlux: 3.5,
    pressure: 1.0,
    temperature: 293.0,
    viscosity: 1.81e-5,
    density: 1.225,
    timeStep: 0.001
  });

  const [history, setHistory] = useState<SimulationParameters[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleParameterChange = useCallback((key: keyof SimulationParameters, value: number) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    setHistory([...history, newParams]);
    onParametersChange?.(newParams);
    setError(null);
  }, [params, history, onParametersChange]);

  const handleRunSimulation = useCallback(async () => {
    if (!urlProjectId) {
      setError('Project ID not found. Cannot run simulation.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/hybrid/run-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: urlProjectId,
          parameters: params,
          scenario: 'H2_PIPELINE'
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      setJobId(data.jobId);
      setLastUpdate(new Date());
      onToggleSimulation?.(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run simulation';
      setError(message);
      console.error('Simulation error:', err);
    } finally {
      setLoading(false);
    }
  }, [urlProjectId, params, onToggleSimulation]);

  const handleReset = useCallback(() => {
    const defaultParams: SimulationParameters = {
      flowRate: 0.5,
      thermalFlux: 3.5,
      pressure: 1.0,
      temperature: 293.0,
      viscosity: 1.81e-5,
      density: 1.225,
      timeStep: 0.001
    };
    setParams(defaultParams);
    setHistory([]);
    setError(null);
    setJobId(null);
    onParametersChange?.(defaultParams);
    onReset?.();
  }, [onParametersChange, onReset]);

  // Poll job status
  useEffect(() => {
    if (!jobId || !isRunning) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) return;

        const data = await response.json();
        if (data.status === 'completed' || data.status === 'failed') {
          onToggleSimulation?.(false);
          if (data.status === 'failed') {
            setError('Simulation failed on backend');
          }
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId, isRunning, onToggleSimulation]);

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
        disabled={loading || isRunning}
        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="flex justify-between text-[9px] text-gray-600">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );

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
          {isRunning ? '● RUNNING' : loading ? '● LOADING' : '● PAUSED'}
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-[24px] p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">Error</p>
            <p className="text-xs text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Status Info */}
      {lastUpdate && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-[24px] p-3">
          <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">
            Last Update: {lastUpdate.toLocaleTimeString()}
            {jobId && ` • Job: ${jobId.slice(0, 8)}...`}
          </p>
        </div>
      )}

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
          onClick={handleRunSimulation}
          disabled={loading || isRunning}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold rounded-[24px] transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:shadow-none"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              LOADING
            </>
          ) : isRunning ? (
            <>
              <Pause className="w-5 h-5" />
              RUNNING
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              RUN SIMULATION
            </>
          )}
        </button>

        <button
          onClick={handleReset}
          disabled={loading || isRunning}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white font-bold rounded-[24px] border border-white/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};

export default RealtimeParameterControls;
