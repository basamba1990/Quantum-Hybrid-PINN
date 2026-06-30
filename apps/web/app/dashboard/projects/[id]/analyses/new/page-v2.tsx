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

export default function NewAnalysisPageV2() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()
  
  const { register, handleSubmit, watch } = useForm<{
    name: string
    scenario: string
  }>({
    defaultValues: {
      scenario: 'H2_PIPELINE'
    }
  })

  const selectedScenario = watch('scenario')
  const scenarioData = SCENARIOS.find(s => s.id === selectedScenario)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const onSubmit = async (formData: { name: string; scenario: string }) => {
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
          transcription: project.transcription || `Scénario: ${formData.scenario}`
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
        scenario_type: formData.scenario,
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

      // Appel sans attendre la fin de la simulation
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
          scenarioType: formData.scenario
        })
      }).catch(e => console.warn("Edge function error:", e));

      toast.success(`Analyse lancée : ${formData.scenario} 🚀`)
      
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* En-tête avec retour */}
        <div className="flex items-center justify-between">
          <Link href={`/dashboard/projects/${projectId}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour au projet
          </Link>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono text-emerald-400 uppercase">Moteur PINN V8.2</span>
          </div>
        </div>

        {/* Titre principal */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Cpu className="w-8 h-8 text-blue-500" />
            <h1 className="text-5xl font-black tracking-tighter text-white">
              Nouvelle Analyse Scientifique
            </h1>
          </div>
          <p className="text-gray-400 text-lg">Sélectionnez un scénario industriel et lancez la simulation PINN hybride pour valider la cohérence physique.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Section 1 : Nom de l'analyse */}
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <Gauge className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold text-white">Configuration de l'Analyse</h2>
            </div>
            
            <div>
              <label htmlFor="name" className="block mb-3 text-sm font-semibold text-gray-300">
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

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-300">
                <strong>Note Industrielle :</strong> L'analyse est lancée en arrière-plan sur le cluster Render. Vous serez redirigé vers la liste des analyses pour suivre la progression en temps réel.
              </p>
            </div>
          </div>

          {/* Section 2 : Sélection du scénario */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-emerald-500" />
              <h2 className="text-xl font-bold text-white">Sélectionnez un Scénario Industriel</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SCENARIOS.map((scenario) => (
                <label
                  key={scenario.id}
                  className={`relative cursor-pointer group transition-all ${
                    selectedScenario === scenario.id
                      ? 'ring-2 ring-blue-500'
                      : 'hover:ring-2 hover:ring-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    value={scenario.id}
                    {...register('scenario')}
                    className="sr-only"
                  />
                  
                  <div className={`bg-gradient-to-br ${scenario.color} p-0.5 rounded-2xl transition-all ${
                    selectedScenario === scenario.id ? 'shadow-lg shadow-blue-500/50' : ''
                  }`}>
                    <div className="bg-slate-950 rounded-2xl p-6 space-y-3 h-full">
                      <div className="flex items-start justify-between">
                        <div className="text-3xl">{scenario.icon}</div>
                        {selectedScenario === scenario.id && (
                          <CheckCircle2 className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{scenario.name}</h3>
                        <p className="text-sm text-gray-400 mt-2">{scenario.description}</p>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs font-mono text-gray-500">{scenario.id}</p>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Section 3 : Résumé du scénario sélectionné */}
          {scenarioData && (
            <div className={`bg-gradient-to-r ${scenarioData.color} p-0.5 rounded-2xl`}>
              <div className="bg-slate-950 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{scenarioData.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{scenarioData.name}</h3>
                    <p className="text-sm text-gray-400">{scenarioData.description}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages d'erreur */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
              </p>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-white/5 text-white px-6 py-4 rounded-xl hover:bg-white/10 transition-colors font-semibold border border-white/10"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-6 py-4 rounded-xl hover:from-blue-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Lancement...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Lancer l'Analyse Réelle
                </>
              )}
            </button>
          </div>
        </form>

        {/* Pied de page informatif */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
          <h3 className="font-semibold text-white text-sm">À propos des scénarios</h3>
          <p className="text-xs text-gray-400">
            Chaque scénario utilise des équations physiques réalistes validées par des standards industriels (Ansys, Autodesk). 
            Les résultats incluent des analyses de convergence PINN, des métriques de cohérence physique et des scores de crédibilité.
          </p>
        </div>
      </div>
    </div>
  )
}
