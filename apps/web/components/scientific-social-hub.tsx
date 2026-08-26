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
  credibilityScore: number | null
  auditStatus: string
  validationCount: number
  technicalObservation: string
}

interface Props {
  analysisId?: string
  projectId?: string
  credibilityScore?: number | null
}

export default function ScientificSocialHub({ 
  analysisId, 
  projectId, 
  credibilityScore = null 
}: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [auditData, setAuditData] = useState<AuditData>({
    credibilityScore: credibilityScore,
    auditStatus: credibilityScore !== null ? 'Certified Industrial' : 'Pending Verification',
    validationCount: 0,
    technicalObservation: 'Chargement des données...'
  })
  const [newComment, setNewComment] = useState('')
  const [isSharing, setIsSharing] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'audit' | 'network'>('comments')
  const supabase = createClient()

  useEffect(() => {
    if (credibilityScore !== null) {
      setAuditData(prev => ({ ...prev, credibilityScore, auditStatus: credibilityScore >= 95 ? 'Certified Industrial' : 'Review Required' }))
    }
  }, [credibilityScore])

  return (
    <div className="w-full bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 text-white space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" /> Social Hub & Scientific Audit
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('comments')} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'comments' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>Commentaires</button>
          <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'audit' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>Audit Kelly Senecal</button>
        </div>
      </div>

      {activeTab === 'comments' && (
        <div className="space-y-4">
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {annotations.length === 0 ? (
              <p className="text-xs text-gray-500 italic text-center py-4">No annotation recorded. Share your scientific observation.</p>
            ) : (
              annotations.map(ann => (
                <div key={ann.id} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span className="font-bold text-blue-400">{ann.user_name || 'Chercheur'}</span>
                    <span>{ann.created_at ? format(new Date(ann.created_at), 'dd MMM yyyy HH:mm') : ''}</span>
                  </div>
                  <p className="text-xs text-gray-200">{ann.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newComment} 
              onChange={e => setNewComment(e.target.value)} 
              placeholder="Ajouter une observation scientifique..." 
              className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all">
              <Send className="w-3.5 h-3.5" /> Envoyer
            </button>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[10px] uppercase font-bold text-gray-400">Score de Crédibilité</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">{auditData.credibilityScore !== null ? `${auditData.credibilityScore}%` : 'N/D (Non calculé)'}</p>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[10px] uppercase font-bold text-gray-400">Statut d'Audit</p>
              <p className="text-lg font-black text-blue-400 mt-1">{auditData.auditStatus}</p>
            </div>
          </div>
          <div className="p-4 bg-black/40 border border-white/10 rounded-2xl text-xs text-gray-300 leading-relaxed">
            <p className="font-bold text-white mb-1">Règle Kelly Senecal & Zéro Hallucination :</p>
            All displayed physical metrics and credibility scores come strictly from computed Navier-Stokes and energy-conservation residuals. No default value is simulated.
          </div>
        </div>
      )}
    </div>
  )
}
