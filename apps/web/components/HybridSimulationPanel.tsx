'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Activity, Shield, MapPin, Zap, TrendingUp, AlertCircle } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
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
            await createAnalysisFromHybridResults(jobData, projectId);
          }
          fetchJobs();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  const createAnalysisFromHybridResults = async (jobData: JobStatus, projectId: string) => {
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

      const { error: insertError } = await supabase
        .from('analyses')
        .insert([analysisData]);

      if (insertError) console.error('Supabase Insert Error:', insertError);
    } catch (err) {
      console.error('Failed to create analysis:', err);
    }
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/hybrid/run-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          job_name: config.jobName,
          case_path: config.casePath,
          scenario_type: scenarioType,
          scenario_inputs: config.scenarioInputs,
          n_steps: config.nSteps,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur serveur');
      
      setSelectedJob({
        jobId: data.job_id,
        name: config.jobName,
        status: 'running',
        createdAt: new Date().toISOString(),
      });
      startPollingForJob(data.job_id);
    } catch (err: any) {
      setError(err.message);
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
                <Input
                  type="number"
                  value={config.scenarioInputs[input.name]}
                  onChange={(e) => setConfig({
                    ...config,
                    scenarioInputs: { ...config.scenarioInputs, [input.name]: parseFloat(e.target.value) }
                  })}
                  className="bg-black/40 border-white/10 rounded-xl h-10"
                />
              </div>
            ))}
          </div>

          <Button 
            onClick={handleRunSimulation} 
            disabled={loading} 
            className="w-full bg-blue-600 hover:bg-blue-500 h-14 rounded-2xl font-black text-sm shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2 fill-current" />}
            LANCER SIMULATION RÉELLE
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
