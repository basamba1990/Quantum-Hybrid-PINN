'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import Industrial3DVisualizerEnhancedV11 from './industrial-3d-visualizer-enhanced-v11';

interface AdvancedPhysicsProps {
  simulationId: string;
  time: number;
  data3d?: any[];
  scenarioType?: string;
  onDataFetch?: (data: any) => void;
}

type ScenarioType = 'H2_PIPELINE' | 'LH2_STORAGE' | 'PORT_ENERGY_OPTIMIZATION' | 'PIPELINE_SAFETY' | 'CRYOGENIC_TRANSPORT' | 'MINING_INDUSTRIAL_SIM' | 'ROCK_ELAST_STRESS' | 'H2_COMPRESSION_STATION' | 'FPGA_HEATSINK' | 'DEEP_MINING_BLOCK';

export default function AdvancedPhysicsVisualization({ 
  simulationId, 
  time, 
  data3d = [],
  scenarioType: propScenarioType = 'H2_PIPELINE',
  onDataFetch 
}: AdvancedPhysicsProps) {
  const [activeTab, setActiveTab] = useState('volumetric');
  const [colorVariable, setColorVariable] = useState<'temperature' | 'pressure' | 'density' | 'stress' | 'damage' | 'prediction'>('temperature');

  // Fetch additional backend data if simulationId is available (declared before useMemo chartData to avoid block-scoped variable error)
  const [backendTurbulenceData, setBackendTurbulenceData] = useState<any>(null);
  const [backendBoundaryData, setBackendBoundaryData] = useState<any>(null);
  const [backendResidualData, setBackendResidualData] = useState<any>(null);
  const [backendDerivedFieldsData, setBackendDerivedFieldsData] = useState<any>(null);

  // Use Industrial3DVisualizerEnhancedV11 (same as standard/simulations) for the Gold view
  // Pass the real predictions3d data directly
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
      temperature: typeof p.temperature === 'number' ? p.temperature : 293.15,
      pressure: typeof p.pressure === 'number' ? p.pressure : 1.0,
      density: typeof p.density === 'number' ? p.density : 1.0,
      velocity_magnitude: typeof p.velocity_magnitude === 'number' ? p.velocity_magnitude : 0,
      velocity_u: typeof p.velocity_u === 'number' ? p.velocity_u : 0,
      velocity_v: typeof p.velocity_v === 'number' ? p.velocity_v : 0,
      velocity_w: typeof p.velocity_w === 'number' ? p.velocity_w : 0,
      stress: typeof p.stress === 'number' ? p.stress : 0,
      damage: typeof p.damage === 'number' ? p.damage : 0,
      prediction: typeof p.prediction === 'number' ? p.prediction : p.temperature
    }));
  }, [data3d]);

    // Derive all chart data from real predictions3d
  // Note: derivedFields is declared later (line 237), so we use backendDerivedFieldsData directly
  const chartData = useMemo(() => {
    if (!realData3d || realData3d.length === 0) return null;

    // Sort by z for cross-section profiles
    const sortedByZ = [...realData3d].sort((a, b) => a.z - b.z);
    const sortedByY = [...realData3d].sort((a, b) => a.y - b.y);
    const sortedByX = [...realData3d].sort((a, b) => a.x - b.x);

    // Temperature profile along Z axis
    const tempProfileZ = sortedByZ.map((p, i) => ({
      position: `z=${p.z.toFixed(3)}`,
      z: p.z,
      temperature: p.temperature,
      pressure: p.pressure,
      velocity: Math.sqrt((p.velocity_u || 0) ** 2 + (p.velocity_v || 0) ** 2 + (p.velocity_w || 0) ** 2),
    }));

    // Pressure profile along Z axis
    const pressureProfile = sortedByZ.map((p) => ({
      z: p.z,
      pressure: p.pressure > 1000 ? p.pressure / 1e5 : p.pressure,
    }));

    // Velocity profile along Y axis (boundary layer style)
    const velocityProfile = sortedByY.map((p) => ({
      y: p.y,
      velocity: Math.sqrt((p.velocity_u || 0) ** 2 + (p.velocity_v || 0) ** 2 + (p.velocity_w || 0) ** 2),
      y_normalized: p.y / (Math.max(...sortedByY.map(p => p.y)) || 1),
    }));

    // Scatter 3D data for turbulence visualization
    const turbulenceScatter = realData3d.map((p) => ({
      x: p.velocity_u || 0,
      y: p.velocity_v || 0,
      z: Math.abs(p.velocity_w || 0),
      velocity_magnitude: p.velocity_magnitude || 0,
    }));

    // Stress distribution
    const stressProfile = realData3d
      .filter(p => typeof p.stress === 'number' && p.stress !== 0)
      .sort((a, b) => a.z - b.z)
      .map((p) => ({
        z: p.z,
        stress: p.stress,
        position: `z=${p.z.toFixed(3)}`,
      }));

    // Damage distribution
    const damageProfile = realData3d
      .filter(p => typeof p.damage === 'number' && p.damage !== 0)
      .sort((a, b) => a.z - b.z)
      .map((p) => ({
        z: p.z,
        damage: p.damage,
        position: `z=${p.z.toFixed(3)}`,
      }));

    // Velocity magnitude along X axis
    const velocityXProfile = sortedByX.map((p) => ({
      x: p.x,
      velocity: Math.sqrt((p.velocity_u || 0) ** 2 + (p.velocity_v || 0) ** 2 + (p.velocity_w || 0) ** 2),
    }));

    // Multi-physics combined
    const multiPhysics = realData3d.map((p) => ({
      z: p.z,
      temperature: p.temperature,
      pressure: p.pressure > 1000 ? p.pressure / 1e5 : p.pressure,
      velocity: Math.sqrt((p.velocity_u || 0) ** 2 + (p.velocity_v || 0) ** 2 + (p.velocity_w || 0) ** 2),
      density: p.density || 1.0,
    }));

    return {
      tempProfileZ,
      pressureProfile,
      velocityProfile,
      turbulenceScatter,
      stressProfile,
      damageProfile,
      velocityXProfile,
      multiPhysics,
      tkeProfile: backendDerivedFieldsData?.tke ? realData3d.map((p, i) => ({ z: p.z, tke: backendDerivedFieldsData.tke[i] || 0 })) : [],
      vorticityMagnitudeProfile: backendDerivedFieldsData?.vorticity_magnitude ? realData3d.map((p, i) => ({ z: p.z, vorticity: backendDerivedFieldsData.vorticity_magnitude[i] || 0 })) : [],
      energySpectrumData: backendDerivedFieldsData?.energy_spectrum && backendDerivedFieldsData?.wavenumbers ? backendDerivedFieldsData.wavenumbers.map((k: number, i: number) => ({ k, E_k: backendDerivedFieldsData.energy_spectrum[i] })) : [],
      pdeResidualsData: backendDerivedFieldsData?.pde_residuals,
      boundaryLayerData: backendDerivedFieldsData?.boundary_layer_profile,
      reynoldsStressData: backendDerivedFieldsData ? {
        tau_xx: backendDerivedFieldsData.tau_xx,
        tau_yy: backendDerivedFieldsData.tau_yy,
        tau_zz: backendDerivedFieldsData.tau_zz,
        tau_xy: backendDerivedFieldsData.tau_xy,
        tau_xz: backendDerivedFieldsData.tau_xz,
        tau_yz: backendDerivedFieldsData.tau_yz,
      } : null,
      stats: {
        count: realData3d.length,
        tempMin: Math.min(...realData3d.map(p => p.temperature)),
        tempMax: Math.max(...realData3d.map(p => p.temperature)),
        tempAvg: realData3d.reduce((s, p) => s + p.temperature, 0) / realData3d.length,
        pressureMin: Math.min(...realData3d.map(p => p.pressure)),
        pressureMax: Math.max(...realData3d.map(p => p.pressure)),
        pressureAvg: realData3d.reduce((s, p) => s + p.pressure, 0) / realData3d.length,
        velocityMax: Math.max(...realData3d.map(p => Math.sqrt((p.velocity_u || 0) ** 2 + (p.velocity_v || 0) ** 2 + (p.velocity_w || 0) ** 2))),
        densityMin: Math.min(...realData3d.map(p => p.density || 1.0)),
        densityMax: Math.max(...realData3d.map(p => p.density || 1.0)),
        tkeAvg: backendDerivedFieldsData?.tke ? backendDerivedFieldsData.tke.reduce((s: number, val: number) => s + val, 0) / backendDerivedFieldsData.tke.length : 0,
      }
    };
  }, [realData3d, backendDerivedFieldsData]);

  const scenarioType = propScenarioType as ScenarioType;

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';

  useEffect(() => {
    if (!simulationId || simulationId === 'undefined') return;

    const fetchBackendData = async () => {
      try {
        const [turbRes, blRes, resRes, derivedFieldsRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/v2/analysis/turbulence-spectra`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ simulation_id: simulationId, time }),
          }),
          fetch(`${API_BASE_URL}/v2/analysis/boundary-layer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ simulation_id: simulationId, time, x: 0.5, z: 0.0 }),
          }),
          fetch(`${API_BASE_URL}/v2/analysis/residuals-map`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ simulation_id: simulationId, time, plane: 'xy', coord: 0.0 }),
          }),
          fetch(`${API_BASE_URL}/v2/analysis/derive-fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ simulation_id: simulationId }),
          })
        ]);

        if (turbRes.status === 'fulfilled' && turbRes.value.ok) {
          const result = await turbRes.value.json();
          if (result?.data) setBackendTurbulenceData(result.data);
        }
        if (blRes.status === 'fulfilled' && blRes.value.ok) {
          const result = await blRes.value.json();
          if (result?.data) setBackendBoundaryData(result.data);
        }
        if (resRes.status === 'fulfilled' && resRes.value.ok) {
          const result = await resRes.value.json();
          if (result?.data) setBackendResidualData(result.data);
        }
        if (derivedFieldsRes.status === 'fulfilled' && derivedFieldsRes.value.ok) {
          const result = await derivedFieldsRes.value.json();
          if (result?.derived_fields) setBackendDerivedFieldsData(result.derived_fields);
        }
      } catch (err) {
        console.error('Backend fetch error (non-blocking):', err);
      }
    };

    fetchBackendData();
  }, [simulationId, time, API_BASE_URL]);

  // Memoized derived fields from backendDerivedFieldsData
  const derivedFields = useMemo(() => {
    if (!backendDerivedFieldsData) return null;
    return {
      tke: backendDerivedFieldsData.tke,
      vorticityMagnitude: backendDerivedFieldsData.vorticity_magnitude,
      reynoldsStress: {
        tau_xx: backendDerivedFieldsData.tau_xx,
        tau_yy: backendDerivedFieldsData.tau_yy,
        tau_zz: backendDerivedFieldsData.tau_zz,
        tau_xy: backendDerivedFieldsData.tau_xy,
        tau_xz: backendDerivedFieldsData.tau_xz,
        tau_yz: backendDerivedFieldsData.tau_yz,
      },
      energySpectrum: backendDerivedFieldsData.energy_spectrum,
      wavenumbers: backendDerivedFieldsData.wavenumbers,
      pdeResiduals: backendDerivedFieldsData.pde_residuals,
      boundaryLayerProfile: backendDerivedFieldsData.boundary_layer_profile,
    };
  }, [backendDerivedFieldsData]);

  const renderPhysicsChart = (data: any[], yLabel: string, dataKey: string, color: string = '#10b981') => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <div className="p-8 text-center text-gray-600 bg-black/40 rounded-3xl border border-white/10">
          Données non disponibles pour {yLabel}
        </div>
      );
    }

    return (
      <div className="h-[300px] w-full bg-black/60 rounded-3xl p-4 border border-white/10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis 
              dataKey="z" 
              stroke="#94a3b8" 
              fontSize={10}
              type="number"
              domain={['dataMin', 'dataMax']}
              label={{ value: 'Position Z (m)', position: 'insideBottomRight', fill: '#94a3b8', fontSize: 10 }}
            />
            <YAxis 
              stroke={color} 
              fontSize={10}
              domain={['auto', 'auto']}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: color, fontSize: 10 }} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#000000', border: `1px solid ${color}`, borderRadius: '12px' }} 
              labelStyle={{ color: color }} 
              itemStyle={{ fontSize: '12px' }}
              formatter={(value: any) => typeof value === 'number' ? value.toExponential(4) : value}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2} 
              dot={false}
              name={yLabel}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  if (!data3d || data3d.length === 0) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-slate-950 rounded-[32px] border border-white/10 text-center p-8 space-y-6">
        <div className="text-emerald-600">
          <p className="text-xl font-bold">Aucune donnée de simulation disponible</p>
          <p className="text-sm text-gray-500 mt-2">Lancez une analyse PINN pour générer les visualisations avancées.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black border-white/10 overflow-hidden rounded-[32px]">
        <CardHeader className="border-b border-white/5 bg-black">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black text-white tracking-tight">Advanced Physics Analysis</CardTitle>
              <CardDescription className="text-gray-400">
                Validation Multi-Physique : Pression, Température & Flux Turbulent
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono">
              {data3d.length.toLocaleString()} Points PINN
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 bg-black">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-8 bg-white/5 p-1 rounded-2xl border border-white/10">
              <TabsTrigger value="volumetric" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-400 font-bold transition-all text-[10px]">Vue 3D Gold</TabsTrigger>
              <TabsTrigger value="turbulence" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Spectres</TabsTrigger>
              <TabsTrigger value="boundary-layer" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Paroi</TabsTrigger>
              <TabsTrigger value="residuals" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Résidus</TabsTrigger>
              <TabsTrigger value="damage" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Endommagement</TabsTrigger>
              <TabsTrigger value="tke" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Turbulence</TabsTrigger>
              <TabsTrigger value="stress" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Contraintes</TabsTrigger>
              <TabsTrigger value="vorticity" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Vorticité</TabsTrigger>
              <TabsTrigger value="reynolds-stress" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Reynolds</TabsTrigger>
              <TabsTrigger value="energy-spectrum" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Spectre E(k)</TabsTrigger>
              <TabsTrigger value="pde-residuals" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Résidus PDE</TabsTrigger>
              <TabsTrigger value="multi-physics" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Multi-P</TabsTrigger>
            </TabsList>

            {/* ===== VUE 3D GOLD : EXACTEMENT le même visualiseur que le standard ===== */}
            <TabsContent value="volumetric" className="space-y-6">
              <div className="flex justify-end gap-2 mb-4">
                <button 
                  onClick={() => setColorVariable('temperature')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${colorVariable === 'temperature' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  Température
                </button>
                <button 
                  onClick={() => setColorVariable('pressure')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${colorVariable === 'pressure' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  Pression
                </button>
                <button 
                  onClick={() => setColorVariable('density')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${colorVariable === 'density' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  Densité
                </button>
                <button 
                  onClick={() => setColorVariable('stress')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${colorVariable === 'stress' ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  Contraintes
                </button>
                <button 
                  onClick={() => setColorVariable('damage')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${colorVariable === 'damage' ? 'bg-orange-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  Endommagement
                </button>
              </div>
              <div className="h-[600px] w-full">
                <Industrial3DVisualizerEnhancedV11 
                  data={realData3d}
                  title="TRULY-INDUSTRIAL V10-GOLD // Advanced Physics"
                  colorVariable={colorVariable}
                  quality="ultra"
                  scenarioType={scenarioType}
                />
              </div>
              <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                <p className="text-xs text-blue-400">
                  <strong>Vue 3D Gold :</strong> Rendu volumétrique Marching Cubes identique au tableau de bord standard. 
                  Données réelles : {realData3d.length.toLocaleString()} points PINN // 
                  Temp: [{chartData?.stats?.tempMin?.toFixed(1) || 0}K – {chartData?.stats?.tempMax?.toFixed(1) || 0}K]
                </p>
              </div>
            </TabsContent>

            {/* ===== SPECTRES TURBULENCE ===== */}
            <TabsContent value="turbulence" className="space-y-6">
              {chartData && realData3d.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Énergie Cinétique Max</p>
                      <p className="text-2xl font-black text-emerald-300">{chartData.stats.velocityMax.toFixed(4)} m²/s²</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Points de Vitesse</p>
                      <p className="text-2xl font-black text-emerald-300">{realData3d.length.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">RMS Vitesse</p>
                      <p className="text-2xl font-black text-emerald-300">
                        {Math.sqrt(realData3d.reduce((s, p) => s + Math.pow(p.velocity_magnitude || 0, 2), 0) / realData3d.length).toFixed(4)} m/s
                      </p>
                    </div>
                  </div>
                  <div className="h-[400px] w-full bg-black/60 rounded-3xl border border-white/10 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis type="number" dataKey="x" name="u" unit=" m/s" stroke="#10b981" fontSize={10} label={{ value: 'Vitesse U (m/s)', position: 'insideBottomRight', fill: '#10b981' }} />
                        <YAxis type="number" dataKey="y" name="v" unit=" m/s" stroke="#10b981" fontSize={10} label={{ value: 'Vitesse V (m/s)', angle: -90, fill: '#10b981' }} />
                        <ZAxis type="number" dataKey="z" range={[20, 100]} name="|w|" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000000', border: '1px solid #10b981', borderRadius: '12px' }}
                          formatter={(value: any, name: string) => [typeof value === 'number' ? value.toFixed(4) : value, name]}
                        />
                        <Scatter 
                          name="Champ de Vitesse (u, v, |w|)" 
                          data={chartData.turbulenceScatter}
                          fill="#10b981"
                          fillOpacity={0.6}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  {backendTurbulenceData && backendTurbulenceData.wavenumbers && (
                    <div className="h-[300px] w-full bg-black/60 rounded-3xl border border-emerald-500/20 p-4">
                      <p className="text-xs text-emerald-400 mb-2">Spectre d'énergie (backend)</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={backendTurbulenceData.wavenumbers.map((k: number, i: number) => ({ k: k.toFixed(3), energy: backendTurbulenceData.energy_density[i] || 0 }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#10b98120" />
                          <XAxis dataKey="k" stroke="#10b981" fontSize={10} />
                          <YAxis scale="log" stroke="#10b981" fontSize={10} />
                          <Area type="monotone" dataKey="energy" stroke="#10b981" fill="#10b98130" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Données de turbulence non disponibles</div>
              )}
            </TabsContent>

            {/* ===== COUCHE LIMITE ===== */}
            <TabsContent value="boundary-layer" className="space-y-6">
              {chartData && chartData.velocityProfile.length > 0 ? (
                <div className="h-[400px] w-full bg-black/60 rounded-3xl border border-white/10 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.velocityProfile}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis 
                        type="number" 
                        dataKey="y" 
                        stroke="#10b981" 
                        fontSize={10}
                        domain={['dataMin', 'dataMax']}
                        label={{ value: 'Distance à la paroi Y (m)', position: 'insideBottomRight', fill: '#10b981' }}
                      />
                      <YAxis stroke="#10b981" fontSize={10} label={{ value: '|U| (m/s)', angle: -90, fill: '#10b981' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000000', border: '1px solid #10b981' }}
                        formatter={(value: any) => typeof value === 'number' ? value.toFixed(6) : value}
                      />
                      <Legend wrapperStyle={{ color: '#10b981' }} />
                      <Line type="monotone" dataKey="velocity" stroke="#10b981" strokeWidth={3} name="Vitesse |U|" dot={false} />
                      <Line type="monotone" dataKey="y_normalized" stroke="#10b98140" strokeWidth={1} name="Y normalisé" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-600">Données de couche limite non disponibles</div>
              )}
            </TabsContent>

            {/* ===== RÉSIDUS ===== */}
            <TabsContent value="residuals" className="space-y-6">
              {backendResidualData ? (
                <div className="h-[400px] w-full bg-black/60 rounded-3xl border border-emerald-500/20 p-4 flex items-center justify-center">
                  <div dangerouslySetInnerHTML={{ __html: generateHeatmapSVG(backendResidualData.map) }} />
                </div>
              ) : (
                <div className="p-12 text-center text-gray-600">Carte de résidus non disponible du backend</div>
              )}
            </TabsContent>

            {/* ===== ENDOMMAGEMENT ===== */}
            <TabsContent value="damage" className="space-y-6">
              {chartData && chartData.damageProfile.length > 0 ? (
                <>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">État de Dégradation Isotrope (D)</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {chartData.damageProfile.length.toLocaleString()} points d'endommagement détectés dans le domaine PINN.
                    </p>
                  </div>
                  {renderPhysicsChart(chartData.damageProfile, 'D (Endommagement)', 'damage', '#f97316')}
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Aucun endommagement détecté dans les données PINN</div>
              )}
            </TabsContent>

            {/* ===== TURBULENCE k-epsilon ===== */}
            <TabsContent value="tke" className="space-y-6">
              {chartData && realData3d.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Énergie Cinétique Turbulente</p>
                      <p className="text-xl font-black text-emerald-300">
                        k = {chartData.stats.velocityMax.toFixed(4)} m²/s²
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Intensité Turbulente</p>
                      <p className="text-xl font-black text-emerald-300">
                        I = {(chartData.stats.velocityMax / (chartData.stats.velocityMax || 1) * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  <div className="h-[300px] w-full bg-black/60 rounded-3xl border border-white/10 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.velocityProfile.map(p => ({ y: p.y, tke: 0.5 * Math.pow(p.velocity, 2) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis type="number" dataKey="y" stroke="#10b981" fontSize={10} label={{ value: 'Y (m)', fill: '#10b981' }} />
                        <YAxis stroke="#10b981" fontSize={10} label={{ value: 'TKE k (m²/s²)', angle: -90, fill: '#10b981' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #10b981' }} />
                        <Line type="monotone" dataKey="tke" stroke="#10b981" strokeWidth={2} dot={false} name="k" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Données de turbulence non disponibles</div>
              )}
            </TabsContent>

            {/* ===== VORTICITÉ ===== */}
            <TabsContent value="vorticity" className="space-y-6">
              {chartData && chartData.vorticityMagnitudeProfile.length > 0 ? (
                <>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Vorticité (ω)</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Magnitude de la vorticité calculée à partir des champs de vitesse.
                      ω_min = {Math.min(...chartData.vorticityMagnitudeProfile.map(p => p.vorticity)).toExponential(2)} s⁻¹ // 
                      ω_max = {Math.max(...chartData.vorticityMagnitudeProfile.map(p => p.vorticity)).toExponential(2)} s⁻¹
                    </p>
                  </div>
                  {renderPhysicsChart(chartData.vorticityMagnitudeProfile, 'Magnitude Vorticité (s⁻¹)', 'vorticity', '#ff7300')}
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Données de vorticité non disponibles</div>
              )}
            </TabsContent>

            {/* ===== TENSEUR DE REYNOLDS ===== */}
            <TabsContent value="reynolds-stress" className="space-y-6">
              {chartData && chartData.reynoldsStressData ? (
                <>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Tenseur de Reynolds (τ)</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Composantes du tenseur de contraintes de Reynolds (moyennées).
                    </p>
                    <ul className="text-sm text-gray-300 mt-2 list-disc list-inside">
                      <li>τ_xx: {chartData.reynoldsStressData.tau_xx?.toExponential(2) || 'N/A'}</li>
                      <li>τ_yy: {chartData.reynoldsStressData.tau_yy?.toExponential(2) || 'N/A'}</li>
                      <li>τ_zz: {chartData.reynoldsStressData.tau_zz?.toExponential(2) || 'N/A'}</li>
                      <li>τ_xy: {chartData.reynoldsStressData.tau_xy?.toExponential(2) || 'N/A'}</li>
                      <li>τ_xz: {chartData.reynoldsStressData.tau_xz?.toExponential(2) || 'N/A'}</li>
                      <li>τ_yz: {chartData.reynoldsStressData.tau_yz?.toExponential(2) || 'N/A'}</li>
                    </ul>
                  </div>
                  <div className="p-12 text-center text-gray-600">Visualisation graphique à implémenter si nécessaire.</div>
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Données du tenseur de Reynolds non disponibles</div>
              )}
            </TabsContent>

            {/* ===== SPECTRE D'ÉNERGIE E(k) ===== */}
            <TabsContent value="energy-spectrum" className="space-y-6">
              {chartData && chartData.energySpectrumData.length > 0 ? (
                <>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Spectre d'Énergie E(k)</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Distribution de l'énergie cinétique turbulente en fonction du nombre d'onde.
                    </p>
                  </div>
                  <div className="h-[300px] w-full bg-black/60 rounded-3xl p-4 border border-white/10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.energySpectrumData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis 
                          dataKey="k" 
                          stroke="#94a3b8" 
                          fontSize={10}
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          label={{ value: 'Nombre d\'onde k (rad/m)', position: 'insideBottomRight', fill: '#94a3b8', fontSize: 10 }}
                        />
                        <YAxis 
                          stroke="#8884d8" 
                          fontSize={10}
                          domain={['auto', 'auto']}
                          label={{ value: 'E(k)', angle: -90, position: 'insideLeft', fill: '#8884d8', fontSize: 10 }} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000000', border: '1px solid #8884d8', borderRadius: '12px' }} 
                          labelStyle={{ color: '#8884d8' }} 
                          itemStyle={{ fontSize: '12px' }}
                          formatter={(value: any) => typeof value === 'number' ? value.toExponential(4) : value}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="E_k" 
                          stroke="#8884d8" 
                          strokeWidth={2} 
                          dot={false}
                          name="E(k)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Spectre d'énergie non disponible</div>
              )}
            </TabsContent>

            {/* ===== RÉSIDUS PDE ===== */}
            <TabsContent value="pde-residuals" className="space-y-6">
              {chartData && chartData.pdeResidualsData ? (
                <>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Résidus des Équations aux Dérivées Partielles</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Mesure de la satisfaction des équations physiques par le modèle PINN.
                    </p>
                    <ul className="text-sm text-gray-300 mt-2 list-disc list-inside">
                      <li>Continuité: {chartData.pdeResidualsData.continuity?.toExponential(2) || 'N/A'}</li>
                      <li>Quantité de mouvement: {chartData.pdeResidualsData.momentum?.toExponential(2) || 'N/A'}</li>
                      <li>Énergie: {chartData.pdeResidualsData.energy?.toExponential(2) || 'N/A'}</li>
                    </ul>
                  </div>
                  <div className="p-12 text-center text-gray-600">Visualisation graphique à implémenter si nécessaire.</div>
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Résidus PDE non disponibles</div>
              )}
            </TabsContent>

            {/* ===== COUCHE LIMITE ===== */}
            <TabsContent value="boundary-layer" className="space-y-6">
              {chartData && chartData.boundaryLayerData && chartData.boundaryLayerData.delta > 0 ? (
                <>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Profil de Couche Limite</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Analyse des propriétés de la couche limite près d'une paroi.
                    </p>
                    <ul className="text-sm text-gray-300 mt-2 list-disc list-inside">
                      <li>Épaisseur (δ): {chartData.boundaryLayerData.delta?.toExponential(2) || 'N/A'} m</li>
                      <li>Épaisseur de déplacement (δ*): {chartData.boundaryLayerData.delta_star?.toExponential(2) || 'N/A'} m</li>
                      <li>Épaisseur de quantité de mouvement (θ): {chartData.boundaryLayerData.theta?.toExponential(2) || 'N/A'} m</li>
                      <li>Facteur de forme (H): {chartData.boundaryLayerData.shape_factor?.toFixed(2) || 'N/A'}</li>
                    </ul>
                  </div>
                  <div className="p-12 text-center text-gray-600">Visualisation graphique à implémenter si nécessaire.</div>
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Données de couche limite non disponibles</div>
              )}
            </TabsContent>

            {/* ===== CONTRAINTES ===== */}
            <TabsContent value="stress" className="space-y-6">
              {chartData && chartData.stressProfile.length > 0 ? (
                <>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Tenseur des Contraintes (σ)</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {chartData.stressProfile.length.toLocaleString()} points de contrainte dans le domaine.
                      σ_min = {Math.min(...chartData.stressProfile.map(p => p.stress)).toExponential(2)} Pa // 
                      σ_max = {Math.max(...chartData.stressProfile.map(p => p.stress)).toExponential(2)} Pa
                    </p>
                  </div>
                  {renderPhysicsChart(chartData.stressProfile, 'σ_xx (Pa)', 'stress', '#ef4444')}
                </>
              ) : (
                <div className="p-12 text-center text-gray-600">Aucune donnée de contrainte dans les résultats PINN</div>
              )}
            </TabsContent>

            {/* ===== MULTI-PHYSIQUE ===== */}
            <TabsContent value="multi-physics" className="space-y-6">
              {chartData && chartData.multiPhysics.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Vitesse du Fluide</p>
                    {renderPhysicsChart(chartData.multiPhysics.map(p => ({ z: p.z, velocity: p.velocity })), 'Vitesse (m/s)', 'velocity', '#10b981')}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Pression</p>
                    {renderPhysicsChart(chartData.multiPhysics.map(p => ({ z: p.z, pressure: p.pressure })), 'Pression (bar)', 'pressure', '#3b82f6')}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Température</p>
                    {renderPhysicsChart(chartData.multiPhysics.map(p => ({ z: p.z, temperature: p.temperature })), 'Température (K)', 'temperature', '#ef4444')}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Densité</p>
                    {renderPhysicsChart(chartData.multiPhysics.map(p => ({ z: p.z, density: p.density })), 'Densité (kg/m³)', 'density', '#f59e0b')}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-600">Données multi-physique non disponibles</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper for backend residual heatmap
function generateHeatmapSVG(map: number[][]): string {
  if (!map || map.length === 0) return '';
  const rows = map.length;
  const cols = map[0].length;
  const cellSize = 6;
  const maxVal = Math.max(...map.flat());
  const minVal = Math.min(...map.flat());
  const range = maxVal - minVal || 1e-10;

  let svg = `<svg width="${cols * cellSize}" height="${rows * cellSize}" viewBox="0 0 ${cols * cellSize} ${rows * cellSize}">`;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const val = map[i][j];
      const norm = (val - minVal) / range;
      const hue = (1 - norm) * 240;
      svg += `<rect x="${j * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="hsl(${hue}, 80%, 50%)" />`;
    }
  }
  svg += '</svg>';
  return svg;
}
