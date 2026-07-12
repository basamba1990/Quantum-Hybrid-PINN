'use client'

import React, { useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DataPoint {
  x: number; y: number; z: number;
  temperature: number; pressure: number;
  density?: number;
  velocity_magnitude?: number;
}

interface ScientificProfileChartProps {
  data: DataPoint[]
  title?: string
  xVariable?: 'x' | 'y' | 'z' | 'distance'
  variables?: string[]
}

/**
 * Composant Graphique 2D Industrial-Gold
 * Affiche les profils spatiaux des propriétés physiques avec cohérence scientifique
 */
const ScientificProfileChart: React.FC<ScientificProfileChartProps> = ({
  data,
  title = "Profil Spatial des Propriétés Physiques",
  xVariable = 'x',
  variables = ['temperature', 'pressure', 'density', 'velocity_magnitude']
}) => {
  const chartData = useMemo(() => {
    if (data.length === 0) return []

    // Trier les données selon la variable X
    const sorted = [...data].sort((a, b) => {
      if (xVariable === 'distance') {
        const distA = Math.sqrt(a.x**2 + a.y**2 + a.z**2)
        const distB = Math.sqrt(b.x**2 + b.y**2 + b.z**2)
        return distA - distB
      }
      return (a as any)[xVariable] - (b as any)[xVariable]
    })

    // Créer les points du graphique
    return sorted.map((p, i) => {
      const point: any = {
        index: i,
        xLabel: xVariable === 'distance' 
          ? `${Math.sqrt(p.x**2 + p.y**2 + p.z**2).toFixed(2)}m`
          : `${(p as any)[xVariable].toFixed(2)}`,
      }

      // Ajouter les variables demandées
      if (variables.includes('temperature')) {
        point.temperature = parseFloat(p.temperature.toFixed(1))
      }
      if (variables.includes('pressure')) {
        point.pressure = parseFloat(p.pressure.toFixed(2))
      }
      if (variables.includes('density')) {
        point.density = p.density ? parseFloat(p.density.toFixed(3)) : 0
      }
      if (variables.includes('velocity_magnitude')) {
        point.velocity = p.velocity_magnitude ? parseFloat(p.velocity_magnitude.toFixed(2)) : 0
      }

      return point
    })
  }, [data, xVariable, variables])

  // Déterminer les limites pour la normalisation
  const stats = useMemo(() => {
    const result: any = {}
    
    variables.forEach(v => {
      const values = chartData.map((d: any) => d[v] || 0).filter(v => v > 0)
      if (values.length > 0) {
        result[v] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        }
      }
    })

    return result
  }, [chartData, variables])

  return (
    <div className="w-full space-y-6 bg-white/[0.03] border border-white/10 rounded-[32px] p-8">
      <div className="space-y-2">
        <h2 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h2>
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
          Profil selon {xVariable === 'distance' ? 'distance radiale' : `coordonnée ${xVariable}`} • {chartData.length} points
        </p>
      </div>

      {/* Graphique Température & Pression */}
      {(variables.includes('temperature') || variables.includes('pressure')) && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-blue-400 uppercase tracking-tight">Thermodynamique</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="xLabel" 
                stroke="rgba(255,255,255,0.3)"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#fff' }} />
              {variables.includes('temperature') && (
                <Line 
                  type="monotone" 
                  dataKey="temperature" 
                  stroke="#ff6b6b" 
                  strokeWidth={2}
                  dot={false}
                  name="Température (K)"
                />
              )}
              {variables.includes('pressure') && (
                <Line 
                  type="monotone" 
                  dataKey="pressure" 
                  stroke="#4ecdc4" 
                  strokeWidth={2}
                  dot={false}
                  name="Pression (MPa)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Graphique Densité & Vitesse */}
      {(variables.includes('density') || variables.includes('velocity_magnitude')) && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-tight">Cinématique</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="xLabel" 
                stroke="rgba(255,255,255,0.3)"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#fff' }} />
              {variables.includes('density') && (
                <Bar 
                  dataKey="density" 
                  fill="#95e1d3" 
                  name="Densité (kg/m³)"
                  opacity={0.8}
                />
              )}
              {variables.includes('velocity_magnitude') && (
                <Bar 
                  dataKey="velocity" 
                  fill="#ffa07a" 
                  name="Vitesse (m/s)"
                  opacity={0.8}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
        {Object.entries(stats).map(([key, value]: [string, any]) => (
          <div key={key} className="bg-white/5 rounded-xl p-4">
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">
              {key === 'temperature' && 'Temp. Moy.'}
              {key === 'pressure' && 'Press. Moy.'}
              {key === 'density' && 'Densité Moy.'}
              {key === 'velocity' && 'Vitesse Moy.'}
            </div>
            <div className="text-lg font-black text-white">
              {value.avg.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-600 mt-1">
              {value.min.toFixed(2)} → {value.max.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ScientificProfileChart
