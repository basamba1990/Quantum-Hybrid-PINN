'use client';

import { useState } from 'react';
import { SubscriptionGuard } from '@/components/SubscriptionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubscription } from '@/hooks/useSubscription';
import { AlertCircle, Play } from 'lucide-react';

export default function SimulationsPage() {
  const { subscription } = useSubscription();
  const [isRunning, setIsRunning] = useState(false);
  const [simulationConfig, setSimulationConfig] = useState({
    name: 'CFD-PINN Hybrid Simulation',
    domain_size: 1.0,
    time_steps: 100,
    grid_resolution: 64,
  });

  const handleRunSimulation = async () => {
    try {
      setIsRunning(true);

      const response = await fetch('/api/simulations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulationConfig,
          userEmail: 'user@example.com', // Replace with actual user email
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.message || 'Simulation failed'}`);
        return;
      }

      const result = await response.json();
      alert(`Simulation started: ${result.simulationId}`);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Simulations</h1>

        <SubscriptionGuard requiredPlan="starter">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle>Run a New Simulation</CardTitle>
              <CardDescription>
                Configure and run a quantum-hybrid CFD-PINN simulation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-slate-300">
                    Simulation Name
                  </Label>
                  <Input
                    id="name"
                    value={simulationConfig.name}
                    onChange={(e) =>
                      setSimulationConfig({
                        ...simulationConfig,
                        name: e.target.value,
                      })
                    }
                    className="mt-2 bg-slate-700 border-slate-600 text-white"
                    placeholder="Enter simulation name"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="domain_size" className="text-slate-300">
                      Domain Size
                    </Label>
                    <Input
                      id="domain_size"
                      type="number"
                      value={simulationConfig.domain_size}
                      onChange={(e) =>
                        setSimulationConfig({
                          ...simulationConfig,
                          domain_size: parseFloat(e.target.value),
                        })
                      }
                      className="mt-2 bg-slate-700 border-slate-600 text-white"
                      placeholder="1.0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="grid_resolution" className="text-slate-300">
                      Grid Resolution
                    </Label>
                    <Input
                      id="grid_resolution"
                      type="number"
                      value={simulationConfig.grid_resolution}
                      onChange={(e) =>
                        setSimulationConfig({
                          ...simulationConfig,
                          grid_resolution: parseInt(e.target.value),
                        })
                      }
                      className="mt-2 bg-slate-700 border-slate-600 text-white"
                      placeholder="64"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="time_steps" className="text-slate-300">
                    Time Steps
                  </Label>
                  <Input
                    id="time_steps"
                    type="number"
                    value={simulationConfig.time_steps}
                    onChange={(e) =>
                      setSimulationConfig({
                        ...simulationConfig,
                        time_steps: parseInt(e.target.value),
                      })
                    }
                    className="mt-2 bg-slate-700 border-slate-600 text-white"
                    placeholder="100"
                  />
                </div>
              </div>

              <Button
                onClick={handleRunSimulation}
                disabled={isRunning}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2"
              >
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? 'Running...' : 'Run Simulation'}
              </Button>
            </CardContent>
          </Card>

          {subscription.plan === 'free' && (
            <Card className="border-yellow-500/50 bg-yellow-950/20 mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-500">
                  <AlertCircle className="h-5 w-5" />
                  Limited Simulations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-300">
                  Your free plan includes limited simulations. Upgrade to Pro for unlimited access.
                </p>
              </CardContent>
            </Card>
          )}
        </SubscriptionGuard>
      </div>
    </div>
  );
}
