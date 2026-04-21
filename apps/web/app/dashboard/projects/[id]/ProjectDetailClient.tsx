'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project, Report } from '@/types'
import PDFViewer from '@/components/pdf-viewer'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { 
  ArrowLeft, 
  FileText, 
  BarChart3, 
  Settings2, 
  Download, 
  Eye, 
  Activity,
  Cpu,
  Database,
  ChevronRight,
  FlaskConical,
  Clock
} from 'lucide-react'

export default function ProjectDetailClient({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })

      setProject(projectData)
      setReports(reportsData || [])
      setLoading(false)
    }

    fetchData()
  }, [id, supabase])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
        <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin" />
      </div>
      <p className="text-xs font-mono text-blue-500 uppercase tracking-widest animate-pulse">Chargement du Module...</p>
    </div>
  )

  if (!project) return (
    <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="p-4 bg-red-500/10 rounded-full mb-4">
        <Activity className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-2xl font-bold text-white">Projet Introuvable</h2>
      <p className="text-gray-400 mt-2">L'identifiant de simulation spécifié est invalide ou a été archivé.</p>
      <Link href="/dashboard" className="mt-6 text-blue-500 hover:underline flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Retour au Nexus
      </Link>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/dashboard" 
          className="group flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-medium"
        >
          <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Retour au Nexus
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono text-blue-400 uppercase tracking-widest">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            Simulation Live
          </div>
          <button className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Title & Info */}
      <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3 text-emerald-500 font-mono text-[10px] uppercase tracking-[0.2em]">
              <Cpu className="w-4 h-4" />
              <span>Module PINN V8.0 // {id.slice(0, 8)}</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white">{project.name}</h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              {project.description || "Aucune description scientifique disponible pour cette unité de simulation."}
            </p>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">Initialisé le {format(new Date(project.created_at), 'dd MMMM yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">Statut: {project.status || 'Actif'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 min-w-[240px]">
            <Link href={`/dashboard/projects/${id}/analyses/new`} className="w-full">
              <button className="w-full group relative px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl overflow-hidden transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-900/20">
                <span className="relative flex items-center justify-center gap-2">
                  <Activity className="w-5 h-5" /> Nouvelle Analyse
                </span>
              </button>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/dashboard/projects/${id}/analyses`} className="flex-1">
                <button className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Analyses
                </button>
              </Link>
              <Link href={`/dashboard/projects/${id}/reports`} className="flex-1">
                <button className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> Rapports
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Reports List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Archives PDF
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-mono text-gray-500">{reports.length} UNITÉS</span>
          </div>
          
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="p-8 rounded-[24px] border border-dashed border-white/10 bg-white/[0.01] text-center">
                <FlaskConical className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">Aucun rapport généré.</p>
                <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-tighter">En attente de validation physique</p>
              </div>
            ) : (
              reports.map((report) => (
                <div 
                  key={report.id}
                  className="group relative p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-blue-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">{report.name}</p>
                      <p className="text-[10px] font-mono text-gray-500 uppercase mt-1">
                        {format(new Date(report.created_at), 'dd.MM.yyyy HH:mm')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
          
          <Link href={`/dashboard/projects/${id}/reports`} className="block">
            <button className="w-full py-4 rounded-2xl border border-white/5 bg-white/[0.02] text-xs font-bold text-gray-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest">
              Gérer les rapports système
            </button>
          </Link>
        </div>

        {/* Right Column: PDF Viewer / Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-500" />
              Aperçu Scientifique
            </h2>
            {reports.length > 0 && (
              <a 
                href={reports[0].file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase tracking-widest"
              >
                <Download className="w-3.5 h-3.5" /> Exporter PDF
              </a>
            )}
          </div>
          
          <div className="relative rounded-[32px] border border-white/10 bg-black/40 overflow-hidden min-h-[600px] flex flex-col items-center justify-center">
            {reports.length > 0 ? (
              <div className="w-full h-full p-4">
                <PDFViewer url={reports[0].file_url} />
              </div>
            ) : (
              <div className="text-center p-12 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center mx-auto">
                    <FileText className="w-10 h-10 text-gray-800" />
                  </div>
                  <div className="absolute inset-0 bg-blue-500/5 blur-2xl rounded-full" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Visualiseur Inactif</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Sélectionnez un rapport d'analyse dans la colonne de gauche pour charger l'aperçu technique.
                  </p>
                </div>
                <Link href={`/dashboard/projects/${id}/analyses/new`}>
                  <Button variant="outline" className="rounded-xl border-white/10 text-xs font-bold uppercase tracking-widest px-8">
                    Générer la première analyse
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
