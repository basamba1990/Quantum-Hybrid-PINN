'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Activity, Shield, MapPin, Zap } from 'lucide-react';
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
    credibilityScore?: number;
    credibility_score?: number;  // ✅ ajout pour support backend
    scenario_outputs?: Record<string, any>;
    predictions3d?: any[];
    residual_history?: any[];
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
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          setSelectedJob(prev => prev ? { 
            ...prev, 
            status: 'failed',
            errorMessage: errorData.error || `Backend returned status ${res.status}`
          } : null);
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          return;
        }
        
        const jobData = await res.json();
        
        if (!jobData || !jobData.jobId) {
          console.error('Invalid job data received:', jobData);
          return;
        }

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
        setError(`Erreur lors du polling du job ${jobId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }, 2000);
  };

  const createAnalysisFromHybridResults = async (jobData: JobStatus, projectId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const score = jobData.results?.credibilityScore ?? jobData.results?.credibility_score ?? 0;

      const analysisData = {
        project_id: projectId,
        name: `Analyse Hybride - ${jobData.name}`,
        title: `Analyse Hybride - ${jobData.name}`,
        status: 'completed',
        credibility_score: score,
        results: {
          predictions3d: jobData.results?.predictions3d || [],
          residual_history: jobData.results?.residual_history || [],
          physical_metrics: {
            residuals: jobData.results?.residuals || {},
          },
        },
        user_id: user.id,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('analyses')
        .insert([analysisData]);

      if (insertError) {
        console.error('Error creating analysis from hybrid results:', insertError);
      }
    } catch (err) {
      console.error('Failed to create analysis from hybrid results:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

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
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        throw new Error(data.error || `Backend error: ${response.status}`);
      }
      
      const newJobId = data.job_id;
      const tempJob: JobStatus = {
        jobId: newJobId,
        name: config.jobName,
        status: 'running',
        createdAt: new Date().toISOString(),
      };
      setSelectedJob(tempJob);
      startPollingForJob(newJobId);
      fetchJobs();
    } catch (err: any) {
      setError(err.message);
      setSelectedJob(null);
    } finally {
      setLoading(false);
    }
  };

  const getCredibilityScore = (results?: JobStatus['results']) => {
    return results?.credibilityScore ?? results?.credibility_score ?? 0;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4">
      <Card className="lg:col-span-1 border-t-4 border-t-blue-500 shadow-xl bg-slate-900/50 backdrop-blur-sm text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Configuration Industrielle
          </CardTitle>
          <CardDescription className="text-slate-400">Sélectionnez votre cas d'usage ZLECAf</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Scénario Industriel</Label>
            <Select value={scenarioType} onValueChange={(val: ScenarioType) => setScenarioType(val)}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 text-white border-slate-700">
                {Object.values(INDUSTRIAL_SCENARIOS).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-xs text-blue-200 leading-relaxed">{currentScenario.description}</p>
          </div>
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Paramètres d'Entrée
            </h4>
            {currentScenario.inputs.map(input => (
              <div key={input.name} className="space-y-2">
                <Label className="text-xs flex justify-between">
                  {input.label}
                  {input.unit && <span className="text-slate-500">[{input.unit}]</span>}
                </Label>
                {input.type === 'select' ? (
                  <Select
                    value={config.scenarioInputs[input.name]}
                    onValueChange={(val) => setConfig({
                      ...config,
                      scenarioInputs: { ...config.scenarioInputs, [input.name]: val }
                    })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 text-white">
                      {input.options?.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    value={config.scenarioInputs[input.name]}
                    onChange={(e) => setConfig({
                      ...config,
                      scenarioInputs: { ...config.scenarioInputs, [input.name]: parseFloat(e.target.value) }
                    })}
                    className="bg-slate-800 border-slate-700"
                  />
                )}
              </div>
            ))}
          </div>
          <Button onClick={handleRunSimulation} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-6 rounded-xl transition-all">
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2" />}
            Démarrer Simulation Industrielle
          </Button>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 bg-slate-950 border-slate-800 text-white overflow-hidden shadow-2xl">
        <CardHeader className="border-b border-slate-800 bg-slate-900/50">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-black">Tableau de Bord Scénario</CardTitle>
              <CardDescription className="text-slate-500">Visualisation en temps réel des KPIs industriels</CardDescription>
            </div>
            {selectedJob && (
              <Badge variant={selectedJob.status === 'completed' ? 'secondary' : 'default'} className="px-4 py-1">
                {selectedJob.status.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedJob ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-slate-600 space-y-4">
              <Activity className="w-16 h-16 opacity-20" />
              <p className="font-mono text-sm uppercase tracking-widest">En attente de données...</p>
            </div>
          ) : selectedJob.status === 'failed' ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-red-400 space-y-4 p-8">
              <Shield className="w-16 h-16 opacity-50" />
              <p className="font-mono text-sm uppercase tracking-widest">Erreur de Simulation</p>
              <p className="text-xs text-red-300">{selectedJob.errorMessage || 'Une erreur est survenue lors de la simulation'}</p>
            </div>
          ) : (
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {currentScenario.outputs.map(out => (
                  <div key={out.name} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                      <Shield className="w-8 h-8" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{out.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-blue-400">
                        {selectedJob.results?.scenario_outputs?.[out.name] ?? '--'}
                      </span>
                      <span className="text-xs text-slate-600 font-bold">{out.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-tighter text-slate-500">
                <span className="flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> Localisation: {config.scenarioInputs.portLocation || 'Offshore / Site'}
                </span>
                <span>Score de Crédibilité: {getCredibilityScore(selectedJob.results)}%</span>
              </div>
              <div className="bg-black/50 rounded-xl p-4 font-mono text-[10px] text-emerald-500/80 border border-emerald-500/10 h-32 overflow-y-auto">
                <p className="mb-2 text-slate-500">--- DÉBUT LOG SIMULATION PINN V8 ---</p>
                {selectedJob.results?.log?.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                {selectedJob.status === 'running' && <p className="animate-pulse">_</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
