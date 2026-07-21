'use client'

import { useState, useEffect, use, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Play, ArrowLeft, Download, Activity, ShieldCheck, Zap } from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { jsPDF } from 'jspdf'
// jspdf-autotable v5.x extends jsPDF prototype automatically on import
import 'jspdf-autotable'

const VerificationBadge = dynamic(
  () => import('@/components/verification-badge'),
  { ssr: false, loading: () => <div className="p-4 bg-white/5 rounded-xl">Vérification en cours...</div> }
)
const ScientificAuditCard = dynamic(
  () => import('@/components/scientific-audit-card'),
  { ssr: false, loading: () => <div className="p-8 bg-white/5 rounded-2xl animate-pulse">Chargement du module d'audit...</div> }
)
const SovereigntyIndicator = dynamic(
  () => import('@/components/sovereignty-indicator'),
  { ssr: false, loading: () => null }
)

interface Project {
  id: string
  name: string
  description: string
  video_url: string
  transcription: string
}

interface AuditData {
  isPhysicallyCoherent: boolean
  credibilityScore: number
  anomalies: string[]
  extractedData: Record<string, number>
  predictions?: any[]
  predictions3d?: any[]
  assimilation?: any
}

export default function ProjectAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] space-y-4">
        <div className="h-16 w-16 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        <p className="text-xs font-mono text-blue-500 uppercase tracking-widest animate-pulse">Initialisation du Module d'Analyse...</p>
      </div>
    }>
      <AnalysisContent id={id} />
    </Suspense>
  )
}

