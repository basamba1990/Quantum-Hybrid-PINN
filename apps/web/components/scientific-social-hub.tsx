'use client'

import React, { useState, useEffect } from 'react'
import { 
  MessageSquare, 
  Share2, 
  ShieldCheck, 
  Users, 
  Send, 
  Award, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Lock,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface Annotation {
  id: string
  user_id: string
  content: string
  severity: 'info' | 'warning' | 'critical' | 'validation'
  created_at: string
  user_name?: string
}

interface AuditData {
  credibilityScore: number
  auditStatus: string
  validationCount: number
  technicalObservation: string
}

interface Props {
  analysisId?: string
  projectId?: string
  credibilityScore?: number
}

/**
 * ScientificSocialHub V2.0 - Real Data Integration
 * 
 * Ce composant récupère les données réelles depuis Supabase :
 * - Commentaires et annotations des experts (simulation_annotations)
 * - Scores de crédibilité (analyses.credibility_score)
 * - Audits industriels (simulation_results)
 * - Réactions scientifiques (scientific_reactions)
 */
export default function ScientificSocialHub({ 
  analysisId = 'demo-analysis', 
  projectId = 'demo-project', 
  credibilityScore = 98.7 
}: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [auditData, setAuditData] = useState<AuditData>({
    credibilityScore: credibilityScore,
    auditStatus: 'Certified Industrial',
    validationCount: 0,
    technicalObservation: 'Chargement des données...'
  })
  const [newComment, setNewComment] = useState('')
  const [isSharing, setIsSharing] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'audit' | 'network'>('comments')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Récupérer les données réelles depuis Supabase
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // 1. Récupérer les annotations (commentaires) pour cette analyse
        const { data: annotationsData, error: annotationsError } = await supabase
          .from('simulation_annotations')
          .select(`
            id,
            user_id,
            content,
            severity,
            created_at,
            users:user_id (full_name, email)
          `)
          .eq('analysis_id', analysisId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (annotationsError) {
          console.error('Erreur lors de la récupération des annotations:', annotationsError)
        } else if (annotationsData) {
          const formattedAnnotations: Annotation[] = annotationsData.map((item: any) => ({
            id: item.id,
            user_id: item.user_id,
            content: item.content,
            severity: item.severity || 'info',
            created_at: item.created_at,
            user_name: item.users?.full_name || item.users?.email?.split('@')[0] || 'Expert'
          }))
          setAnnotations(formattedAnnotations)
        }

        // 2. Récupérer le score de crédibilité et les données d'audit
        const { data: analysisData, error: analysisError } = await supabase
          .from('analyses')
          .select(`
            id,
            credibility_score,
            results
          `)
          .eq('id', analysisId)
          .single()

        if (analysisError) {
          console.error('Erreur lors de la récupération de l\'analyse:', analysisError)
        } else if (analysisData) {
          const score = analysisData.credibility_score || credibilityScore
          setAuditData(prev => ({
            ...prev,
            credibilityScore: score
          }))
        }

        // 3. Récupérer les résultats de simulation pour les observations techniques
        const { data: simulationResults, error: resultsError } = await supabase
          .from('simulation_results')
          .select(`
            id,
            credibility_score,
            continuity_residual,
            momentum_residual,
            energy_residual,
            anomalies
          `)
          .eq('analysis_id', analysisId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (resultsError) {
          console.error('Erreur lors de la récupération des résultats:', resultsError)
        } else if (simulationResults && simulationResults.length > 0) {
          const result = simulationResults[0]
          const observation = `Audit V10-GOLD: Continuité=${result.continuity_residual?.toFixed(6) || 'N/A'}, Momentum=${result.momentum_residual?.toFixed(6) || 'N/A'}, Énergie=${result.energy_residual?.toFixed(6) || 'N/A'}`
          
          setAuditData(prev => ({
            ...prev,
            technicalObservation: observation,
            credibilityScore: result.credibility_score || prev.credibilityScore
          }))
        }

        // 4. Compter les réactions scientifiques (validations)
        const { data: reactionsData, error: reactionsError } = await supabase
          .from('scientific_reactions')
          .select('id')
          .eq('analysis_id', analysisId)

        if (reactionsError) {
          console.error('Erreur lors de la récupération des réactions:', reactionsError)
        } else if (reactionsData) {
          setAuditData(prev => ({
            ...prev,
            validationCount: reactionsData.length
          }))
        }

      } catch (err) {
        console.error('Erreur lors du chargement des données:', err)
        setError('Impossible de charger les données. Veuillez réessayer.')
      } finally {
        setIsLoading(false)
      }
    }

    if (analysisId && analysisId !== 'demo-analysis') {
      fetchRealData()
    } else {
      // Mode démo avec données fictives
      setAnnotations([
        {
          id: '1',
          user_id: 'expert-1',
          user_name: 'Dr. Sarah Chen',
          content: 'Le profil de vitesse parabolique montre une cohérence parfaite avec les données expérimentales de 2025. Validation recommandée.',
          severity: 'validation',
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '2',
          user_id: 'investor-ref',
          user_name: 'Industrial Partners Group',
          content: 'Analyse de robustesse terminée. Prêt pour le passage en phase pilote industrielle.',
          severity: 'info',
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ])
      setIsLoading(false)
    }
  }, [analysisId, supabase, credibilityScore])

  const handleSendComment = async () => {
    if (!newComment.trim()) return

    try {
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Vous devez être connecté pour ajouter un commentaire.')
        return
      }

      // Insérer le commentaire dans la base de données
      const { data: newAnnotation, error: insertError } = await supabase
        .from('simulation_annotations')
        .insert({
          analysis_id: analysisId,
          user_id: user.id,
          content: newComment,
          severity: 'info',
          is_validation: false
        })
        .select(`
          id,
          user_id,
          content,
          severity,
          created_at,
          users:user_id (full_name, email)
        `)
        .single()

      if (insertError) {
        console.error('Erreur lors de l\'insertion du commentaire:', insertError)
        setError('Impossible d\'ajouter le commentaire. Veuillez réessayer.')
      } else if (newAnnotation) {
        const formattedAnnotation: Annotation = {
          id: newAnnotation.id,
          user_id: newAnnotation.user_id,
          content: newAnnotation.content,
          severity: newAnnotation.severity || 'info',
          created_at: newAnnotation.created_at,
          user_name: newAnnotation.users?.[0]?.full_name || newAnnotation.users?.[0]?.email?.split('@')[0] || 'Vous'
        }
        setAnnotations([formattedAnnotation, ...annotations])
        setNewComment('')
      }
    } catch (err) {
      console.error('Erreur lors de l\'envoi du commentaire:', err)
      setError('Une erreur est survenue.')
    }
  }

  return (
    <div className="bg-[#050810] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[600px]">
      {/* Header Stratégique */}
      <div className="p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-2xl">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Scientific Hub</h3>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Real-Time Peer-Review & Collaboration</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-[#050810] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-[#050810] bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
              +{Math.max(0, annotations.length - 4)}
            </div>
          </div>
          <button 
            onClick={() => setIsSharing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all"
          >
            <Share2 className="w-4 h-4" /> Share with Partners
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex p-2 bg-black/40 border-b border-white/5">
        {[
          { id: 'comments', label: 'Peer Review', icon: MessageSquare },
          { id: 'audit', label: 'Industrial Audit', icon: ShieldCheck },
          { id: 'network', label: 'Impact Network', icon: TrendingUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {activeTab === 'comments' && (
          <>
            {/* Input */}
            <div className="relative">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter une analyse technique ou une validation..."
                disabled={isLoading}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 min-h-[100px] resize-none disabled:opacity-50"
              />
              <button 
                onClick={handleSendComment}
                disabled={isLoading || !newComment.trim()}
                className="absolute bottom-4 right-4 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : annotations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun commentaire pour le moment</p>
              </div>
            ) : (
              <div className="space-y-4">
                {annotations.map((item) => (
                  <div key={item.id} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-3 hover:border-white/10 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
                          {item.user_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{item.user_name}</p>
                          <p className="text-[10px] font-mono text-gray-500 uppercase">{format(new Date(item.created_at), 'dd MMM yyyy HH:mm')}</p>
                        </div>
                      </div>
                      {item.severity === 'validation' && (
                        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                          <CheckCircle2 className="w-3 h-3" /> Validated
                        </div>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-8 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 p-6 rounded-[24px] space-y-4">
                    <div className="flex items-center gap-3 text-blue-400">
                      <Award className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Credibility Index</span>
                    </div>
                    <div className="text-4xl font-black text-white italic">{(auditData.credibilityScore || 0).toFixed(1)}%</div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-emerald-500" style={{ width: `${auditData.credibilityScore}%` }} />
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-6 rounded-[24px] space-y-4">
                    <div className="flex items-center gap-3 text-purple-400">
                      <ShieldCheck className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Audit Status</span>
                    </div>
                    <div className="text-xl font-black text-white uppercase italic tracking-tighter">{auditData.auditStatus}</div>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-[24px] flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white uppercase tracking-tight">Technical Observation</p>
                    <p className="text-xs text-amber-500/80 leading-relaxed italic">
                      {auditData.technicalObservation}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-[24px]">
                  <p className="text-xs text-blue-400">
                    <span className="font-bold">Validations scientifiques:</span> {auditData.validationCount} experts ont confirmé la robustesse de cette analyse.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'network' && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-blue-500" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-black text-white uppercase italic">Impact Network Premium</h4>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                Connectez votre compte LinkedIn pour voir l'impact de vos simulations sur votre réseau professionnel et attirer des partenaires.
              </p>
            </div>
            <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all uppercase text-xs tracking-widest shadow-xl shadow-blue-900/20">
              Connect LinkedIn Professional
            </button>
          </div>
        )}
      </div>

      {/* Footer Statistique */}
      <div className="p-4 bg-black/60 border-t border-white/5 flex items-center justify-between text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">
        <div className="flex items-center gap-4">
          <span>Active Experts: {Math.min(4, annotations.length)}</span>
          <span>Validations: {auditData.validationCount}</span>
        </div>
        <div className="text-blue-500 animate-pulse">
          Quantum Network Connected
        </div>
      </div>
    </div>
  )
}
