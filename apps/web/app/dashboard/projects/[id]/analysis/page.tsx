'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Play, ArrowLeft, Download, Activity, ShieldCheck, Zap } from 'lucide-react'
import { toast } from 'sonner'
import VerificationBadge from '@/components/verification-badge'
import ScientificAuditCard from '@/components/scientific-audit-card'
import SovereigntyIndicator from '@/components/sovereignty-indicator'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

interface SovereigntyScore {
  dataSecurityScore: number
  intellectualPropertyScore: number
  independenceScore: number
  overallSovereigntyIndex: number
}

export default function ProjectAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [auditData, setAuditData] = useState<AuditData | null>(null)
  const [sovereigntyScore, setSovereigntyScore] = useState<SovereigntyScore | null>(null)
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
          toast.error('Projet non trouvé')
          router.push('/dashboard')
          return
        }

        setProject(projectData)

        // Fetch existing audit if available
        const { data: analysisData } = await supabase
          .from('analyses')
          .select('*')
          .eq('project_id', id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (analysisData) {
          const results = analysisData.results || {}
          const score = analysisData.credibility_score || results.credibilityScore || 0
          
          setAuditData({
            isPhysicallyCoherent: score > 50,
            credibilityScore: score,
            anomalies: results.anomalies || [],
            extractedData: results.extractedParams || results.extractedData || {},
            predictions: results.predictions3d || [],
            predictions3d: results.predictions3d || [],
            assimilation: results.assimilation || null,
          })
          
          setVerificationStatus(
            score > 50
              ? 'coherent'
              : (results.anomalies?.length > 0 ? 'anomaly' : 'impossible')
          )
        }

        // Fetch sovereignty score
        const { data: sovereigntyData } = await supabase
          .from('sovereignty_scores')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (sovereigntyData) {
          setSovereigntyScore({
            dataSecurityScore: sovereigntyData.data_security_score,
            intellectualPropertyScore: sovereigntyData.intellectual_property_score,
            independenceScore: sovereigntyData.independence_score,
            overallSovereigntyIndex: sovereigntyData.overall_sovereignty_index,
          })
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
    // Redirection vers le nouveau flux d'analyse industrielle plus robuste
    router.push(`/dashboard/projects/${id}/analyses/new`)
  }

  const handleDownloadReport = () => {
    if (!auditData || !project) return

    setDownloading(true)
    try {
      const doc = new jsPDF()
      
      // Header Industriel
      doc.setFillColor(10, 10, 20)
      doc.rect(0, 0, 210, 40, 'F')
      doc.setFontSize(22)
      doc.setTextColor(255, 255, 255)
      doc.text('RAPPORT D\'AUDIT SCIENTIFIQUE QUANTUM-PINN', 20, 25)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(14)
      doc.text(`Projet : ${project.name}`, 20, 55)
      doc.text(`Date : ${new Date().toLocaleDateString()}`, 20, 65)
      doc.text(`ID Simulation : ${id.slice(0, 8)}`, 20, 75)
      
      // Score de crédibilité
      doc.setFontSize(16)
      doc.text('Évaluation de la Crédibilité Physique', 20, 95)
      
      const score = auditData.credibilityScore
      if (score >= 80) doc.setTextColor(16, 185, 129) // Emerald
      else if (score >= 50) doc.setTextColor(245, 158, 11) // Amber
      else doc.setTextColor(239, 68, 68) // Red
      
      doc.setFontSize(32)
      doc.text(`${score.toFixed(1)}%`, 20, 115)
      
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(10)
      doc.text(`Cohérence physique : ${auditData.isPhysicallyCoherent ? 'VALIDÉE' : 'NON VALIDÉE'}`, 20, 125)
      
      // Anomalies
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(16)
      doc.text('Anomalies & Points de Vigilance', 20, 145)
      doc.setFontSize(11)
      if (auditData.anomalies.length > 0) {
        let y = 155
        auditData.anomalies.forEach((anomaly) => {
          doc.text(`• ${anomaly}`, 25, y)
          y += 10
        })
      } else {
        doc.text('Aucune anomalie critique détectée par le moteur PINN.', 25, 155)
      }
      
      // Données extraites
      if (Object.keys(auditData.extractedData).length > 0) {
        const tableData = Object.entries(auditData.extractedData)
          .filter(([key]) => !['x', 'y', 'z'].includes(key))
          .map(([key, value]) => [key.replace(/_/g, ' ').toUpperCase(), value.toString()])
          
        autoTable(doc, {
          startY: 180,
          head: [['PARAMÈTRE INDUSTRIEL', 'VALEUR EXTRAITE']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235] },
          styles: { fontSize: 10, cellPadding: 5 }
        })
      }

      doc.save(`audit_industriel_${project.name.replace(/\s+/g, '_')}.pdf`)
      toast.success('Rapport industriel généré avec succès')
    } catch (error) {
      console.error('PDF Generation error:', error)
      toast.error('Erreur lors de la génération du PDF')
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
              <p className="text-gray-400 text-sm leading-relaxed">{project.description}</p>
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

            {sovereigntyScore && (
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
                    score={auditData?.credibilityScore}
                    anomalies={auditData?.anomalies}
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