function AnalysisContent({ id }: { id: string }) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [auditData, setAuditData] = useState<AuditData | null>(null)
  const [sovereigntyScore, setSovereigntyScore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'loading' | 'coherent' | 'anomaly' | 'impossible'>('idle')
  const supabase = createClient()

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single()

        if (projectError || !projectData) {
          console.warn('Project not found, redirecting to dashboard:', projectError)
          toast.error('Projet non trouvé')
          router.push('/dashboard')
          return
        }

        setProject(projectData)

        // Fetch existing audit if available
        const { data: analysisData, error: analysisError } = await supabase
          .from('analyses')
          .select('*')
          .eq('project_id', id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!analysisError && analysisData) {
          let results: any = analysisData.results || {}
          if (typeof results === 'string') {
            try { results = JSON.parse(results) } catch { results = {} }
          }
          const score = Number(analysisData.credibility_score || results?.credibilityScore || results?.score || 0)
          
          setAuditData({
            isPhysicallyCoherent: score > 50,
            credibilityScore: score,
            anomalies: Array.isArray(results?.anomalies) ? results.anomalies : [],
            extractedData: results?.extractedParams || results?.extractedData || {},
            predictions: Array.isArray(results?.predictions3d) ? results.predictions3d : [],
            predictions3d: Array.isArray(results?.predictions3d) ? results.predictions3d : [],
            assimilation: results?.assimilation || null,
          })
          
          setVerificationStatus(
            score > 50
              ? 'coherent'
              : (Array.isArray(results?.anomalies) && results.anomalies.length > 0 ? 'anomaly' : 'impossible')
          )
        }

        // Fetch sovereignty score safely
        try {
          const { data: sovereigntyData } = await supabase
            .from('sovereignty_scores')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (sovereigntyData) {
            setSovereigntyScore({
              dataSecurityScore: Number(sovereigntyData.data_security_score || 0),
              intellectualPropertyScore: Number(sovereigntyData.intellectual_property_score || 0),
              independenceScore: Number(sovereigntyData.independence_score || 0),
              overallSovereigntyIndex: Number(sovereigntyData.overall_sovereignty_index || 0),
            })
          }
        } catch (sovereigntyErr) {
          console.warn('Sovereignty scores fetch failed (non-critical):', sovereigntyErr)
        }
      } catch (error) {
        console.error('Error fetching project:', error)
        toast.error('Erreur lors du chargement du projet')
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [id, supabase, router])

  const handlePhysicsCheck = async () => {
    setVerifying(true)
    try {
      router.push(`/dashboard/projects/${id}/analyses/new`)
    } catch (err) {
      console.error('Navigation error:', err)
    } finally {
      setVerifying(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!auditData || !project) {
      toast.error('Données d\'audit non disponibles')
      return
    }

    setDownloading(true)
    try {
      const doc = new jsPDF()
      
      // Header with dark background
      doc.setFillColor(10, 10, 20)
      doc.rect(0, 0, 210, 40, 'F')
      doc.setFontSize(22)
      doc.setTextColor(255, 255, 255)
      doc.text('RAPPORT D\'AUDIT SCIENTIFIQUE QUANTUM-PINN', 20, 25)
      
      // Project info
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(14)
      doc.text(`Projet : ${project.name}`, 20, 55)
      doc.text(`Date : ${new Date().toLocaleDateString()}`, 20, 65)
      doc.text(`ID Simulation : ${id.slice(0, 8)}`, 20, 75)
      
      // Score section
      doc.setFontSize(16)
      doc.text('Évaluation de la Crédibilité Physique', 20, 95)
      
      const score = auditData.credibilityScore || 0
      if (score >= 80) doc.setTextColor(16, 185, 129)
      else if (score >= 50) doc.setTextColor(245, 158, 11)
      else doc.setTextColor(239, 68, 68)
      
      doc.setFontSize(32)
      doc.text(`${score.toFixed(1)}%`, 20, 115)
      
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(10)
      doc.text(`Cohérence physique : ${auditData.isPhysicallyCoherent ? 'VALIDÉE' : 'NON VALIDÉE'}`, 20, 125)
      
      // Anomalies section
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(16)
      doc.text('Anomalies & Points de Vigilance', 20, 145)
      doc.setFontSize(11)
      if (auditData.anomalies && auditData.anomalies.length > 0) {
        let y = 155
        auditData.anomalies.forEach((anomaly) => {
          if (y > 270) {
            doc.addPage()
            y = 20
          }
          doc.text(`• ${anomaly}`, 25, y)
          y += 10
        })
      } else {
        doc.text('Aucune anomalie critique détectée par le moteur PINN.', 25, 155)
      }
      
      // Extracted data table
      let tableStartY = 180
      if (auditData.anomalies && auditData.anomalies.length > 0) {
        tableStartY = 155 + auditData.anomalies.length * 10 + 10
      }
      
      if (auditData.extractedData && Object.keys(auditData.extractedData).length > 0) {
        const tableData = Object.entries(auditData.extractedData)
          .filter(([key]) => !['x', 'y', 'z'].includes(key))
          .map(([key, value]) => [key.replace(/_/g, ' ').toUpperCase(), String(value)])
        
        if (tableStartY > 250) {
          doc.addPage()
          tableStartY = 20
        }
          
        (doc as any).autoTable({
          startY: tableStartY,
          head: [['PARAMÈTRE INDUSTRIEL', 'VALEUR EXTRAITE']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235] },
          styles: { fontSize: 10, cellPadding: 5 }
        })
      }

      // Save the PDF
      const filename = `audit_industriel_${project.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`
      doc.save(filename)
      toast.success('Rapport industriel généré et téléchargé avec succès')
    } catch (error) {
      console.error('PDF Generation error:', error)
      toast.error('Erreur lors de la génération du PDF : ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] space-y-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin" />
        </div>
        <p className="text-xs font-mono text-blue-500 uppercase tracking-widest animate-pulse">Initialisation du Module d'Analyse...</p>
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="container mx-auto py-12 px-6 max-w-6xl">
        {/* Navigation */}
        <div className="mb-10 flex justify-between items-center">
          <Button
            onClick={() => router.push(`/dashboard/projects/${id}`)}
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-white/5 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au Projet
          </Button>
          
          {auditData && (
            <Button 
              onClick={handleDownloadReport} 
              disabled={downloading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 font-bold shadow-lg shadow-emerald-900/20"
            >
              {downloading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
              Exporter le Rapport Industriel
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: Project Info & Actions */}
          <div className="lg:col-span-1 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-500 font-mono text-[10px] uppercase tracking-widest">
                <Zap className="w-3 h-3" />
                <span>Quantum Analysis Core</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter">{project.name}</h1>
              <p className="text-gray-400 text-sm leading-relaxed">{project.description || 'Aucune description fournie.'}</p>
            </div>

            <Card className="bg-white/5 border-white/10 rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-white/5 pb-6">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Contrôle de Simulation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Lancez une nouvelle analyse physique basée sur les derniers paramètres industriels extraits.
                </p>
                <Button
                  onClick={handlePhysicsCheck}
                  disabled={verifying}
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold py-6 shadow-xl shadow-blue-900/20"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calcul PINN en cours...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Lancer l'Analyse Auto
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {sovereigntyScore && sovereigntyScore.overallSovereigntyIndex > 0 && (
              <SovereigntyIndicator score={sovereigntyScore} projectName={project.name} />
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-2 space-y-8">
            {verificationStatus !== 'idle' ? (
              <div className="space-y-8">
                <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-8">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    Validation de Crédibilité
                  </h2>
                  <VerificationBadge
                    status={verificationStatus}
                    score={auditData?.credibilityScore || 0}
                    anomalies={auditData?.anomalies || []}
                  />
                </div>

                {auditData && (
                  <ScientificAuditCard
                    auditData={auditData}
                    projectName={project.name}
                    onDownloadReport={handleDownloadReport}
                    isLoading={downloading}
                  />
                )}
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 rounded-[40px] border-2 border-dashed border-white/5 bg-white/[0.01]">
                <div className="p-6 bg-blue-500/10 rounded-full mb-6">
                  <Activity className="w-12 h-12 text-blue-500/50" />
                </div>
                <h3 className="text-2xl font-bold text-gray-400">En Attente de Simulation</h3>
                <p className="text-gray-600 mt-4 max-w-sm">
                  Aucune donnée d'analyse n'est actuellement disponible pour ce projet. Lancez l'analyse automatique pour générer les résultats physiques.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
