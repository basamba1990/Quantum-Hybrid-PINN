'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Activity, Shield, MapPin, Zap, TrendingUp, AlertCircle, Upload, FileText } from 'lucide-react';
import { INDUSTRIAL_SCENARIOS, ScenarioType } from '@/types/simulation-scenarios';
import { createClient } from '@/lib/supabase/client';

interface JobStatus {
  jobId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
    results?: {
    iteration: number;
    cfdTime: number;
    mlTime: number;
    residuals: Record<string, number>;
    log: string;
    credibility_score?: number;
    scenario_outputs?: Record<string, any>;
    predictions3d?: any[];
    residual_history?: any[];
    uncertainty?: number;
    domain_bounds?: Record<string, number>;
    reynolds?: number;
    mach?: number;
  };
  errorMessage?: string;
}

export function HybridSimulationPanel({ projectId }: { projectId?: string }) {
  const [scenarioType, setScenarioType] = useState<ScenarioType>('H2_PIPELINE');
  const [config, setConfig] = useState({
    jobName: 'SIM-INDUSTRIAL-V8',
    casePath: 'industrial_v8',
    nSteps: 50,
    scenarioType: 'H2_PIPELINE' as ScenarioType,
    scenarioInputs: {} as Record<string, any>,
  });
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobStatus | null>(null);
  const [modeA, setModeA] = useState(false);
  const [modeAFileName, setModeAFileName] = useState<string | null>(null);
  const [modeASeries, setModeASeries] = useState<Array<{ time_s: number; pressure_Pa: number }>>([]);
  const [modeAParams, setModeAParams] = useState({
    wallTemperature_K: '',
    outletPressure_Pa: '',
    phase: 'inconnue',
    geometry: 'inconnue',
    defectType: 'inconnue',
    defectDimensions_m: '',
    defectPosition_m: '',
    sourceDescription: 'NASA NTRS 20140002987 Figure 5; digitalisation approximative'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAnalysisIdRef = useRef<string | null>(null);
  const supabase = createClient();

  const currentScenario = INDUSTRIAL_SCENARIOS[scenarioType];

  useEffect(() => {
    const defaultInputs = currentScenario.inputs.reduce((acc, input) => ({
      ...acc, [input.name]: input.defaultValue
    }), {});
    setConfig(prev => ({ ...prev, scenarioInputs: defaultInputs }));
  }, [scenarioType]);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  };

  const startPollingForJob = (jobId: string) => {
    if (!jobId) return;
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        
        const jobData = await res.json();
        setSelectedJob(jobData);
        
        if (jobData.status === 'completed' || jobData.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          if (jobData.status === 'completed' && projectId) {
            await createAnalysisFromHybridResults(jobData, projectId, pendingAnalysisIdRef.current);
          }
          fetchJobs();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  const createAnalysisFromHybridResults = async (jobData: JobStatus, projectId: string, analysisId?: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // ✅ SUPPRESSION DU SCORE FACTICE : Utilisation stricte de la donnée réelle
      const score = jobData.results?.credibility_score;
      if (score === undefined) {
        console.warn("Pas de score de crédibilité réel reçu du backend.");
      }

      const analysisData = {
        project_id: projectId,
        name: `Analyse Industrielle - ${jobData.name}`,
        title: `Simulation ${currentScenario.name}`,
        status: 'completed',
        credibility_score: score,
        scenario_type: scenarioType,
        results: {
          predictions3d: jobData.results?.predictions3d || [],
          residual_history: jobData.results?.residual_history || [],
          scenario_outputs: jobData.results?.scenario_outputs || {},
          domain_bounds: jobData.results?.domain_bounds || {},
          physical_metrics: {
            residuals: jobData.results?.residuals || {},
            reynolds: jobData.results?.reynolds,
            mach: jobData.results?.mach,
            uncertainty: jobData.results?.uncertainty,
          },
        },
        user_id: user.id,
        created_at: new Date().toISOString(),
      };

      const query = analysisId
        ? supabase.from('analyses').update(analysisData).eq('id', analysisId)
        : supabase.from('analyses').insert([analysisData]);
      const { error: persistError } = await query;
      if (persistError) console.error('Supabase analysis persistence error:', persistError);
    } catch (err) {
      console.error('Failed to create analysis:', err);
    }
  };

  const handleModeAFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error('Le CSV doit contenir un en-tête et au moins une ligne.');
      const header = lines[0].split(',').map(v => v.trim());
      const timeIndex = header.indexOf('time_s');
      const pressureIndex = header.indexOf('inlet_pressure_Pa_approx');
      if (timeIndex < 0 || pressureIndex < 0) {
        throw new Error('Colonnes requises absentes : time_s et inlet_pressure_Pa_approx.');
      }
      const series = lines.slice(1).map((line, index) => {
        const cols = line.split(',');
        const time_s = Number(cols[timeIndex]);
        const pressure_Pa = Number(cols[pressureIndex]);
        if (!Number.isFinite(time_s) || !Number.isFinite(pressure_Pa) || pressure_Pa <= 0) {
          throw new Error(`Ligne CSV invalide à la ligne ${index + 2}.`);
        }
        return { time_s, pressure_Pa };
      }).slice(0, 5000);
      setModeASeries(series);
      setModeAFileName(file.name);
      setModeA(true);
      setScenarioType('LH2_INFRASTRUCTURE_INTEGRITY');
      setError(null);
    } catch (err: any) {
      setModeASeries([]);
      setModeAFileName(null);
      setError(err.message || 'CSV Mode A invalide');
    }
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!projectId) throw new Error('Sélectionnez un projet avant de lancer une simulation.');
      if (modeA && modeASeries.length === 0) throw new Error('Importez une série CSV NASA avant de lancer le Mode A.');
      if (modeA && (!modeAParams.wallTemperature_K || !modeAParams.outletPressure_Pa)) {
        throw new Error('La température de paroi et la pression aval sont obligatoires pour le Mode A.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session Supabase absente.');

      const scenarioInputs = {
        ...config.scenarioInputs,
        mode: modeA ? 'A_DEMONSTRATION' : 'STANDARD',
        inlet_pressure_series: modeA ? modeASeries : undefined,
        mode_a_metadata: modeA ? {
          source: modeAParams.sourceDescription,
          file_name: modeAFileName,
          uncertainty: 'figure-digitization uncertainty; not raw tabulated data'
        } : undefined,
        wall_temperature_K: modeA ? Number(modeAParams.wallTemperature_K) : undefined,
        outlet_pressure_Pa: modeA ? Number(modeAParams.outletPressure_Pa) : undefined,
        phase: modeA ? modeAParams.phase : undefined,
        geometry: modeA ? modeAParams.geometry : undefined,
        defect_type: modeA ? modeAParams.defectType : undefined,
        defect_dimensions_m: modeA ? modeAParams.defectDimensions_m : undefined,
        defect_position_m: modeA ? modeAParams.defectPosition_m : undefined,
      };

      const { data: analysis, error: analysisError } = await supabase.from('analyses').insert([{
        project_id: projectId,
        user_id: user.id,
        name: `${modeA ? 'Mode A NASA' : 'Simulation'} - ${config.jobName}`,
        title: modeA ? 'LH2 chilldown — NASA Figure 5 (digitalisation approximative)' : config.jobName,
        status: 'pending',
        analysis_type: modeA ? 'lh2_mode_a' : 'physics_verification',
        scenario_type: scenarioType,
        results: { mode: modeA ? 'A_DEMONSTRATION' : 'STANDARD', source: modeAParams.sourceDescription }
      }]).select('id').single();
      if (analysisError || !analysis) throw new Error(`Impossible de créer l’analyse : ${analysisError?.message || 'identifiant absent'}`);
      pendingAnalysisIdRef.current = analysis.id;

      const response = await fetch('/api/hybrid/run-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          analysis_id: analysis.id,
          user_id: user.id,
          job_name: config.jobName,
          case_path: config.casePath,
          scenario_type: scenarioType,
          scenario_inputs: scenarioInputs,
          n_steps: config.nSteps,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur serveur');
      setSelectedJob({ jobId: data.job_id, name: config.jobName, status: 'running', createdAt: new Date().toISOString() });
      await supabase.from('analyses').update({ status: 'processing', results: { job_id: data.job_id, mode: modeA ? 'A_DEMONSTRATION' : 'STANDARD' } }).eq('id', analysis.id);
      startPollingForJob(data.job_id);
    } catch (err: any) {
      setError(err.message);
      if (pendingAnalysisIdRef.current) await supabase.from('analyses').update({ status: 'failed', error_message: err.message }).eq('id', pendingAnalysisIdRef.current);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-6 bg-slate-950 rounded-[40px] border border-white/5 shadow-2xl">
      {/* Configuration Panel */}
      <Card className="lg:col-span-1 bg-slate-900/40 border-white/5 text-white rounded-3xl overflow-hidden backdrop-blur-md">
        <CardHeader className="bg-blue-600/10 border-b border-white/5">
          <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tighter">
            <Zap className="w-5 h-5 text-blue-400" /> SETUP INDUSTRIEL
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-gray-500">Scénario de Production</Label>
            <Select value={scenarioType} onValueChange={(val: ScenarioType) => setScenarioType(val)}>
              <SelectTrigger className="bg-black/40 border-white/10 rounded-xl h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-white border-white/10">
                {Object.values(INDUSTRIAL_SCENARIOS).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Paramètres Physiques</p>
            {currentScenario.inputs.map(input => (
              <div key={input.name} className="space-y-2">
                <Label className="text-[11px] font-bold text-gray-400 flex justify-between">
                  {input.label}
                  <span className="text-blue-500/50">{input.unit}</span>
                </Label>
                {input.type === 'select' ? (
                  <Select 
                    value={String(config.scenarioInputs[input.name] || input.defaultValue)} 
                    onValueChange={(val) => setConfig({
                      ...config,
                      scenarioInputs: { ...config.scenarioInputs, [input.name]: val }
                    })}
                  >
                    <SelectTrigger className="bg-black/40 border-white/10 rounded-xl h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 text-white border-white/10">
                      {input.options?.map((opt, idx) => (
                        <SelectItem key={`${input.name}-opt-${idx}`} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={input.type === 'number' ? 'number' : 'text'}
                    value={config.scenarioInputs[input.name] ?? ''}
                    onChange={(e) => setConfig({
                      ...config,
                      scenarioInputs: { 
                        ...config.scenarioInputs, 
                        [input.name]: input.type === 'number' ? parseFloat(e.target.value) : e.target.value 
                      }
                    })}
                    className="bg-black/40 border-white/10 rounded-xl h-10"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-amber-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Mode A — Benchmark NASA</p>
                <p className="text-[10px] text-gray-500">Démonstration transitoire avec incertitude de digitalisation</p>
              </div>
              <button type="button" onClick={() => { setModeA(!modeA); if (!modeA) setScenarioType('LH2_INFRASTRUCTURE_INTEGRITY'); }} className={`px-3 py-2 rounded-lg text-[10px] font-black ${modeA ? 'bg-amber-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                {modeA ? 'MODE A ACTIF' : 'ACTIVER MODE A'}
              </button>
            </div>
            {modeA && <div className="space-y-3">
              <label className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 cursor-pointer">
                <Upload className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-300">Importer CSV NASA</span>
                <input type="file" accept=".csv,text/csv" onChange={handleModeAFile} className="hidden" />
                <span className="ml-auto text-[10px] text-amber-300 truncate max-w-[130px]">{modeAFileName || 'Aucun fichier'}</span>
              </label>
              {modeASeries.length > 0 && <p className="text-[10px] text-emerald-400"><FileText className="inline w-3 h-3 mr-1" />{modeASeries.length} points pression–temps validés (Pa, s)</p>}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-[10px] text-gray-400">Température paroi (K)</Label><Input type="number" value={modeAParams.wallTemperature_K} onChange={e => setModeAParams({...modeAParams, wallTemperature_K: e.target.value})} placeholder="Obligatoire" className="bg-black/40 border-white/10" /></div>
                <div><Label className="text-[10px] text-gray-400">Pression aval (Pa)</Label><Input type="number" value={modeAParams.outletPressure_Pa} onChange={e => setModeAParams({...modeAParams, outletPressure_Pa: e.target.value})} placeholder="Obligatoire" className="bg-black/40 border-white/10" /></div>
                <div><Label className="text-[10px] text-gray-400">Phase</Label><Select value={modeAParams.phase} onValueChange={v => setModeAParams({...modeAParams, phase: v})}><SelectTrigger className="bg-black/40 border-white/10"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 text-white"><SelectItem value="liquide">Liquide</SelectItem><SelectItem value="vapeur">Vapeur</SelectItem><SelectItem value="diphasique">Diphasique</SelectItem><SelectItem value="inconnue">Inconnue</SelectItem></SelectContent></Select></div>
                <div><Label className="text-[10px] text-gray-400">Géométrie</Label><Input value={modeAParams.geometry} onChange={e => setModeAParams({...modeAParams, geometry: e.target.value})} placeholder="conduite, réservoir..." className="bg-black/40 border-white/10" /></div>
                <div><Label className="text-[10px] text-gray-400">Type défaut</Label><Input value={modeAParams.defectType} onChange={e => setModeAParams({...modeAParams, defectType: e.target.value})} placeholder="trou, fissure..." className="bg-black/40 border-white/10" /></div>
                <div><Label className="text-[10px] text-gray-400">Dimensions défaut (m)</Label><Input value={modeAParams.defectDimensions_m} onChange={e => setModeAParams({...modeAParams, defectDimensions_m: e.target.value})} placeholder="Non renseigné" className="bg-black/40 border-white/10" /></div>
              </div>
              <div><Label className="text-[10px] text-gray-400">Position défaut [x,y,z] (m)</Label><Input value={modeAParams.defectPosition_m} onChange={e => setModeAParams({...modeAParams, defectPosition_m: e.target.value})} placeholder="Non renseigné" className="bg-black/40 border-white/10" /></div>
              <p className="text-[10px] text-amber-300/80">Source : {modeAParams.sourceDescription}. Les données brutes NASA ne sont pas remplacées par cette digitalisation.</p>
            </div>}
          </div>

          <Button 
            onClick={handleRunSimulation} 
            disabled={loading} 
            className="w-full bg-blue-600 hover:bg-blue-500 h-14 rounded-2xl font-black text-sm shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2 fill-current" />}
            {modeA ? 'LANCER MODE A — NASA' : 'LANCER SIMULATION RÉELLE'}
          </Button>
        </CardContent>
      </Card>

      {/* Real-time Dashboard */}
      <Card className="lg:col-span-3 bg-black/20 border-white/5 text-white rounded-3xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-8 bg-white/[0.02]">
          <div>
            <CardTitle className="text-3xl font-black tracking-tighter">OPÉRATIONS LIVE</CardTitle>
            <CardDescription className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mt-1">Moteur PINN v8.5 // Synchronisation Données Réelles</CardDescription>
          </div>
          {selectedJob && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-500 uppercase">Statut Système</p>
                <p className={`text-xs font-bold ${selectedJob.status === 'completed' ? 'text-emerald-500' : 'text-blue-500 animate-pulse'}`}>
                  {selectedJob.status.toUpperCase()}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedJob.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>
                <Activity className="w-6 h-6" />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-8">
          {!selectedJob ? (
            <div className="h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[32px] bg-white/[0.01]">
              <Activity className="w-20 h-20 text-white/5 mb-6" />
              <p className="text-gray-600 font-black uppercase tracking-[0.3em] text-xs">Système en Veille</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* KPIs Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {currentScenario.outputs.slice(0, 4).map(out => (
                  <div key={out.name} className="bg-white/5 border border-white/10 p-5 rounded-2xl group hover:border-blue-500/30 transition-all">
                    <p className="text-[9px] font-black text-gray-500 uppercase mb-3 tracking-widest">{out.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors">
                        {selectedJob.results?.scenario_outputs?.[out.name]?.toFixed(2) ?? '--'}
                      </span>
                      <span className="text-[10px] text-gray-600 font-bold">{out.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Visualization & Metrics */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-blue-600/5 border border-blue-500/10 rounded-3xl p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h4 className="text-lg font-black text-white">Crédibilité de Simulation</h4>
                      <p className="text-xs text-gray-500">Basé sur les résidus Navier-Stokes réels</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-blue-500">
                        {selectedJob.results?.credibility_score ? `${selectedJob.results.credibility_score.toFixed(1)}%` : '--'}
                      </div>
                      <p className="text-[10px] font-bold text-gray-600 uppercase">Score de Confiance</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                      <span>Convergence Physique</span>
                      <span>{selectedJob.results?.iteration || 0} / {config.nSteps} Steps</span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-500" 
                        style={{ width: `${(selectedJob.results?.iteration || 0) / config.nSteps * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" /> Analyse de Risque
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400">Incertitude</span>
                      <span className="text-sm font-black text-orange-500">
                        {selectedJob.results?.uncertainty ? `${(selectedJob.results.uncertainty * 100).toFixed(2)}%` : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400">Reynolds</span>
                      <span className="text-sm font-black text-blue-400">
                        {selectedJob.results?.reynolds?.toExponential(1) ?? '--'}
                      </span>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase">
                        <TrendingUp className="w-3 h-3" /> Système Stable
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Console Output */}
              <div className="bg-black/60 rounded-2xl border border-white/5 p-5 font-mono text-[10px] text-emerald-500/70 h-32 overflow-y-auto shadow-inner">
                <div className="flex items-center gap-2 mb-3 text-gray-600 border-b border-white/5 pb-2">
                  <AlertCircle className="w-3 h-3" /> INDUSTRIAL_LOG_V8.5
                </div>
                {selectedJob.results?.log?.split('\n').map((line, i) => (
                  <div key={i} className="mb-1 flex gap-4">
                    <span className="text-gray-800">[{new Date().toLocaleTimeString()}]</span>
                    <span>{line}</span>
                  </div>
                ))}
                {selectedJob.status === 'running' && <p className="animate-pulse">_ EXECUTION EN COURS...</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
