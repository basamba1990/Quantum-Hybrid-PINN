'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Industrial3DVisualizerEnhancedV11 from './industrial-3d-visualizer-enhanced-v11';

interface AdvancedPhysicsProps {
  simulationId?: string;
  time?: number;
  data3d?: any[];
  scenarioType?: string;
  onDataFetch?: (data: any) => void;
}

type ScenarioType = 'H2_PIPELINE' | 'LH2_STORAGE' | 'PORT_ENERGY_OPTIMIZATION' | 'PIPELINE_SAFETY' | 'CRYOGENIC_TRANSPORT' | 'MINING_INDUSTRIAL_SIM' | 'ROCK_ELAST_STRESS' | 'H2_COMPRESSION_STATION' | 'FPGA_HEATSINK' | 'DEEP_MINING_BLOCK';

export default function AdvancedPhysicsVisualization({ 
  simulationId, 
  time = 0,
  data3d = [],
  scenarioType: propScenarioType = 'H2_PIPELINE',
}: AdvancedPhysicsProps) {
  const [activeTab, setActiveTab] = useState('volumetric');
  const [colorVariable, setColorVariable] = useState<'temperature' | 'pressure' | 'density' | 'stress' | 'damage' | 'prediction'>('temperature');

  const [backendDerivedFieldsData, setBackendDerivedFieldsData] = useState<any>(null);

  const realData3d = useMemo(() => {
    if (!data3d || !Array.isArray(data3d) || data3d.length === 0) return [];
    return data3d.filter(p => 
      typeof p.x === 'number' && 
      typeof p.y === 'number' && 
      typeof p.z === 'number'
    ).map(p => ({
      x: p.x,
      y: p.y,
      z: p.z,
      temperature: Number(p.temperature ?? (p as any).temp ?? 293.15),
      pressure: Number(p.pressure ?? (p as any).p ?? 1.0),
      density: Number(p.density ?? 1.0),
      velocity_magnitude: Number(p.velocity_magnitude ?? (p as any).velocityMagnitude ?? 0),
      velocity_u: Number(p.velocity_u ?? (p as any).velocityU ?? 0),
      velocity_v: Number(p.velocity_v ?? (p as any).velocityV ?? 0),
      velocity_w: Number(p.velocity_w ?? (p as any).velocityW ?? 0),
      stress: Number(p.stress ?? (p as any).von_mises ?? (p as any).vonMises ?? 0),
      damage: Number(p.damage ?? 0),
      prediction: Number(p.prediction ?? p.temperature ?? 0)
    }));
  }, [data3d]);

  const chartData = useMemo(() => {
    if (!realData3d || realData3d.length === 0) return null;

    const sortedByZ = [...realData3d].sort((a, b) => a.z - b.z);
    const sortedByY = [...realData3d].sort((a, b) => a.y - b.y);

    const tempProfileZ = sortedByZ.map((p) => ({
      z: p.z,
      temperature: p.temperature,
      pressure: p.pressure,
      velocity: Math.sqrt((p.velocity_u || 0) ** 2 + (p.velocity_v || 0) ** 2 + (p.velocity_w || 0) ** 2),
    }));

    const velocityProfile = sortedByY.map((p) => ({
      y: p.y,
      velocity: Math.sqrt((p.velocity_u || 0) ** 2 + (p.velocity_v || 0) ** 2 + (p.velocity_w || 0) ** 2),
    }));

    return {
      tempProfileZ,
      velocityProfile,
      tkeProfile: backendDerivedFieldsData?.tke ? realData3d.map((p, i) => ({ z: p.z, tke: backendDerivedFieldsData.tke[i] || 0 })) : [],
      pdeResidualsData: backendDerivedFieldsData?.pde_residuals,
      boundaryLayerData: backendDerivedFieldsData?.boundary_layer_profile,
    };
  }, [realData3d, backendDerivedFieldsData]);

  const scenarioType = propScenarioType as ScenarioType;
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';

  useEffect(() => {
    if (!simulationId || simulationId === 'undefined') return;

    const fetchBackendData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/v2/analysis/derive-fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result?.derived_fields) setBackendDerivedFieldsData(result.derived_fields);
        }
      } catch (err) {
        console.error('Backend fetch error:', err);
      }
    };
    fetchBackendData();
  }, [simulationId, API_BASE_URL]);

  const renderPhysicsChart = (data: any[], yLabel: string, dataKey: string, color: string = '#10b981') => {
    if (!data || data.length === 0) return <div className="p-8 text-center text-gray-600 bg-black/40 rounded-3xl border border-white/10">Données non disponibles</div>;
    return (
      <div className="h-[300px] w-full bg-black/60 rounded-3xl p-4 border border-white/10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="z" stroke="#94a3b8" fontSize={10} type="number" domain={['dataMin', 'dataMax']} />
            <YAxis stroke={color} fontSize={10} domain={['auto', 'auto']} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: color, fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: '#000000', border: `1px solid ${color}`, borderRadius: '12px' }} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  if (!data3d || data3d.length === 0) return <div className="h-[600px] flex items-center justify-center bg-slate-950 rounded-[32px] border border-white/10 text-emerald-600 font-bold">Aucune donnée de simulation disponible</div>;

  return (
    <div className="space-y-6">
      <Card className="bg-black border-white/10 overflow-hidden rounded-[32px]">
        <CardHeader className="border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black text-white tracking-tight">SCIENTIFIC ADVANCED PHYSICS</CardTitle>
              <CardDescription className="text-gray-400">Analyse approfondie des champs physiques et résidus PDE</CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{data3d.length.toLocaleString()} Points</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-white/5 p-1 rounded-2xl">
              <TabsTrigger value="volumetric">Vue Volumétrique</TabsTrigger>
              <TabsTrigger value="thermal">Profil Thermique</TabsTrigger>
              <TabsTrigger value="residuals">Résidus PDE</TabsTrigger>
              <TabsTrigger value="boundary">Couche Limite</TabsTrigger>
            </TabsList>

            <TabsContent value="volumetric" className="mt-0">
              <div className="h-[600px]">
                <Industrial3DVisualizerEnhancedV11 
                  data={realData3d} 
                  title={`${scenarioType.replace(/_/g, ' ')} - ADVANCED ANALYSIS`}
                  colorVariable={colorVariable}
                  scenarioType={scenarioType}
                />
              </div>
            </TabsContent>

            <TabsContent value="thermal">
              {renderPhysicsChart(chartData?.tempProfileZ || [], 'Température (K)', 'temperature', '#f87171')}
            </TabsContent>

            <TabsContent value="residuals">
              {renderPhysicsChart(chartData?.pdeResidualsData || [], 'Résidu Log10', 'residual', '#60a5fa')}
            </TabsContent>

            <TabsContent value="boundary">
              {renderPhysicsChart(chartData?.velocityProfile || [], 'Vitesse (m/s)', 'velocity', '#10b981')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
