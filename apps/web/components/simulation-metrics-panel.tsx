'use client'

import React from 'react'
import { Gauge, Droplets, Wind, Zap } from 'lucide-react'

interface MetricsPanelProps {
  data?: {
    pressure?: number;
    temperature?: number;
    density?: number;
    internalEnergy?: number;
    enthalpy?: number;
    velocityMagnitude?: number;
    machNumber?: number;
    reynoldsNumber?: number;
    vorticity?: number;
    turbulentIntensity?: number;
    convergence?: number;
  };
}

export default function SimulationMetricsPanel({ data = {} }: MetricsPanelProps) {
  const metrics = [
    {
      category: 'THERMODYNAMIC PROPERTIES',
      icon: <Zap className="w-4 h-4" />,
      items: [
        { label: 'Pressure', value: data.pressure, unit: 'kPa', color: 'text-blue-400' },
        { label: 'Temperature', value: data.temperature, unit: 'K', color: 'text-red-400' },
        { label: 'Density', value: data.density, unit: 'kg/m³', color: 'text-emerald-400' },
        { label: 'Internal Energy', value: data.internalEnergy, unit: 'MJ/kg', color: 'text-yellow-400' },
        { label: 'Enthalpy', value: data.enthalpy, unit: 'MJ/kg', color: 'text-orange-400' },
      ]
    },
    {
      category: 'FLOW PROPERTIES',
      icon: <Wind className="w-4 h-4" />,
      items: [
        { label: 'Velocity Magnitude', value: data.velocityMagnitude, unit: 'm/s', color: 'text-cyan-400' },
        { label: 'Mach Number', value: data.machNumber, unit: '—', color: 'text-purple-400' },
        { label: 'Reynolds Number', value: data.reynoldsNumber, unit: '—', color: 'text-indigo-400' },
        { label: 'Vorticity', value: data.vorticity, unit: 's⁻¹', color: 'text-pink-400' },
        { label: 'Turbulent Intensity', value: data.turbulentIntensity, unit: '%', color: 'text-rose-400' },
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {metrics.map((section, idx) => (
        <div key={idx} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
            {section.icon}
            {section.category}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {section.items.map((item, i) => (
              <div key={i} className="bg-black/30 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-2">{item.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-black ${item.color}`}>
                    {item.value !== undefined ? item.value.toFixed(2) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono">{item.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Convergence Status */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
            <Gauge className="w-4 h-4" />
            Convergence Status
          </div>
          <div className={`text-xs font-bold px-3 py-1 rounded-full ${data.convergence && data.convergence > 95 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            {data.convergence ? `${data.convergence.toFixed(1)}%` : 'Computing...'}
          </div>
        </div>
        <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-green-500 transition-all duration-300"
            style={{ width: `${Math.min(data.convergence || 0, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
