'use client'

import React, { useState, useCallback } from 'react'
import { 
  Zap, Brain, Target, AlertCircle, CheckCircle2, 
  Lightbulb, TrendingUp, Wind, Droplets, Gauge,
  Send, Loader2, Copy, Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AnalysisResult {
  sweetSpotDetected: boolean
  confidence: number
  zone: {
    temperatureRange: [number, number]
    pressureRange: [number, number]
    densityRange: [number, number]
  }
  risks: string[]
  recommendations: string[]
  summary: string
}

interface AIAnalyzerProps {
  onAnalyze?: (jsonData: string) => Promise<AnalysisResult>
  initialData?: string
}

export default function AISweetSpotAnalyzer({ onAnalyze, initialData = '' }: AIAnalyzerProps) {
  const [jsonInput, setJsonInput] = useState(initialData)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleAnalyze = useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      // Valider le JSON
      JSON.parse(jsonInput)

      if (onAnalyze) {
        const analysisResult = await onAnalyze(jsonInput)
        setResult(analysisResult)
      } else {
        // Analyse locale de démonstration
        const data = JSON.parse(jsonInput)
        const mockResult: AnalysisResult = {
          sweetSpotDetected: true,
          confidence: 0.92,
          zone: {
            temperatureRange: [290, 310],
            pressureRange: [65, 75],
            densityRange: [38, 42]
          },
          risks: [],
          recommendations: [
            'Maintenir la température entre 290 K et 310 K',
            'Pression optimale: 70 MPa',
            'Éviter les variations rapides de pression'
          ],
          summary: 'Le Sweet Spot a été identifié avec une confiance de 92%. La zone de stabilité est bien définie.'
        }
        setResult(mockResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse')
    } finally {
      setLoading(false)
    }
  }, [jsonInput, onAnalyze])

  const handleCopy = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [result])

  const handleDownload = useCallback(() => {
    if (result) {
      const element = document.createElement('a')
      element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(result, null, 2)))
      element.setAttribute('download', 'sweet-spot-analysis.json')
      element.style.display = 'none'
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    }
  }, [result])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
          <Brain className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">AI SWEET SPOT ANALYZER</h2>
          <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-1">Détection Automatique IA | Analyse Thermodynamique</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="glass-premium rounded-3xl overflow-hidden border-neon-purple">
        <div className="p-8 space-y-6">
          {/* Input Section */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-white uppercase tracking-wider">
              Données JSON de Résultats
            </label>
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"temperature": 298.15, "pressure": 70000000, "density": 40.0, ...}'
              className="min-h-32 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-purple-500/50 focus:ring-purple-500/20 font-mono text-sm"
            />
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading || !jsonInput.trim()}
            className="w-full glass-premium rounded-xl py-4 px-6 border-neon-cyan hover:border-neon-cyan transition-all duration-300 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                <span className="font-bold text-white uppercase tracking-wider">Analyse en cours...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 text-cyan-400" />
                <span className="font-bold text-white uppercase tracking-wider">Analyser avec IA</span>
              </>
            )}
          </button>

          {/* Results Section */}
          {result && (
            <div className="space-y-6 border-t border-white/5 pt-6">
              {/* Status Banner */}
              <div className={`rounded-2xl border overflow-hidden p-6 ${
                result.sweetSpotDetected 
                  ? 'border-emerald-500/30 bg-emerald-500/5' 
                  : 'border-orange-500/30 bg-orange-500/5'
              }`}>
                <div className="flex items-start gap-4">
                  {result.sweetSpotDetected ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0 mt-1" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-orange-400 shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <p className={`font-bold text-lg mb-2 ${result.sweetSpotDetected ? 'text-emerald-300' : 'text-orange-300'}`}>
                      {result.sweetSpotDetected ? '✓ SWEET SPOT DÉTECTÉ' : '⚠ SWEET SPOT NON DÉTECTÉ'}
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {result.summary}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-2 w-32 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            result.confidence >= 0.8 ? 'bg-emerald-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${result.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-400">
                        Confiance: {(result.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sweet Spot Zone */}
              <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
                <h3 className="font-bold text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  Zone de Stabilité Optimale
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Température</p>
                    <p className="text-lg font-mono text-red-400 font-bold">
                      {result.zone.temperatureRange[0].toFixed(1)} - {result.zone.temperatureRange[1].toFixed(1)} K
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Pression</p>
                    <p className="text-lg font-mono text-blue-400 font-bold">
                      {result.zone.pressureRange[0].toFixed(1)} - {result.zone.pressureRange[1].toFixed(1)} MPa
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Densité</p>
                    <p className="text-lg font-mono text-cyan-400 font-bold">
                      {result.zone.densityRange[0].toFixed(1)} - {result.zone.densityRange[1].toFixed(1)} kg/m³
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="glass-premium rounded-2xl p-6 border-subtle-glow">
                  <h3 className="font-bold text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                    Recommandations IA
                  </h3>
                  <ul className="space-y-3">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 shrink-0" />
                        <p className="text-sm text-gray-300">{rec}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {result.risks.length > 0 && (
                <div className="glass-premium rounded-2xl p-6 border border-orange-500/20 bg-orange-500/5">
                  <h3 className="font-bold text-orange-300 uppercase tracking-tight mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Risques Détectés
                  </h3>
                  <ul className="space-y-2">
                    {result.risks.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-orange-200">
                        <span className="shrink-0">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Export Buttons */}
              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button
                  onClick={handleCopy}
                  className="flex-1 glass-premium rounded-xl py-3 px-4 border-subtle-glow hover:border-neon-cyan transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white uppercase tracking-wider">
                    {copied ? 'Copié !' : 'Copier'}
                  </span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 glass-premium rounded-xl py-3 px-4 border-subtle-glow hover:border-neon-cyan transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white uppercase tracking-wider">Télécharger</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
