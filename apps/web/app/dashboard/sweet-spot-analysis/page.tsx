'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Target, Activity, ShieldCheck, Thermometer, Gauge, Box } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import SweetSpotCard from '@/components/sweet-spot-card'

export default function SweetSpotAnalysisPage() {
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In a real app, this would fetch from an API or Supabase
    // For now, we use the results we generated
    const fetchData = async () => {
      try {
        // Mocking the fetch of the analysis results
        const response = await fetch('/api/admin/sweet-spot-results')
        if (response.ok) {
          const data = await response.json()
          setAnalysisData(data)
        } else {
          // Fallback to static data if API doesn't exist yet
          setAnalysisData({
            "sweet_spot": {
              "x": 0.846,
              "y": 0.0,
              "z": -2.323,
              "temperature": 20.39,
              "pressure": 123376.0,
              "density": 70.8,
              "velocity_magnitude": 0.00089
            },
            "analysis_metadata": {
              "total_points_analyzed": 500,
              "stability_score": 0.95,
              "critical_distance": 0.98,
              "gas": "Liquid Hydrogen (LH2)",
              "recommendation": "Maintenir les conditions de fonctionnement proches de T=20.39K et P=123376.00Pa pour une stabilité maximale."
            }
          })
        }
      } catch (error) {
        console.error("Error fetching analysis:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] space-y-4">
        <div className="h-16 w-16 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        <p className="text-xs font-mono text-blue-500 uppercase tracking-widest animate-pulse">Analyse du Point Idéal en cours...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-gray-400 hover:text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour au Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-mono text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">
            <Activity className="w-3 h-3" />
            Live Analysis
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
            SWEET SPOT ANALYSIS
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Identification assistée par IA du point de fonctionnement optimal pour la stabilité de phase du gaz.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {analysisData && <SweetSpotCard data={analysisData} />}
          
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-400" />
                Détails du Domaine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Fluide</span>
                  <span className="text-white font-mono">{analysisData?.analysis_metadata.gas}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Points Analysés</span>
                  <span className="text-white font-mono">{analysisData?.analysis_metadata.total_points_analyzed}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Modèle EoS</span>
                  <span className="text-white font-mono">Peng-Robinson V12</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] text-gray-500 leading-relaxed uppercase tracking-wider">
                  Cette analyse utilise des réseaux de neurones informés par la physique (PINN) pour interpoler les états de transition de phase et identifier les zones de risque de cavitation ou d'ébullition.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
