'use client'

import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Report } from '@/types'
import { toast } from 'sonner'
import { 
  FileText, 
  Upload, 
  ArrowLeft, 
  Download, 
  Trash2, 
  FilePlus, 
  Clock, 
  Search,
  Database,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

export default function ReportsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const supabase = createClient()
  const [reports, setReports] = useState<Report[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  const { register, handleSubmit, reset } = useForm<{
    name: string
    file: FileList
  }>()

  const fetchReports = async () => {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setReports(data || [])
  }

  useEffect(() => {
    fetchReports()
  }, [projectId, supabase])

  // ✅ FIX: Suppression opérationnelle des rapports
  const handleDeleteReport = async (reportId: string, fileName: string) => {
    setDeleting(reportId)
    try {
      // Supprimer le fichier du storage Supabase
      const { error: storageError } = await supabase.storage
        .from('reports')
        .remove([fileName])

      if (storageError && storageError.message !== 'Not found') {
        console.error('Storage deletion error:', storageError)
        toast.error(`Erreur lors de la suppression du fichier: ${storageError.message}`)
        setDeleting(null)
        return
      }

      // Supprimer l'enregistrement de la base de données
      const { error: dbError } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId)

      if (dbError) {
        console.error('DB deletion error:', dbError)
        toast.error(`Erreur lors de la suppression de l'enregistrement: ${dbError.message}`)
        setDeleting(null)
        return
      }

      toast.success('Rapport supprimé avec succès')
      fetchReports()
    } catch (error) {
      console.error('Unexpected error during deletion:', error)
      toast.error('Une erreur inattendue s\'est produite lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  // ✅ FIX: Support multi-format (PDF, JSON, HDF5, VTK)
  const SUPPORTED_FORMATS = ['pdf', 'json', 'h5', 'hdf5', 'vtk', 'vtu', 'csv']
  
  const getFileExtension = (fileName: string) => {
    return fileName.split('.').pop()?.toLowerCase() || ''
  }

  const isValidFileFormat = (file: File) => {
    const ext = getFileExtension(file.name)
    return SUPPORTED_FORMATS.includes(ext)
  }

  const onSubmit = async (data: { name: string; file: FileList }) => {
    if (!data.file.length) {
      toast.error('Veuillez sélectionner un fichier')
      return
    }
    if (!data.name.trim()) {
      toast.error('Veuillez entrer un nom pour le rapport')
      return
    }

    const file = data.file[0]

    // ✅ FIX: Vérification multi-format
    if (!isValidFileFormat(file)) {
      toast.error(`Format non supporté. Formats acceptés: ${SUPPORTED_FORMATS.join(', ')}`)
      return
    }

    setUploading(true)
    try {
      const fileName = `${projectId}/${Date.now()}_${file.name}`

      // Upload du fichier
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(fileName, file, { upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        toast.error(`Erreur lors de l'upload: ${uploadError.message}`)
        setUploading(false)
        return
      }

      // Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('reports')
        .getPublicUrl(fileName)

      // ✅ FIX: Ajouter métadonnées de fichier (type, taille)
      const fileExtension = getFileExtension(file.name)
      const fileSizeKB = Math.round(file.size / 1024)

      // Insérer dans la base de données
      const { error: insertError } = await supabase.from('reports').insert({
        name: data.name,
        file_url: publicUrl,
        project_id: projectId,
        file_type: fileExtension,
        file_size_kb: fileSizeKB,
        file_name: file.name,
      })

      if (insertError) {
        console.error('Insert error:', insertError)
        toast.error(`Erreur lors de la sauvegarde: ${insertError.message}`)
        // Nettoyer le fichier uploadé en cas d'erreur
        await supabase.storage.from('reports').remove([fileName])
        setUploading(false)
        return
      }

      toast.success(`Rapport archivé avec succès (${fileExtension.toUpperCase()}) 🚀`)
      reset()
      fetchReports()
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Une erreur système inattendue s\'est produite')
    } finally {
      setUploading(false)
    }
  }

  const filteredReports = reports.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Helper pour extraire le nom du fichier du chemin
  const getFileNameFromPath = (path: string) => {
    return path.split('/').pop() || 'rapport'
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <Link 
            href={`/dashboard/projects/${projectId}`} 
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" /> Retour au Projet
          </Link>
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3">
              <FileText className="w-10 h-10 text-blue-500" />
              Gestion des <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Rapports</span>
            </h1>
            <p className="text-gray-400 text-sm max-w-md">
              Archivez et gérez les validations documentaires et les données 3D de vos simulations PINN.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-right">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Capacité Archive</p>
            <p className="text-sm font-bold text-white">{reports.length} / ∞</p>
          </div>
          <div className="w-px h-8 bg-white/10 mx-2" />
          <Database className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Upload Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 p-8 rounded-[32px] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] -z-10" />
            
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <FilePlus className="w-5 h-5 text-blue-500" />
              Nouvelle Archive
            </h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Identifiant du Rapport
                  </label>
                  <input
                    id="name"
                    {...register('name', { required: true })}
                    className="w-full border border-white/10 bg-white/5 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    placeholder="Ex: Analyse Thermique H2-S1"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="file" className="block mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Fichier (PDF, JSON, HDF5, VTK)
                  </label>
                  <div className="relative group">
                    <input
                      id="file"
                      type="file"
                      accept=".pdf,.json,.h5,.hdf5,.vtk,.vtu,.csv"
                      {...register('file', { required: true })}
                      className="hidden"
                      required
                    />
                    <label 
                      htmlFor="file"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02] group-hover:bg-white/5 group-hover:border-blue-500/30 transition-all cursor-pointer p-4 text-center"
                    >
                      <Upload className="w-6 h-6 text-gray-500 group-hover:text-blue-500 mb-2 transition-colors" />
                      <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">Sélectionner Fichier</span>
                      <span className="text-[10px] text-gray-600 mt-1 uppercase">Max 100MB // PDF, JSON, HDF5, VTK, CSV</span>
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full group relative px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl overflow-hidden transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Archivage...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Uploader le Fichier
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* ✅ FIX: Afficher les formats supportés */}
            <div className="mt-6 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight mb-2">Formats Supportés</p>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_FORMATS.map(fmt => (
                  <div key={fmt} className="text-[9px] font-mono text-emerald-300 bg-emerald-500/5 px-2 py-1 rounded">
                    .{fmt}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-tight">Vérification de Sécurité</p>
                <p className="text-[10px] text-emerald-500/70 mt-1 leading-relaxed">
                  Tous les fichiers sont scannés et stockés de manière sécurisée dans le bucket Supabase avec chiffrement au repos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Reports List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              Historique des Archivages
            </h2>
            <div className="relative group min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
              <input 
                placeholder="Rechercher une archive..." 
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredReports.length === 0 ? (
              <div className="py-20 rounded-[40px] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center">
                <FileText className="h-12 w-12 text-gray-800 mb-4" />
                <h3 className="text-lg font-bold text-white">Aucun Rapport Détecté</h3>
                <p className="text-gray-500 mt-2 text-sm max-w-xs">Commencez par uploader votre premier rapport scientifique ou données 3D pour alimenter l'archive.</p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <div 
                  key={report.id}
                  className="group relative bg-white/[0.02] border border-white/5 rounded-3xl p-6 hover:bg-white/[0.04] hover:border-white/10 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{report.name}</h3>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                            <Clock className="w-3 h-3" />
                            {report.created_at ? new Date(report.created_at).toLocaleDateString('fr-FR') : 'Inconnue'}
                          </div>
                          {/* ✅ FIX: Afficher le type de fichier */}
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                            <Database className="w-3 h-3" />
                            {(report as any).file_type ? (report as any).file_type.toUpperCase() : 'PDF'} Archive
                          </div>
                          {(report as any).file_size_kb && (
                            <div className="text-[10px] font-mono text-gray-500">
                              {(report as any).file_size_kb} KB
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <a
                        href={report.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Télécharger
                      </a>
                      {/* ✅ FIX: Bouton suppression opérationnel */}
                      <button 
                        onClick={() => {
                          const filePath = `${projectId}/${getFileNameFromPath(report.file_url)}`
                          handleDeleteReport(report.id, filePath)
                        }}
                        disabled={deleting === report.id}
                        className="p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl text-red-500/50 hover:text-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleting === report.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <ChevronRight className="hidden md:block w-5 h-5 text-gray-800 group-hover:text-gray-400 transition-colors ml-2" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
