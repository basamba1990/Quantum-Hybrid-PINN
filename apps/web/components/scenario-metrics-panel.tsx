'use client'

import React from 'react'
import { Gauge, Droplets, Wind, Zap, AlertTriangle, Shield } from 'lucide-react'

interface ScenarioMetricsPanelProps {
  scenarioType: 'H2_PIPELINE' | 'LH2_STORAGE' | 'PORT_ENERGY_OPTIMIZATION' | 'PIPELINE_SAFETY' | 'CRYOGENIC_TRANSPORT' | 'MINING_INDUSTRIAL_SIM' | 'ROCK_ELAST_STRESS' | 'H2_COMPRESSION_STATION';
  data?: Record<string, any>;
}

export default function ScenarioMetricsPanel({ scenarioType, data = {} }: ScenarioMetricsPanelProps) {
  
  const getMetricsForScenario = () => {
    switch (scenarioType) {
      case 'H2_PIPELINE':
        return {
          title: 'Pipeline Hydrogène - Analyse Thermodynamique',
          icon: <Wind className="w-4 h-4" />,
          sections: [
            {
              category: 'HYDRAULIQUE',
              items: [
                { label: 'Chute de Pression', value: data.pressureDrop, unit: 'bar', color: 'text-blue-400' },
                { label: 'Vitesse d\'écoulement', value: data.velocity, unit: 'm/s', color: 'text-cyan-400' },
                { label: 'Turbulence (Re)', value: data.turbulence, unit: '%', color: 'text-purple-400' },
              ]
            },
            {
              category: 'THERMIQUE & SÉCURITÉ',
              items: [
                { label: 'Stabilité Thermale', value: data.thermalStability, unit: 'K', color: 'text-red-400' },
                { label: 'Risque de Fuite', value: data.leakRisk, unit: '%', color: 'text-orange-400' },
                { label: 'Score Sécurité', value: data.safetyScore, unit: '/100', color: 'text-emerald-400' },
              ]
            }
          ]
        }
      
      case 'LH2_STORAGE':
        return {
          title: 'Stockage Hydrogène Liquéfié - Cryogénie',
          icon: <Droplets className="w-4 h-4" />,
          sections: [
            {
              category: 'ÉVAPORATION & PRESSION',
              items: [
                { label: 'Taux d\'évaporation', value: data.boilOffRate, unit: '%/jour', color: 'text-blue-400' },
                { label: 'Pression Interne', value: data.internalPressure, unit: 'bar', color: 'text-cyan-400' },
                { label: 'Vitesse Convection', value: data.convectionVelocity, unit: 'm/s', color: 'text-purple-400' },
              ]
            },
            {
              category: 'STABILITÉ',
              items: [
                { label: 'Score de Stabilité', value: data.stabilityScore, unit: '/100', color: 'text-emerald-400' },
              ]
            }
          ]
        }
      
      case 'PORT_ENERGY_OPTIMIZATION':
        return {
          title: 'Optimisation Énergétique Portuaire',
          icon: <Zap className="w-4 h-4" />,
          sections: [
            {
              category: 'EFFICACITÉ ÉNERGÉTIQUE',
              items: [
                { label: 'Efficacité Énergétique', value: data.energyEfficiency, unit: '%', color: 'text-blue-400' },
                { label: 'Réduction Coûts', value: data.costReduction, unit: '%', color: 'text-green-400' },
                { label: 'Empreinte Carbone', value: data.carbonFootprint, unit: 'tonnes CO₂', color: 'text-red-400' },
                { label: 'Optimisation HVAC', value: data.hvacOptimization, unit: '%', color: 'text-yellow-400' },
              ]
            }
          ]
        }
      
      case 'PIPELINE_SAFETY':
        return {
          title: 'Sécurité Pipeline - Détection & Prédiction',
          icon: <Shield className="w-4 h-4" />,
          sections: [
            {
              category: 'DÉTECTION & PRÉDICTION',
              items: [
                { label: 'Temps de Détection', value: data.detectionTime, unit: 's', color: 'text-blue-400' },
                { label: 'Précision Prédiction', value: data.predictionAccuracy, unit: '%', color: 'text-green-400' },
                { label: 'Réduction Risque', value: data.riskReduction, unit: '%', color: 'text-emerald-400' },
                { label: 'Stabilité Opérationnelle', value: data.operationalStability, unit: '/100', color: 'text-cyan-400' },
              ]
            }
          ]
        }
      
      case 'CRYOGENIC_TRANSPORT':
        return {
          title: 'Transport Cryogénique - Pertes Thermiques',
          icon: <Droplets className="w-4 h-4" />,
          sections: [
            {
              category: 'THERMIQUE & SÉCURITÉ',
              items: [
                { label: 'Perte Thermique', value: data.thermalLoss, unit: 'W', color: 'text-blue-400' },
                { label: 'Perte Évaporation', value: data.evaporationLoss, unit: 'kg', color: 'text-red-400' },
                { label: 'Sécurité Conteneur', value: data.containerSafety, unit: '/100', color: 'text-emerald-400' },
              ]
            }
          ]
        }
      
      case 'MINING_INDUSTRIAL_SIM':
        return {
          title: 'Simulation Minière - Ventilation & Sécurité',
          icon: <Wind className="w-4 h-4" />,
          sections: [
            {
              category: 'VENTILATION & SÉCURITÉ',
              items: [
                { label: 'Qualité de l\'air', value: data.airQuality, unit: '/100', color: 'text-blue-400' },
                { label: 'Confort Thermique', value: data.thermalComfort, unit: '°C', color: 'text-orange-400' },
                { label: 'Sécurité Gaz', value: data.gasSafety, unit: '/100', color: 'text-emerald-400' },
                { label: 'Circulation Fluide', value: data.fluidCirculation, unit: 'm³/h', color: 'text-cyan-400' },
              ]
            }
          ]
        }
      
      case 'ROCK_ELAST_STRESS':
        return {
          title: 'Contrainte Élastique Rocheuse - Géomécanique',
          icon: <AlertTriangle className="w-4 h-4" />,
          sections: [
            {
              category: 'CONTRAINTE & ENDOMMAGEMENT',
              items: [
                { label: 'Pression Lithostatique', value: data.lithostaticPressure, unit: 'MPa', color: 'text-blue-400' },
                { label: 'Contrainte Maximale', value: data.maxStress, unit: 'MPa', color: 'text-red-400' },
                { label: 'Indice d\'Endommagement', value: data.damageIndex, unit: '0-1', color: 'text-orange-400' },
                { label: 'Score de Stabilité', value: data.stabilityScore, unit: '/100', color: 'text-emerald-400' },
              ]
            }
          ]
        }
      
      case 'H2_COMPRESSION_STATION':
        return {
          title: 'Station de Compression H₂ - Bilan Thermodynamique',
          icon: <Zap className="w-4 h-4" />,
          sections: [
            {
              category: 'COMPRESSION & EFFICACITÉ',
              items: [
                { label: 'Rapport de Compression', value: data.compressionRatio, unit: '—', color: 'text-blue-400' },
                { label: 'Efficacité Isentropique', value: data.isentropicEfficiency, unit: '%', color: 'text-green-400' },
                { label: 'Puissance Réelle', value: data.powerActual, unit: 'MW', color: 'text-purple-400' },
                { label: 'Delta Thermique', value: data.thermalDelta, unit: 'K', color: 'text-orange-400' },
              ]
            },
            {
              category: 'COHÉRENCE PHYSIQUE',
              items: [
                { label: 'Score de Cohérence', value: data.coherenceScore, unit: '/100', color: 'text-emerald-400' },
                { label: 'Statut', value: data.status === 'ANOMALIE' ? '⚠️ ANOMALIE' : '✅ NORMAL', unit: '', color: data.status === 'ANOMALIE' ? 'text-red-400' : 'text-emerald-400' },
              ]
            }
          ]
        }
      
      default:
        return {
          title: 'Métriques Générales',
          icon: <Gauge className="w-4 h-4" />,
          sections: []
        }
    }
  }

  const metrics = getMetricsForScenario()

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/20 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-2">
          {metrics.icon}
          <h2 className="text-lg font-bold text-white">{metrics.title}</h2>
        </div>
        <p className="text-xs text-gray-400">Scénario : <span className="font-mono text-blue-400">{scenarioType}</span></p>
      </div>

      {metrics.sections.map((section, idx) => (
        <div key={idx} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            {section.category}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {section.items.map((item, i) => (
              <div key={i} className="bg-black/30 rounded-2xl p-4 border border-white/5 hover:border-white/20 transition-colors">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-2">{item.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-black ${item.color}`}>
                    {item.value !== undefined && item.value !== null ? (
                      typeof item.value === 'number' ? item.value.toFixed(2) : item.value
                    ) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono">{item.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Avertissement si données manquantes */}
      {Object.keys(data).length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
          <p className="text-yellow-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Aucune donnée disponible. Lancez une simulation pour voir les résultats.
          </p>
        </div>
      )}
    </div>
  )
}
