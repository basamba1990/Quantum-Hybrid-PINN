
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project, Report, Analysis } from '@/types'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { 
  ArrowLeft, 
  FileText, 
  BarChart3, 
  Activity,
  Cpu,
  Eye
} from 'lucide-react'

// Imports dynamiques minimaux
const Industrial3DVisualizerEnhancedV5 = dynamic(
  () => import('@/components/industrial-3d-visualizer-enhanced-v5'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-3xl border border-white/10 text-blue-500 animate-pulse">Initializing 3D Engine...</div> }
)

export default function ProjectDetailClient({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [latestAnalysis, setLatestAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) return

        const { data: projectData } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
        setProject(projectData)

        const { data: reportsData } = await supabase.from('reports').select('*').eq('project_id', id).order('created_at', { ascending: false })
        setReports(reportsData || [])

        const { data: analysisData } = await supabase.from('analyses').select('*').eq('project_id', id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle()

        if (analysisData) {
          let processed = { ...analysisData }
          try {
            if (typeof processed.results === 'string') processed.results = JSON.parse(processed.results)
          } catch (e) { 
            console.error('Error parsing analysis results:', e)
            processed.results = {} 
          }
          setLatestAnalysis(processed)
        }

        if (reportsData?.length) setSelectedReport(reportsData[0])
      } catch (err) {
        console.error("Fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, supabase])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
      <div className="h-12 w-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
      <p className="text-xs font-mono text-blue-500 uppercase tracking-widest animate-pulse">Loading Module...</p>
    </div>
  )

  if (!project) return (
    <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center">
      <Activity className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-white">Project Not Found</h2>
      <Link href="/dashboard" className="mt-6 text-blue-500 hover:underline flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
    </div>
  )

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 text-white">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono text-blue-400 uppercase tracking-widest">
          Project ID: {id}
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-[32px] p-10">
        <h1 className="text-5xl font-black tracking-tighter">{project.name}</h1>
        <p className="text-gray-400 text-lg mt-4">{project.description}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-1 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" /> Archives ({reports.length})
          </h2>
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                {r.name}
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-3">
          <Industrial3DVisualizerEnhancedV5 
            data={[]} 
            title="Baseline 3D View"
          />
        </div>
      </div>
    </div>
  )
}
