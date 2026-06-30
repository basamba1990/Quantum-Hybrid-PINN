'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ArrowLeft, Zap, AlertCircle, CheckCircle2, Cpu, Gauge } from 'lucide-react'
import Link from 'next/link'

// Scénarios disponibles avec descriptions
const SCENARIOS = [
  {
    id: 'H2_PIPELINE',
    name: 'Pipeline Hydrogène',
    description: 'Simulation thermodynamique d\'un pipeline H₂ haute pression avec analyse de chute de pression et risque de fuite',
    icon: '🔬',
    color: 'from-blue-600 to-cyan-600'
  },
  {
    id: 'LH2_STORAGE',
    name: 'Stockage LH₂',
    description: 'Analyse cryogénique du stockage d\'hydrogène liquéfié avec calcul du taux d\'évaporation',
    icon: '❄️',
    color: 'from-cyan-600 to-blue-600'
  },
  {
    id: 'H2_COMPRESSION_STATION',
    name: 'Station de Compression',
    description: 'Bilan thermodynamique d\'une station de compression H₂ avec vérification d\'efficacité isentropique',
    icon: '⚙️',
    color: 'from-emerald-600 to-green-600'
  },
  {
    id: 'CRYOGENIC_TRANSPORT',
    name: 'Transport Cryogénique',
    description: 'Simulation des pertes thermiques lors du transport de LH₂ ou GNL',
    icon: '🚚',
    color: 'from-purple-600 to-pink-600'
  },
  {
    id: 'PIPELINE_SAFETY',
    name: 'Sécurité Pipeline',
    description: 'Analyse de détection et prédiction de ruptures avec capteurs distribués',
    icon: '🛡️',
    color: 'from-orange-600 to-red-600'
  },
  {
    id: 'PORT_ENERGY_OPTIMIZATION',
    name: 'Optimisation Portuaire',
    description: 'Optimisation énergétique des installations portuaires avec réduction carbone',
    icon: '⚡',
    color: 'from-yellow-600 to-orange-600'
  },
  {
    id: 'MINING_INDUSTRIAL_SIM',
    name: 'Ventilation Minière',
    description: 'Simulation de ventilation et qualité de l\'air en environnement minier',
    icon: '⛏️',
    color: 'from-gray-600 to-slate-600'
  },
  {
    id: 'ROCK_ELAST_STRESS',
    name: 'Géomécanique Rocheuse',
    description: 'Analyse des contraintes élastiques et endommagement de roches en profondeur',
    icon: '🪨',
    color: 'from-amber-600 to-yellow-600'
  }
]

export default function NewAnalysisPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()
  
  const { register, handleSubmit } = useForm<{
    name: string
  }>()

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const onSubmit = async (formData: { name: string }) => {
    setLoading(true)
    setErrorMsg(null)
    
    try {
      // 1. Vérifier la session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error("Session expirée. Veuillez vous reconnecter.")
      }
      const accessToken = session.access_token

      // 2. Récupérer le projet
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('transcription, user_id')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        throw new Error("Impossible de récupérer les données du projet.")
      }

      // 3. Créer l'enregistrement d'analyse (statut pending)
      const { data: newAnalysis, error: insertError } = await supabase
        .from('analyses')
        .insert({
          name: formData.name,
          title: formData.name,
          project_id: projectId,
          user_id: project.user_id,
          status: 'pending',
          analysis_type: 'physics_verification',
          transcription: project.transcription || "Simulation industrielle standard"
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Erreur lors de la création de l'analyse : ${insertError.message}`)
      }

      // 4. Lancement asynchrone de la simulation
      const industrialApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-hybrid-pinn-jdoj.onrender.com';
      
      const transcription = project.transcription || "";
      
      // Extraction robuste des paramètres
      const extract = (regex: RegExp, def: number) => {
        const match = transcription.match(regex);
        return match ? parseFloat(match[1].replace(',', '.')) : def;
      };

      const payload = {
        project_id: projectId,
        job_name: formData.name,
        case_path: 'industrial_v8',
        scenario_type: transcription.match(/scénario\s*:?\s*(H2_PIPELINE|LH2_STORAGE|H2_COMPRESSION_STATION|MINING_INDUSTRIAL_SIM|CRYOGENIC_TRANSPORT|PIPELINE_SAFETY|PORT_ENERGY_OPTIMIZATION|ROCK_ELAST_STRESS)/i)?.[1] || 'H2_PIPELINE',
        scenario_inputs: {
          transcription: transcription,
          diameter: extract(/diamètre\s*:?\s*(\d+(?:[.,]\d+)?)/i, 0.5),
          pressure: extract(/pression\s*:?\s*(\d+(?:[.,]\d+)?)/i, 80),
          temperature: extract(/température\s*:?\s*(\d+(?:[.,]\d+)?)/i, 300),
          flowRate: extract(/débit\s*:?\s*(\d+(?:[.,]\d+)?)/i, 2),
          length: extract(/longueur\s*:?\s*(\d+(?:[.,]\d+)?)/i, 100),
        },
        n_steps: 100
      };

      // Appel sans attendre la fin de la simulation (on attend juste la création du job)
      const res = await fetch(`${industrialApiUrl}/hybrid/run-simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.warn("Backend API non disponible immédiatement, l'analyse restera en attente.");
      } else {
        const result = await res.json();
        const jobId = result.job_id || result.jobId;
        
        // Mettre à jour l'analyse avec le jobId
        if (jobId) {
          await supabase
            .from('analyses')
            .update({ results: { job_id: jobId, status: 'running' } })
            .eq('id', newAnalysis.id);
        }
      }

      // 5. Appel de l'Edge Function (optionnel, en arrière-plan)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ivhxnaxhgfbiqlhgfkik.supabase.co';
      fetch(`${supabaseUrl}/functions/v1/verify-physics-logic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          projectId,
          analysisId: newAnalysis.id,
          transcription: project.transcription,
        })
      }).catch(e => console.warn("Edge function error:", e));

      toast.success('Analyse lancée avec succès 🚀')
      
      // Redirection immédiate
      router.push(`/dashboard/projects/${projectId}/analyses`)
      router.refresh()
      
    } catch (err: any) {
      console.error('Analysis execution error:', err)
      setErrorMsg(err.message || 'Erreur inconnue')
      toast.error(err.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Nouvelle Analyse Scientifique
        </h1>
        <p className="text-gray-400">Lancez le moteur PINN V8 pour valider la cohérence physique de vos données.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Configuration de l'Analyse
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-300">
                Nom de l'analyse *
              </label>
              <input
                id="name"
                {...register('name', { required: 'Le nom est requis' })}
                className="w-full border border-white/10 bg-white/5 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Ex: Validation Cryogénique H2 - Phase 1"
                required
              />
            </div>
            
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-300">
                <strong>Note Industrielle :</strong> L'analyse est lancée en arrière-plan sur le cluster Render. Vous serez redirigé vers la liste des analyses pour suivre la progression.
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400 text-sm flex items-center gap-2">
              <span>⚠️</span> {errorMsg}
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 bg-white/5 text-white px-4 py-3 rounded-xl hover:bg-white/10 transition-colors font-medium border border-white/10"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Lancement...' : 'Lancer l\'Analyse Réelle'}
          </button>
        </div>
      </form>
    </div>
  )
}
