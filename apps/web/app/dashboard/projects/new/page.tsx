'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { 
  Plus, 
  ArrowLeft, 
  Video, 
  FileText, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Info,
  Rocket,
  Atom
} from 'lucide-react'
import Link from 'next/link'
import { normalizeScenarioType } from '@/types/simulation-scenarios'
import { CFDImportForm } from '@/components/cfd/CFDImportForm'
import { defaultPinnProfile, hashPinnProfile, type PinnTrainingProfile } from '@/types/pinn-training'
import { pinnTrainingProfileSchema } from '@/lib/pinn-training-schema'

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<{
    name: string
    description: string
    scenario: string
    solver: string
    hydrogenForm: string
    temperatureK: string
    pressureBar: string
    video?: FileList
    transcription?: string
    pinn: PinnTrainingProfile
  }>({
    defaultValues: {
      scenario: 'LH2_INTERNAL_TRANSIENT',
      solver: 'OpenFOAM_THERMO_COMPRESSIBLE_CANDIDATE',
      hydrogenForm: 'PARAHYDROGEN_PENDING_APPROVAL',
      temperatureK: '20.28',
      pressureBar: '1.01325',
      pinn: defaultPinnProfile,
    }
  })

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [jsonFile, setJsonFile] = useState<File | null>(null)
  const [jsonData, setJsonData] = useState<any>(null)
  const [cfdProjectId, setCfdProjectId] = useState<string | null>(null)

  const persistPinnProfile = async (projectId: string, profile: PinnTrainingProfile, userId: string) => {
    const parsed = pinnTrainingProfileSchema.safeParse(profile)
    if (!parsed.success) throw new Error(`Contrat PINN invalide : ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)
    const profileHash = await hashPinnProfile(parsed.data)
    const { error } = await supabase.from('pinn_training_profiles').upsert({
      project_id: projectId, user_id: userId, profile_version: parsed.data.profileVersion,
      classification: parsed.data.classification, project_status_required: parsed.data.projectStatusRequired,
      solver_execution: parsed.data.solverExecution, dataset: parsed.data.dataset, model_config: parsed.data.modelConfig,
      sampling: parsed.data.sampling, loss_weights: parsed.data.lossWeights, schedule: parsed.data.schedule,
      acceptance: parsed.data.acceptance, profile_hash: profileHash, updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id' })
    if (error) throw new Error(`Persistance du contrat PINN impossible : ${error.message}`)
    return { profile: parsed.data, profileHash }
  }

  const ensureCfdProject = async (): Promise<string> => {
    if (cfdProjectId) return cfdProjectId
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Session expired or user not found.')
    const name = watch('name')?.trim()
    if (!name) throw new Error('Enter the project identifier before importing CFD data.')
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name,
        description: watch('description')?.trim() || null,
        category: normalizeScenarioType(name),
        user_id: user.id,
        status: 'draft',
        validation_status: 'STRUCTURAL_TEST_UNVALIDATED',
      })
      .select('id')
      .single()
    if (error || !project?.id) throw new Error(`CFD project creation failed: ${error?.message ?? 'missing identifier'}`)
    await persistPinnProfile(project.id, getValues('pinn'), user.id)
    setCfdProjectId(project.id)
    return project.id
  }

  const onSubmit = async (formData: { name: string; description: string; scenario: string; solver: string; hydrogenForm: string; temperatureK: string; pressureBar: string; video?: FileList; transcription?: string; pinn: PinnTrainingProfile }) => {
    setLoading(true)
    setErrorMsg(null)
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error("Session expired or user not found. Please sign in again.")
      }

      let videoUrl = null
      
      if (formData.video && formData.video.length > 0) {
        setUploading(true)
        const videoFile = formData.video[0]
        
        const validVideoTypes = ['video/mp4', 'video/webm', 'video/mpeg', 'video/quicktime']
        if (!validVideoTypes.includes(videoFile.type)) {
          throw new Error('Unsupported video format. Use MP4, WebM or MOV.')
        }

        const maxSize = 500 * 1024 * 1024
        if (videoFile.size > maxSize) {
          throw new Error('The video is too large (maximum 500 MB).')
        }

        const fileName = `${user.id}/${Date.now()}_${videoFile.name}`

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, videoFile, { upsert: false })

        if (uploadError) {
          console.error('Video upload error:', uploadError)
          throw new Error(`Video upload failed: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('videos')
          .getPublicUrl(fileName)

        videoUrl = publicUrl
        setUploading(false)
      }

      const parsedPinn = pinnTrainingProfileSchema.safeParse(formData.pinn)
      if (!parsedPinn.success) throw new Error(`Contrat PINN invalide : ${parsedPinn.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' | ')}`)
      const profileHash = await hashPinnProfile(parsedPinn.data)
      const { data: newProject, error: insertError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description,
        category: normalizeScenarioType(formData.scenario) || normalizeScenarioType(formData.name),
          video_url: videoUrl,
              transcription: [
                formData.transcription,
                `PILOT-LH2-001 | scenario=${formData.scenario} | solver=${formData.solver} | hydrogen_form=${formData.hydrogenForm} | reference_temperature_K=${formData.temperatureK} | reference_pressure_bar=${formData.pressureBar} | evidence_status=INCONCLUSIVE`
              ].filter(Boolean).join('\n\n') || null,
          user_id: user.id,
          status: 'draft',
          validation_status: parsedPinn.data.projectStatusRequired,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        if (videoUrl) {
          const fileName = `${user.id}/${Date.now()}_${formData.video?.[0].name}`
          await supabase.storage.from('videos').remove([fileName])
        }
        throw new Error(`Project creation failed: ${insertError.message}`)
      }

      if (newProject) {
        await persistPinnProfile(newProject.id, parsedPinn.data, user.id)
        toast.success('Simulation nexus initialized')
        
        // En mode industriel, nous déclenchons automatiquement l'analyse physique 
        // si une transcription ou des paramètres sont fournis
        if (formData.transcription || parsedPinn.data) {
          // Create an analysis entry first
          const { data: newAnalysis, error: analysisError } = await supabase
            .from('analyses')
            .insert({
              project_id: newProject.id,
              user_id: user.id,
              title: `Automatic analysis: ${formData.name}`,
              description: `Automatically generated analysis for project ${formData.name}`,
              analysis_type: 'auto_pinn_v8',
              transcription: formData.transcription,
              status: 'pending',
            })
            .select()
            .single();

          if (analysisError) {
            console.error('Analysis creation error:', analysisError);
            throw new Error(`Analysis creation failed: ${analysisError.message}`);
          }

          if (newAnalysis) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            // ✅ CORRECTIF V8.3 : Utiliser l'API principale pour garantir l'unicité et le traitement réel
            const industrialApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';
            
            fetch(`${industrialApiUrl}/v2/submit-analysis`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: newProject.id,
                analysisId: newAnalysis.id,
                name: `Automatic analysis: ${formData.name}`,
                transcription: formData.transcription,
                userId: user.id,
                predictions3d: jsonData?.analysis?.results?.predictions3d || null,
                modelConfig: {
                  ...parsedPinn.data.modelConfig,
                  sampling: parsedPinn.data.sampling,
                  lossWeights: parsedPinn.data.lossWeights,
                  schedule: parsedPinn.data.schedule,
                  acceptance: parsedPinn.data.acceptance,
                  pinnProfile: parsedPinn.data,
                },
                pinnProfile: parsedPinn.data,
                pinnProfileHash: profileHash,
                validationStatus: parsedPinn.data.projectStatusRequired,
              })
            }).catch(err => console.error("Auto-analysis trigger failed:", err));
            
            toast.info('PINN physics analysis started in the background...');
          } catch (err) {
            console.error("Failed to trigger auto-analysis:", err);
          }
        }
        }

        router.push(`/dashboard/projects/${newProject.id}`)
        router.refresh()
      }
    } catch (err: any) {
      console.error('Error:', err)
      setErrorMsg(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 relative">
      {/* Background Decorative */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] -z-10" />
      
      {/* Header Section */}
      <div className="space-y-4">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Nexus
        </Link>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-500 font-mono text-[10px] uppercase tracking-[0.3em] mb-2">
            <Atom className="w-4 h-4" /> 
            <span>Simulation Initialization</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">
            New <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">PINN Project</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Configure your hybrid research environment for Navier–Stokes and thermal diffusion analysis.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Main Configuration (Left) */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-8 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] -z-10" />
            
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Cpu className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Core Parameters</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  Project Identifier *
                </label>
                <input
                  id="name"
                  {...register('name', { required: 'Project name is required' })}
                  className="w-full border border-white/10 bg-white/5 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-lg font-bold"
                  placeholder="Ex: H2-CYLINDER-V8-SIM"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  Scientific Summary
                </label>
                <textarea
                  id="description"
                  {...register('description')}
                  className="w-full border border-white/10 bg-white/5 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[120px] leading-relaxed"
                  placeholder="Describe the physical objectives of this simulation..."
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-8 space-y-8">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">LH2 Production Pilot</h2>
                <p className="text-[10px] uppercase tracking-widest text-emerald-300/70 mt-1">PILOT-LH2-001 · evidence-first</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="scenario" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Scenario</label>
                <select id="scenario" {...register('scenario')} className="w-full border border-white/10 bg-slate-950/60 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                  <option value="LH2_TANK_THERMO_MULTIPHASE_V1">LH2 · 50 L tank VOF multiphase reference case</option>
                  <option value="PCCV_TRANSIENT_THERMO_V1">PCCV · five-way moving-valve transient case</option>
                  <option value="LH2_INTERNAL_TRANSIENT">LH2 · internal transient + wall heat transfer</option>
                  <option value="LH2_STORAGE_THERMAL_SCREENING">LH2 · storage thermal screening</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="solver" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Solver contract</label>
                <select id="solver" {...register('solver')} className="w-full border border-white/10 bg-slate-950/60 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                  <option value="OpenFOAM_THERMO_COMPRESSIBLE_CANDIDATE">OpenFOAM · thermo-compressible candidate</option>
                  <option value="SU2_COMPRESSIBLE_ALTERNATIVE">SU2 · compressible alternative</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="hydrogenForm" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">H₂ form</label>
                <select id="hydrogenForm" {...register('hydrogenForm')} className="w-full border border-white/10 bg-slate-950/60 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                  <option value="PARAHYDROGEN_PENDING_APPROVAL">Parahydrogen · pending approval</option>
                  <option value="NORMAL_HYDROGEN_PENDING_APPROVAL">Normal hydrogen · pending approval</option>
                  <option value="ORTHOHYDROGEN_PENDING_APPROVAL">Orthohydrogen · pending approval</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="temperatureK" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Reference T (K)</label>
                <input id="temperatureK" type="number" step="0.01" {...register('temperatureK')} className="w-full border border-white/10 bg-white/5 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
              </div>
              <div className="space-y-2">
                <label htmlFor="pressureBar" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Reference p (bar)</label>
                <input id="pressureBar" type="number" step="0.00001" {...register('pressureBar')} className="w-full border border-white/10 bg-white/5 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
              </div>
            </div>

            <div className="flex items-start gap-2 p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-200/80 leading-relaxed uppercase tracking-tight">Statut initial INCONCLUSIVE. Les propriétés NIST, la convergence CFD, les tolérances et la reproduction doivent être prouvées avant tout PASS.</p>
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-gray-500 border-t border-white/5 pt-5">
              <span>Train: CFD-BASELINE</span><span>Eval: CFD-INDEPENDENT</span>
            </div>

            <div className="pt-4 border-t border-white/5">
              <h3 className="text-sm font-bold text-white mb-6">Physical Data</h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="json-import" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  Import JSON Data (Optional)
                </label>
                <div className="relative group">
                  <input
                    id="json-import"
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        const file = e.target.files[0]
                        setJsonFile(file)
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          try {
                            const data = JSON.parse(event.target?.result as string)
                            setJsonData(data)
                            const candidate = data?.pinnTrainingProfile ?? data?.pinn ?? data
                            const parsed = pinnTrainingProfileSchema.safeParse(candidate)
                            if (parsed.success) {
                              setValue('pinn', parsed.data)
                              toast.success('PINN preset loaded and validated')
                            }
                            toast.success('JSON data loaded successfully')
                          } catch (err) {
                            toast.error('Error: invalid JSON format')
                          }
                        }
                        reader.readAsText(file)
                      }
                    }}
                    className="hidden"
                  />
                  <label 
                    htmlFor="json-import"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-[24px] bg-white/[0.02] group-hover:bg-white/5 group-hover:border-emerald-500/30 transition-all cursor-pointer p-4 text-center"
                  >
                    <FileText className="w-6 h-6 text-gray-600 group-hover:text-emerald-500 mb-2 transition-colors" />
                    <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">Load JSON</span>
                    <span className="text-[9px] text-gray-600 mt-1 uppercase tracking-tighter">3D PINN data</span>
                    {jsonFile && (
                      <div className="mt-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <p className="text-[9px] text-emerald-400 font-bold truncate max-w-[150px]">✓ {jsonFile.name}</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><h3 className="text-sm font-black uppercase tracking-widest text-cyan-200">PINN Training Contract</h3><p className="text-[10px] text-cyan-200/60 mt-1">Source de vérité structurée · indépendante des notes libres</p></div>
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[9px] font-bold text-amber-200">NON VALIDÉ</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Profile version<input {...register('pinn.profileVersion', { required: true })} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Mesh revision<input {...register('pinn.dataset.meshRevision')} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" placeholder="synthetic-lh2-mesh-v1" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Frames<input type="number" min="1" {...register('pinn.dataset.frames', { valueAsNumber: true })} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Epochs<input type="number" min="1" {...register('pinn.modelConfig.epochs', { valueAsNumber: true })} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Learning rate<input type="number" step="0.000001" {...register('pinn.modelConfig.learningRate', { valueAsNumber: true })} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Batch size<input type="number" min="1" {...register('pinn.modelConfig.batchSize', { valueAsNumber: true })} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Seed<input type="number" min="0" {...register('pinn.modelConfig.seed', { valueAsNumber: true })} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Activation<select {...register('pinn.modelConfig.activation')} className="mt-2 w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs text-white"><option value="tanh">tanh</option><option value="relu">ReLU</option><option value="gelu">GELU</option><option value="sine">Sine</option></select></label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Coordinates<input {...register('pinn.modelConfig.normalization.coordinates')} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Time<input {...register('pinn.modelConfig.normalization.time')} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Outputs<input {...register('pinn.modelConfig.normalization.outputs')} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white" /></label>
                  </div>
                  {errors.pinn && <p className="text-xs text-red-300">Contrat invalide : vérifiez les champs PINN et la cohérence entrées/sorties.</p>}
                  <div className="rounded-xl bg-black/30 p-4 font-mono text-[10px] leading-5 text-cyan-100/80"><div>Architecture : {watch('pinn.modelConfig.layers').join(' → ')}</div><div>Entrées : {watch('pinn.modelConfig.inputOrder').join(', ')} · Sorties : {watch('pinn.modelConfig.outputOrder').join(', ')}</div><div>Sampling : {watch('pinn.sampling.strategy')} · PDE : {watch('pinn.sampling.N_pde')} · Boundary : {watch('pinn.sampling.N_boundary')}</div><div>Statut requis : {watch('pinn.projectStatusRequired')} · Solver : {watch('pinn.solverExecution')}</div></div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="transcription" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  Transcription or Parameters (Critical for PINN)
                </label>
                <textarea
                  id="transcription"
                  {...register('transcription')}
                  className="w-full border border-white/10 bg-white/5 rounded-2xl px-5 py-4 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[160px] leading-relaxed"
                  placeholder="Paste text data, transcripts or physical parameters to be analyzed by the AI..."
                  rows={6}
                />
                <div className="flex items-start gap-2 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl mt-2">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-400/80 leading-relaxed uppercase tracking-tight">
                    The PINN V8 engine will use this text to extract pressure, temperature and flux variables through GPT-4o.
                  </p>
                </div>
              </div>
              </div>
            </div>
          </div>

          <CFDImportForm
            caseId={watch('name') || ''}
            projectId={cfdProjectId ?? undefined}
            onBeforeImport={ensureCfdProject}
            onImported={(result) => {
              const importedProjectId = result.projectId ?? cfdProjectId
              if (result.analysisId && importedProjectId) {
                router.push(`/dashboard/projects/${importedProjectId}?cfdAnalysisId=${encodeURIComponent(result.analysisId)}`)
                router.refresh()
              }
            }}
          />
        </div>

        {/* Media & Action (Right) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[32px] p-8 space-y-8">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="p-2.5 bg-purple-500/10 rounded-xl">
                <Video className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Source Media</h2>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                <input
                  id="video"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  {...register('video')}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setVideoFile(e.target.files[0])
                    }
                  }}
                  className="hidden"
                />
                <label 
                  htmlFor="video"
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/10 rounded-[24px] bg-white/[0.02] group-hover:bg-white/5 group-hover:border-blue-500/30 transition-all cursor-pointer p-6 text-center"
                >
                  <Video className="w-8 h-8 text-gray-600 group-hover:text-blue-500 mb-4 transition-colors" />
                  <span className="text-sm font-bold text-gray-400 group-hover:text-white transition-colors">Load Simulation Video</span>
                  <span className="text-[10px] text-gray-600 mt-2 uppercase tracking-tighter">MP4, WebM (Max 500MB)</span>
                  {videoFile && (
                    <div className="mt-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                      <p className="text-[10px] text-emerald-400 font-bold truncate max-w-[150px]">✓ {videoFile.name}</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                <Zap className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 font-medium leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || uploading}
              className="w-full group relative px-8 py-6 bg-white text-black font-black rounded-[24px] overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-white/5"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity" />
              <span className="relative flex items-center justify-center gap-3 text-lg">
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-black/10 border-t-black rounded-full animate-spin" />
                    Flux Vidéo...
                  </>
                ) : loading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-black/10 border-t-black rounded-full animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Rocket className="w-6 h-6" />
                    Start Simulation
                  </>
                )}
              </span>
            </button>
            
            <p className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
              Nexus v8.0 DeepTech Infrastructure
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}
