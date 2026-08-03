'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Activity, Zap, Eye, ShieldCheck } from 'lucide-react'

export default function ProjectDetailClient({ id, project, initialAnalyses }: any) {
  const [analyses, setAnalyses] = useState<any[]>(initialAnalyses || [])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(false)
        const { data } = await supabase
          .from('analyses')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
        if (data) setAnalyses(data)
      } catch (err) {
        console.error('Error:', err)
      }
    }
    if (id) fetchData()
  }, [id, supabase])

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" /> Retour au Dashboard
            </Link>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">
              {project?.name || 'Projet H2 Distribution'}
            </h1>
            <p className="text-gray-400">{project?.description}</p>
          </div>
          <div className="px-6 py-3 bg-blue-600 rounded-xl font-bold uppercase italic flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Mode Sécurité Actif
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div className="h-[500px] bg-slate-900 rounded-[32px] border border-white/10 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <Activity className="w-16 h-16 text-blue-500 animate-pulse" />
              <h2 className="text-2xl font-black uppercase italic">Visualisation en Maintenance</h2>
              <p className="text-gray-400 max-w-md">
                Les données haute pression (70 MPa) sont en cours de recalibrage pour éviter l'exception client-side. 
                L'accès aux archives reste disponible.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6">
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Historique des Analyses</h3>
              <div className="space-y-3">
                {analyses.map((a) => (
                  <div key={a.id} className="bg-black/40 p-4 rounded-xl border border-white/5">
                    <p className="text-[10px] font-mono text-blue-400">{a.id.substring(0,8)}</p>
                    <p className="font-bold text-sm mt-1">{a.name || 'Simulation H2'}</p>
                    <p className="text-[10px] text-gray-500 mt-2">{a.status || 'SUCCESS'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
