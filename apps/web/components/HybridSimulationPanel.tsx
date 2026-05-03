/**
 * Hybrid Simulation Configuration Panel
 * Allows users to configure and launch hybrid CFD-ML simulations
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Pause, RotateCcw, Download } from 'lucide-react';

interface HybridSimulationConfig {
  jobName: string;
  casePath: string;
  nSteps: number;
  timeStep: number;
  residualThreshold: number;
  fields: string[];
}

interface JobStatus {
  jobId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  results?: {
    status: string;
    iteration: number;
    cfdTime: number;
    mlTime: number;
    residuals: Record<string, number>;
    log: string;
  };
  errorMessage?: string;
}

interface HybridSimulationPanelProps {
  onJobSelected?: (job: JobStatus) => void;
}

export function HybridSimulationPanel({ onJobSelected }: HybridSimulationPanelProps) {
  const [config, setConfig] = useState<HybridSimulationConfig>({
    jobName: 'Hybrid Simulation',
    casePath: '/path/to/case',
    nSteps: 100,
    timeStep: 0.01,
    residualThreshold: 0.01,
    fields: ['U', 'p', 'T'],
  });

  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
        
        // Update selected job if it exists
        if (selectedJob) {
          const updated = data.find((j: JobStatus) => j.jobId === selectedJob.jobId);
          if (updated) {
            setSelectedJob(updated);
            if (onJobSelected) onJobSelected(updated);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
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
          project_id: (window as any).location.pathname.split('/').pop(), // Extract project ID from URL
          job_name: config.jobName,
          case_path: config.casePath,
          n_steps: config.nSteps,
          time_step: config.timeStep,
          residual_threshold: config.residualThreshold,
          fields: config.fields,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start simulation');
      }
      const newJob: JobStatus = {
        jobId: data.job_id,
        name: config.jobName,
        status: 'running',
        createdAt: new Date().toISOString(),
      };
      setSelectedJob(newJob);
      if (onJobSelected) onJobSelected(newJob);
      setIsRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSimulation = async () => {
    if (!selectedJob) return;
    setIsRunning(false);
  };

  const handleResetConfig = () => {
    setConfig({
      jobName: 'Hybrid Simulation',
      casePath: '/path/to/case',
      nSteps: 100,
      timeStep: 0.01,
      residualThreshold: 0.01,
      fields: ['U', 'p', 'T'],
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      running: 'default',
      completed: 'secondary',
      failed: 'destructive',
    };
    return variants[status] || 'default';
  };

  // ---------- MODIFIED PROGRESS FUNCTION ----------
  const calculateProgress = (job: JobStatus) => {
    if (!job.results || !job.results.iteration) return null;
    return (job.results.iteration / config.nSteps) * 100;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Configuration Panel */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle>Hybrid CFD-ML Simulation</CardTitle>
          <CardDescription>
            Configure and launch hybrid simulations combining OpenFOAM and ML predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Configuration Tab */}
            <TabsContent value="config" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="jobName">Job Name</Label>
                <Input
                  id="jobName"
                  value={config.jobName}
                  onChange={(e) =>
                    setConfig({ ...config, jobName: e.target.value })
                  }
                  placeholder="Enter simulation job name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="casePath">OpenFOAM Case Path</Label>
                <Input
                  id="casePath"
                  value={config.casePath}
                  onChange={(e) =>
                    setConfig({ ...config, casePath: e.target.value })
                  }
                  placeholder="/path/to/openfoam/case"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nSteps">Number of Steps</Label>
                  <Input
                    id="nSteps"
                    type="number"
                    value={config.nSteps}
                    onChange={(e) =>
                      setConfig({ ...config, nSteps: parseInt(e.target.value) })
                    }
                    min="1"
                    max="10000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeStep">Time Step</Label>
                  <Input
                    id="timeStep"
                    type="number"
                    value={config.timeStep}
                    onChange={(e) =>
                      setConfig({ ...config, timeStep: parseFloat(e.target.value) })
                    }
                    min="0.001"
                    step="0.001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="residualThreshold">
                  Residual Threshold: {config.residualThreshold.toFixed(4)}
                </Label>
                <Slider
                  id="residualThreshold"
                  min={0.0001}
                  max={0.1}
                  step={0.0001}
                  value={[config.residualThreshold]}
                  onValueChange={(value) =>
                    setConfig({ ...config, residualThreshold: value[0] })
                  }
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Lower values favor CFD, higher values favor ML predictions
                </p>
              </div>

              <div className="space-y-2">
                <Label>Fields to Monitor</Label>
                <div className="flex flex-wrap gap-2">
                  {['U', 'p', 'T', 'rho', 'k', 'epsilon'].map((field) => (
                    <Badge
                      key={field}
                      variant={
                        config.fields.includes(field) ? 'default' : 'outline'
                      }
                      className="cursor-pointer"
                      onClick={() => {
                        setConfig({
                          ...config,
                          fields: config.fields.includes(field)
                            ? config.fields.filter((f) => f !== field)
                            : [...config.fields, field],
                        });
                      }}
                    >
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleRunSimulation}
                  disabled={loading || isRunning}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Simulation
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleStopSimulation}
                  variant="outline"
                  disabled={!isRunning}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Stop
                </Button>

                <Button
                  onClick={handleResetConfig}
                  variant="ghost"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Advanced Options</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• ML Acceleration Factor: Controls ML prediction weighting</li>
                  <li>• CFD Solver: Choose between different OpenFOAM solvers</li>
                  <li>• Parallel Processing: Distribute computation across processors</li>
                  <li>• Data Reinjection: Automatically reinject predictions into CFD</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label>ML Acceleration Factor</Label>
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  defaultValue={[0.5]}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Number of Processors</Label>
                <Input type="number" defaultValue="1" min="1" max="32" />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Job Status Panel */}
      {selectedJob && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedJob.name}</CardTitle>
                <CardDescription>Job ID: {selectedJob.jobId}</CardDescription>
              </div>
              <Badge variant={getStatusBadge(selectedJob.status)}>
                {selectedJob.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar - MODIFIED */}
            {selectedJob.status === 'running' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  {calculateProgress(selectedJob) !== null ? (
                    <span>{calculateProgress(selectedJob)!.toFixed(1)}%</span>
                  ) : (
                    <span>Initialisation...</span>
                  )}
                </div>
                {calculateProgress(selectedJob) !== null && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${calculateProgress(selectedJob)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {selectedJob.results && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-xs text-gray-600">CFD Time</p>
                  <p className="text-lg font-semibold">
                    {selectedJob.results.cfdTime.toFixed(2)}s
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-xs text-gray-600">ML Time</p>
                  <p className="text-lg font-semibold">
                    {selectedJob.results.mlTime.toFixed(2)}s
                  </p>
                </div>
              </div>
            )}

            {/* Residuals */}
            {selectedJob.results?.residuals && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Residuals</h4>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(selectedJob.results.residuals).map(
                    ([field, value]) => (
                      <div key={field} className="bg-gray-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-600">{field}</p>
                        <p className="text-sm font-mono">
                          {(value as number).toExponential(2)}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {selectedJob.errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{selectedJob.errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Logs */}
            {selectedJob.results?.log && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-sm">Simulation Log</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const element = document.createElement('a');
                      element.setAttribute(
                        'href',
                        'data:text/plain;charset=utf-8,' +
                          encodeURIComponent(selectedJob.results?.log || '')
                      );
                      element.setAttribute('download', `${selectedJob.jobId}_log.txt`);
                      element.style.display = 'none';
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs max-h-64 overflow-y-auto">
                  {selectedJob.results.log.split('\n').slice(-20).join('\n')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>All simulation jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.jobId}
                  className={`p-3 border rounded cursor-pointer transition-colors ${
                    selectedJob?.jobId === job.jobId
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setSelectedJob(job);
                    if (onJobSelected) onJobSelected(job);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{job.name}</p>
                      <p className="text-xs text-gray-500">{job.jobId}</p>
                    </div>
                    <Badge variant={getStatusBadge(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
