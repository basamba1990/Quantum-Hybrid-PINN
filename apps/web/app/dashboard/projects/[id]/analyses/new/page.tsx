"use client"

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ArrowLeft, Zap, AlertCircle, CheckCircle2, Cpu, Gauge } from 'lucide-react'
import Link from 'next/link'

// Available scenarios with descriptions - V8.5 Industrial
const SCENARIOS = [
  {
    id: 'H2_PIPELINE',
    name: 'Pipeline H₂',
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
    id: 'PCCV_TRANSIENT_THERMO_V1',
    name: 'Vanne cinq voies — transitoire',
    description: 'Contrat thermo-hydraulique à géométrie mobile. Un maillage et un oracle CFD vérifiables sont requis avant toute exécution.',
    icon: '🔁',
    color: 'from-violet-600 to-fuchsia-600'
  },
  {
    id: 'LH2_TANK_THERMO_MULTIPHASE_V1',
    name: 'Réservoir LH₂ — VOF multiphase',
    description: 'Cas de référence thermo-hydraulique avec isolation 10/20/30 mm, ullage, évaporation et validation CFD indépendante.',
    icon: '🧊',
    color: 'from-sky-600 to-indigo-600'
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
    description: 'Simulation of thermal losses during LH₂ or LNG transport',
    icon: '🚚',
    color: 'from-purple-600 to-pink-600'
  },
  {
    id: 'PIPELINE_SAFETY',
    name: 'Pipeline Safety',
    description: 'Break detection and prediction analysis with distributed sensors',
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
    description: 'Analysis of elastic stress and deep-rock damage',
    icon: '🪨',
    color: 'from-amber-600 to-yellow-600'
  },
  {
    id: 'FPGA_HEATSINK',
    name: 'FPGA Heatsink',
    description: 'Conjugate heat transfer in an FPGA heat sink. Heat flux 600 W/cm². 3D Navier-Stokes simulation.',
    icon: '🔥',
    color: 'from-red-600 to-orange-600'
  },
  {
    id: 'DEEP_MINING_BLOCK',
    name: 'Deep Mining Block',
    description: 'Geomechanical analysis of a deep-mine rock block. Lithostatic stresses and Mohr-Coulomb failure criterion.',
    icon: '⛰️',
    color: 'from-stone-600 to-amber-800'
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

  const [selectedScenario, setSelectedScenario] = useState('H2_PIPELINE')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const onSubmit = async (formData: { name: string }) => {
    setLoading(true)
    setErrorMsg(null)
    
    try {
      if (selectedScenario === 'PCCV_TRANSIENT_THERMO_V1') {
        throw new Error('Le scénario PCCV exige d’abord un contrat de géométrie, un maillage et un oracle CFD vérifiables. Il ne peut pas être envoyé au moteur H₂ générique.')
      }
      if (selectedScenario === 'LH2_TANK_THERMO_MULTIPHASE_V1') {
        throw new Error('Le scénario réservoir LH₂ multiphase exige d’abord un maillage VOF, les champs CFD et un oracle de changement de phase vérifiables. Il ne peut pas être envoyé au moteur H₂ générique.')
      }
      // 1. Check session
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
          transcription: project.transcription || "Standard industrial simulation"
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create the analysis : ${insertError.message}`)
      }

      // 4. Lancement asynchrone de la simulation
      const industrialApiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!industrialApiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL est requis pour lancer une analyse.')
      }
      
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
        scenario_type: selectedScenario,
        scenario_inputs: {
          transcription: transcription,
          diameter: extract(/diamètre\s*:?\s*(\d+(?:[.,]\d+)?)/i, 0.5),
          pressure: extract(/pression\s*:?\s*(\d+(?:[.,]\d+)?)/i, 80),
          temperature: extract(/température\s*:?\s*(\d+(?:[.,]\d+)?)/i, 300),
          flowRate: extract(/débit\s*:?\s*(\d+(?:[.,]\d+)?)/i, 2),
          length: extract(/longueur\s*:?\s*(\d+(?:[.,]\d+)?)/i, 100),
          // FPGA-specific
          inlet_velocity: extract(/vitesse\s*:?\s*(\d+(?:[.,]\d+)?)/i, 5.7),
          heat_flux: extract(/flux\s*:?\s*(\d+(?:[.,]\d+)?)/i, 600),
          fin_thickness: extract(/épaisseur.?ailette\s*:?\s*(\d+(?:[.,]\d+)?)/i, 0.002),
          fin_height: extract(/hauteur.?ailette\s*:?\s*(\d+(?:[.,]\d+)?)/i, 0.025),
          num_fins: extract(/nombre.?ailettes\s*:?\s*(\d+(?:[.,]\d+)?)/i, 30),
          // Deep Mining specific
          depth: extract(/profondeur\s*:?\s*(\d+(?:[.,]\d+)?)/i, 2500),
          excavation_width: extract(/largeur.*excavation\s*:?\s*(\d+(?:[.,]\d+)?)/i, 8),
          excavation_height: extract(/hauteur.*excavation\s*:?\s*(\d+(?:[.,]\d+)?)/i, 6),
          rock_type: (transcription.match(/roche\s*:?\s*(\w+)/i))?.[1] || 'granite',
        },
        n_steps: 100,
        analysis_id: newAnalysis.id,
        user_id: project.user_id
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
        
        // Mettre à jour l'analyse avec le jobId et passer le statut global à 'processing'
        const { error: updateError } = await supabase
          .from('analyses')
          .update({ 
            status: 'processing',
            results: { 
              job_id: jobId || 'pending_calc', 
              status: 'running',
              started_at: new Date().toISOString()
            } 
          })
          .eq('id', newAnalysis.id);
        
        if (updateError) {
          console.error("Failed to update analysis status:", updateError);
        } else {
          console.log("Analysis status updated to processing successfully");
        }
      }

      // 5. Appel de l'Edge Function (optionnel, en arrière-plan)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL est requis pour la vérification physique.')
      }
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

      toast.success('Analysis started successfully 🚀')
      
      // Redirection immédiate
      router.push(`/dashboard/projects/${projectId}/analyses`)
      router.refresh()
      
    } catch (err: any) {
      console.error('Analysis execution error:', err)
      setErrorMsg(err.message || 'Unknown error')
      toast.error(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 relative">
      {/* Background Decorative */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] -z-10" />
      
      {/* Header Section */}
      <div className="space-y-4">
        <Link 
          href={`/dashboard/projects/${projectId}`}
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Back to project
        </Link>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-500 font-mono text-[10px] uppercase tracking-[0.3em] mb-2">
            <Zap className="w-4 h-4" /> 
            <span>New Physical Analysis</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">
            Start a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Simulation</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Sélectionnez un scénario industriel et configurez les paramètres physiques réalistes pour l'analyse PINN.
          </p>
        </div>
      </div>

      {/* Scenario Selection */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gauge className="w-5 h-5 text-blue-500" />
          Industrial Scenario
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => setSelectedScenario(scenario.id)}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                selectedScenario === scenario.id
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{scenario.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-sm">{scenario.name}</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{scenario.description}</p>
                </div>
              </div>
              {selectedScenario === scenario.id && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Name Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-4">
          <label className="block text-sm font-medium text-gray-300">
            Nom de l'analyse
          </label>
          <input
            {...register('name', { required: 'Le nom est requis' })}
            placeholder={`Analyse ${selectedScenario} - Industrial Validation`}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Cpu className="w-4 h-4" />
            <span>Active scenario: <strong className="text-blue-400">{selectedScenario}</strong></span>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Initialisation...
            </span>
          ) : (
            '🚀 Start PINN Simulation'
          )}
        </button>
      </form>
    </div>
  )
}
