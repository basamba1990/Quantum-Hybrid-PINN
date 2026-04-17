'use client'

import { useState, useEffect, use } from 'react'
import { useLocation } from 'wouter'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Play, ArrowLeft, Download } from 'lucide-react'
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
  predictions: any[]
}

interface SovereigntyScore {
  dataSecurityScore: number
  intellectualPropertyScore: number
  independenceScore: number
  overallSovereigntyIndex: number
}

export default function ProjectAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [, setLocation] = useLocation()
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
          setLocation('/dashboard/projects')
          return
        }

        setProject(projectData)

        // Fetch existing audit if available
        const { data: auditDataResult } = await supabase
          .from('physics_validations')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (auditDataResult) {
          setAuditData({
            isPhysicallyCoherent: auditDataResult.is_physically_coherent,
            credibilityScore: auditDataResult.credibility_score,
            anomalies: auditDataResult.anomalies || [],
            extractedData: auditDataResult.extracted_data || {},
            predictions: auditDataResult.pinn_results?.predictions || [],
          })
          
          setVerificationStatus(
            auditDataResult.is_physically_coherent
              ? 'coherent'
              : (auditDataResult.anomalies?.length > 0 ? 'anomaly' : 'impossible')
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
  }, [id, supabase, setLocation])

  const handlePhysicsCheck = async () => {
    if (!project?.transcription) {
      toast.warning('Veuillez d’abord transcrire la vidéo')
      return
    }

    setVerifying(true)
    setVerificationStatus('loading')

    try {
      // 1. Create a real analysis record first to get a valid UUID
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non authentifié')

      const { data: analysisRecord, error: analysisError } = await supabase
        .from('analyses')
        .insert({
          project_id: id,
          user_id: user.id,
          title: `Analyse Physique - ${new Date().toLocaleString()}`,
          status: 'pending',
          analysis_type: 'physics_verification',
          transcription: project.transcription
        })
        .select()
        .single()

      if (analysisError || !analysisRecord) {
        throw new Error(`Erreur lors de la création de l'analyse: ${analysisError?.message}`)
      }

      // 2. Call the edge function with the real UUID
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-physics-logic`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            projectId: id,
            analysisId: analysisRecord.id,
            transcription: project.transcription,
            context: 'hydrogen_storage',
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Verification failed: ${errorText}`)
      }

      const result = await response.json()
      const data = result.data

      setAuditData({
        isPhysicallyCoherent: data.isPhysicallyCoherent,
        credibilityScore: data.credibilityScore,
        anomalies: data.anomalies,
        extractedData: data.extractedData,
        predictions: data.predictions,
      })

      setVerificationStatus(
        data.isPhysicallyCoherent
          ? 'coherent'
          : data.anomalies.length > 0
          ? 'anomaly'
          : 'impossible'
      )

      const defaultSovereignty: SovereigntyScore = {
        dataSecurityScore: 85,
        intellectualPropertyScore: 80,
        independenceScore: 75,
        overallSovereigntyIndex: 80,
      }
      setSovereigntyScore(defaultSovereignty)

      toast.success('Analyse physique terminée avec succès')
    } catch (error) {
      console.error('Physics check error:', error)
      setVerificationStatus('impossible')
      toast.error('Échec de la vérification physique')
    } finally {
      setVerifying(false)
    }
  }

  const handleDownloadReport = () => {
    if (!auditData || !project) return

    setDownloading(true)
    try {
      const doc = new jsPDF()
      
      // Titre
      doc.setFontSize(20)
      doc.text('Rapport d\'Audit Scientifique - SpotBulle', 20, 20)
      
      doc.setFontSize(14)
      doc.text(`Projet : ${project.name}`, 20, 35)
      doc.text(`Date : ${new Date().toLocaleDateString()}`, 20, 45)
      
      // Score de crédibilité
      doc.setFontSize(16)
      doc.text('Résultats de l\'Analyse', 20, 60)
      doc.setFontSize(12)
      doc.text(`Score de crédibilité : ${auditData.credibilityScore}/100`, 20, 70)
      doc.text(`Cohérence physique : ${auditData.isPhysicallyCoherent ? 'OUI' : 'NON'}`, 20, 80)
      
      // Anomalies
      if (auditData.anomalies.length > 0) {
        doc.text('Anomalies détectées :', 20, 95)
        let y = 105
        auditData.anomalies.forEach((anomaly) => {
          doc.text(`- ${anomaly}`, 25, y)
          y += 10
        })
      } else {
        doc.text('Aucune anomalie majeure détectée.', 20, 95)
      }
      
      // Données extraites
      if (Object.keys(auditData.extractedData).length > 0) {
        const tableData = Object.entries(auditData.extractedData).map(([key, value]) => [key, value.toString()])
        autoTable(doc, {
          startY: 130,
          head: [['Paramètre', 'Valeur']],
          body: tableData,
        })
      }

      doc.save(`audit_${project.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`)
      toast.success('Rapport généré et téléchargé')
    } catch (error) {
      console.error('PDF Generation error:', error)
      toast.error('Erreur lors de la génération du PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Projet non trouvé</p>
        <Button onClick={() => setLocation('/dashboard/projects')} variant="outline" className="mt-4">
          Retour aux projets
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <Button
              onClick={() => setLocation(`/dashboard/projects/${id}`)}
              variant="outline"
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-4xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-slate-600 mt-2">{project.description}</p>
          </div>
          {auditData && (
            <Button 
              onClick={handleDownloadReport} 
              disabled={downloading}
              className="bg-green-600 hover:bg-green-700"
            >
              {downloading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
              Télécharger le Rapport PDF
            </Button>
          )}
        </div>

        {/* Video Section */}
        {project.video_url && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Vidéo de Pitch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                <video src={project.video_url} controls className="w-full h-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Physics-Check Button */}
        <Card className="mb-8 border-2 border-indigo-200 bg-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-indigo-600" />
              Vérification Physique
            </CardTitle>
            <CardDescription>
              Cliquez pour analyser la cohérence scientifique du pitch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handlePhysicsCheck}
              disabled={verifying || !project.transcription}
              size="lg"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Lancer Physics-Check
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Verification Status */}
        {verificationStatus !== 'idle' && (
          <div className="mb-8">
            <VerificationBadge
              status={verificationStatus}
              score={auditData?.credibilityScore}
              anomalies={auditData?.anomalies}
            />
          </div>
        )}

        {/* Audit Results */}
        {auditData && (
          <div className="space-y-8">
            <ScientificAuditCard
              auditData={auditData}
              projectName={project.name}
              onDownloadReport={handleDownloadReport}
              isLoading={downloading}
            />

            {sovereigntyScore && (
              <SovereigntyIndicator score={sovereigntyScore} projectName={project.name} />
            )}
          </div>
        )}

        {/* No Results Yet */}
        {!auditData && verificationStatus === 'idle' && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-slate-600 mb-4">Aucune analyse physique pour le moment</p>
              <p className="text-sm text-slate-500">
                Cliquez sur "Lancer Physics-Check" pour commencer l'analyse
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
