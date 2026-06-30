'use client'

import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingDown } from 'lucide-react'

interface ResidualsChartProps {
  data?: Array<{
    iteration: number;
    continuity?: number;
    xMomentum?: number;
    yMomentum?: number;
    zMomentum?: number;
    turbulentKE?: number;
  }>;
}

export default function ResidualsChart({ data = [] }: ResidualsChartProps) {
  // Générer des données de démonstration si aucune donnée n'est fournie
  const chartData = useMemo(() => {
    if (data.length > 0) return data

    // Données de démonstration avec convergence réaliste
    return Array.from({ length: 50 }, (_, i) => ({
      iteration: i + 1,
      continuity: Math.pow(10, -1 - i * 0.08),
      xMomentum: Math.pow(10, -0.5 - i * 0.07),
      yMomentum: Math.pow(10, -0.6 - i * 0.075),
      zMomentum: Math.pow(10, -0.7 - i * 0.08),
      turbulentKE: Math.pow(10, -0.3 - i * 0.06),
    }))
  }, [data])

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
        <TrendingDown className="w-4 h-4" />
        Residuals Convergence
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
          <XAxis 
            dataKey="iteration" 
            stroke="#666666"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            scale="log" 
            stroke="#666666"
            style={{ fontSize: '12px' }}
            domain={[1e-8, 1]}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #444' }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: any) => value?.toExponential(2) || 'N/A'}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line 
            type="monotone" 
            dataKey="continuity" 
            stroke="#3b82f6" 
            dot={false} 
            strokeWidth={2}
            name="Continuity"
            isAnimationActive={false}
          />
          <Line 
            type="monotone" 
            dataKey="xMomentum" 
            stroke="#10b981" 
            dot={false} 
            strokeWidth={2}
            name="X-Momentum"
            isAnimationActive={false}
          />
          <Line 
            type="monotone" 
            dataKey="yMomentum" 
            stroke="#f59e0b" 
            dot={false} 
            strokeWidth={2}
            name="Y-Momentum"
            isAnimationActive={false}
          />
          <Line 
            type="monotone" 
            dataKey="zMomentum" 
            stroke="#8b5cf6" 
            dot={false} 
            strokeWidth={2}
            name="Z-Momentum"
            isAnimationActive={false}
          />
          <Line 
            type="monotone" 
            dataKey="turbulentKE" 
            stroke="#ec4899" 
            dot={false} 
            strokeWidth={2}
            name="Turbulent KE"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-5 gap-2 text-[10px] font-mono text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Continuity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>X-Mom</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Y-Mom</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Z-Mom</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-pink-500" />
          <span>Turb KE</span>
        </div>
      </div>
    </div>
  )
}
