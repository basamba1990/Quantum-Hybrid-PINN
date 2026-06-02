'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
} from 'recharts';

interface TurbulenceData {
  wavenumbers: number[];
  energy_density: number[];
}

interface BoundaryLayerData {
  y: number[];
  velocity: number[];
  y_plus: number[];
}

interface ResidualMapData {
  map: number[][];
  plane: string;
  coord: number;
}

interface AdvancedPhysicsProps {
  simulationId: string;
  time: number;
  onDataFetch?: (data: any) => void;
}

// ============================================================================
// DONNÉES MOCK PAR DÉFAUT – garantissent l'affichage immédiat
// ============================================================================
const DEFAULT_TURBULENCE_DATA: TurbulenceData = {
  wavenumbers: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100],
  energy_density: [100, 60, 30, 15, 8, 3.5, 1.2, 0.5, 0.15, 0.05],
};

const DEFAULT_BOUNDARY_LAYER: BoundaryLayerData = {
  y: [0, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5],
  velocity: [0, 0.8, 1.2, 1.8, 2.2, 2.5, 2.8, 3.0, 3.1, 3.2],
  y_plus: [0, 0.5, 1.2, 3.0, 6.0, 12, 30, 60, 120, 300],
};

const DEFAULT_RESIDUAL_MAP: ResidualMapData = {
  map: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => Math.random())),
  plane: 'xy',
  coord: 0.5,
};

const generatePhysicsData = (type: 'velocity' | 'pressure' | 'temperature') => {
  return Array.from({ length: 101 }, (_, i) => {
    const x = i / 10;
    let base = 0;
    let noiseScale = 0.05;
    let uncertaintyScale = 0.08;

    if (type === 'velocity') {
      base = Math.log(x + 1) / Math.log(11) * 1.1;
    } else if (type === 'pressure') {
      base = 1.0 - (Math.exp(x / 10) - 1) / (Math.exp(1) - 1) * 0.5;
      noiseScale = 0.02;
      uncertaintyScale = 0.04;
    } else if (type === 'temperature') {
      base = 0.3 + Math.sin(x / 2) * 0.4;
      noiseScale = 0.03;
      uncertaintyScale = 0.06;
    }

    const noise = Math.sin(x * 10) * noiseScale + Math.random() * noiseScale;
    const uncertainty = Math.abs(Math.sin(x * 8) * uncertaintyScale + Math.random() * uncertaintyScale);
    const amplitude = Math.max(0, base + noise);

    return {
      time: x.toFixed(1),
      amplitude: amplitude.toFixed(3),
      upper: (amplitude + uncertainty).toFixed(3),
      lower: (amplitude - uncertainty).toFixed(3),
    };
  });
};

export function AdvancedPhysicsVisualization({ simulationId, time, onDataFetch }: AdvancedPhysicsProps) {
  const [activeTab, setActiveTab] = useState('turbulence');
  const [turbulenceData, setTurbulenceData] = useState<TurbulenceData | null>(DEFAULT_TURBULENCE_DATA);
  const [boundaryLayerData, setBoundaryLayerData] = useState<BoundaryLayerData | null>(DEFAULT_BOUNDARY_LAYER);
  const [residualData, setResidualData] = useState<ResidualMapData | null>(DEFAULT_RESIDUAL_MAP);
  
  const [velocityData, setVelocityData] = useState<any[]>(generatePhysicsData('velocity'));
  const [pressureData, setPressureData] = useState<any[]>(generatePhysicsData('pressure'));
  const [temperatureData, setTemperatureData] = useState<any[]>(generatePhysicsData('temperature'));
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!simulationId) return;

    const fetchAnalysisData = async () => {
      setLoading(true);
      try {
        const turbResponse = await fetch(`${API_BASE_URL}/v2/analysis/turbulence-spectra`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time }),
        });
        if (turbResponse.ok) {
          const turbResult = await turbResponse.json();
          if (turbResult?.data) setTurbulenceData(turbResult.data);
        }

        const blResponse = await fetch(`${API_BASE_URL}/v2/analysis/boundary-layer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time, x: 0.5, z: 0.5 }),
        });
        if (blResponse.ok) {
          const blResult = await blResponse.json();
          if (blResult?.data) setBoundaryLayerData(blResult.data);
        }

        const resResponse = await fetch(`${API_BASE_URL}/v2/analysis/residuals-map`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time, plane: 'xy', coord: 0.0 }),
        });
        if (resResponse.ok) {
          const resResult = await resResponse.json();
          if (resResult?.data) setResidualData(resResult.data);
        }
      } catch (err) {
        console.warn("Backend physique non disponible – utilisation des données mock");
        setError("Mode démo : backend non accessible, affichage des données simulées.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [simulationId, time, API_BASE_URL]);

  const convertTurbulenceForChart = (data: TurbulenceData) => {
    if (!data) return [];
    return data.wavenumbers.map((k, i) => ({
      k: k.toFixed(3),
      energy: data.energy_density[i] || 0,
      theoretical: Math.pow(parseFloat(k.toFixed(3)), -5 / 3) * (data.energy_density[0] || 1),
    }));
  };

  const convertBoundaryLayerForChart = (data: BoundaryLayerData) => {
    if (!data) return [];
    return data.y.map((y, i) => ({
      y: y.toFixed(4),
      velocity: data.velocity[i] || 0,
      y_plus: data.y_plus[i] || 0,
    }));
  };

  const generateHeatmapSVG = (map: number[][]): string => {
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
  };

  const renderPhysicsChart = (data: any[], yLabel: string, color: string = "#10b981") => (
    <div className="h-[300px] w-full bg-black/60 rounded-3xl p-4 border border-emerald-500/20">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`colorUncertainty_${yLabel}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={`${color}20`} vertical={false} />
          <XAxis dataKey="time" stroke={color} fontSize={10} />
          <YAxis stroke={color} fontSize={10} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: color, fontSize: 10 }} />
          <Tooltip contentStyle={{ backgroundColor: '#000000', border: `1px solid ${color}` }} labelStyle={{ color: color }} />
          <Area 
            type="monotone" 
            dataKey="upper" 
            stroke="none" 
            fill={`url(#colorUncertainty_${yLabel})`} 
            baseDataKey="lower" 
            name="Incertitude" 
          />
          <Area 
            type="monotone" 
            dataKey="amplitude" 
            stroke={color} 
            strokeWidth={2} 
            fill="none" 
            name={yLabel} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="bg-black border-emerald-500/20 overflow-hidden rounded-[32px]">
        <CardHeader className="border-b border-emerald-500/10 bg-black">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black text-emerald-400 tracking-tight">Advanced Physics Analysis</CardTitle>
              <CardDescription className="text-emerald-600/70">
                Validation Multi-Physique : Pression, Température & Flux Turbulent
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono">
              V8.2 ENGINE ACTIVE
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 bg-black">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-emerald-500/5 p-1 rounded-2xl border border-emerald-500/20">
              <TabsTrigger value="turbulence" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all">Spectres TKE</TabsTrigger>
              <TabsTrigger value="boundary-layer" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all">Couche Limite</TabsTrigger>
              <TabsTrigger value="residuals" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all">Cartes PINN</TabsTrigger>
              <TabsTrigger value="multi-physics" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all">Multi-Physique</TabsTrigger>
            </TabsList>

            {/* Spectres TKE */}
            <TabsContent value="turbulence" className="space-y-6">
              {turbulenceData ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Pente Spectrale</p>
                      <p className="text-2xl font-black text-emerald-300">-5/3 <span className="text-xs text-emerald-600">Kolmogorov</span></p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Énergie Totale</p>
                      <p className="text-2xl font-black text-emerald-300">{turbulenceData.energy_density.reduce((a,b)=>a+b,0).toExponential(2)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Échelles Résolues</p>
                      <p className="text-2xl font-black text-emerald-300">{turbulenceData.wavenumbers.length} modes</p>
                    </div>
                  </div>
                  <div className="h-[400px] w-full bg-black/60 rounded-3xl border border-emerald-500/20 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={convertTurbulenceForChart(turbulenceData)}>
                        <defs>
                          <linearGradient id="colorEnergyEmerald" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#10b98120" vertical={false} />
                        <XAxis dataKey="k" stroke="#10b981" fontSize={10} label={{ value: 'Nombre d\'onde k', position: 'insideBottomRight', fill: '#10b981' }} />
                        <YAxis scale="log" domain={['auto', 'auto']} stroke="#10b981" fontSize={10} label={{ value: 'Énergie E(k)', angle: -90, fill: '#10b981' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#000000', border: '1px solid #10b981' }} labelStyle={{ color: '#10b981' }} />
                        <Area type="monotone" dataKey="energy" stroke="#10b981" strokeWidth={3} fill="url(#colorEnergyEmerald)" name="Spectre réel" />
                        <Line type="monotone" dataKey="theoretical" stroke="#10b98160" strokeDasharray="5 5" dot={false} name="Loi -5/3" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-emerald-600">Données de turbulence non disponibles</div>
              )}
            </TabsContent>

            {/* Couche Limite */}
            <TabsContent value="boundary-layer" className="space-y-6">
              {boundaryLayerData ? (
                <div className="h-[400px] w-full bg-black/60 rounded-3xl border border-emerald-500/20 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={convertBoundaryLayerForChart(boundaryLayerData)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#10b98120" />
                      <XAxis dataKey="y" stroke="#10b981" label={{ value: 'Distance à la paroi (m)', position: 'insideBottomRight', fill: '#10b981' }} />
                      <YAxis stroke="#10b981" label={{ value: 'U (m/s)', angle: -90, fill: '#10b981' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#000000', border: '1px solid #10b981' }} labelStyle={{ color: '#10b981' }} />
                      <Legend wrapperStyle={{ color: '#10b981' }} />
                      <Line type="monotone" dataKey="velocity" stroke="#10b981" strokeWidth={3} name="Vitesse réelle" />
                      <Line type="monotone" dataKey="y_plus" stroke="#10b98160" strokeWidth={1} name="y+" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="p-12 text-center text-emerald-600">Données de couche limite non disponibles</div>
              )}
            </TabsContent>

            {/* Cartes PINN */}
            <TabsContent value="residuals" className="space-y-6">
              {residualData ? (
                <div className="text-center">
                  <div className="inline-block p-4 bg-black/60 rounded-3xl border border-emerald-500/20 shadow-2xl">
                    <div dangerouslySetInnerHTML={{ __html: generateHeatmapSVG(residualData.map) }} className="rounded-lg overflow-hidden" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mt-4">
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-600 uppercase">Plan de coupe</p>
                      <p className="text-lg font-black text-emerald-400">{residualData.plane.toUpperCase()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-600 uppercase">Position</p>
                      <p className="text-lg font-black text-emerald-400">{residualData.coord.toFixed(3)} m</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-emerald-600">Cartographie des résidus non disponible</div>
              )}
            </TabsContent>

            {/* Multi-Physique : Vitesse, Pression, Température */}
            <TabsContent value="multi-physics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest text-center">Profil de Vitesse</h4>
                  {renderPhysicsChart(velocityData, "Vitesse (m/s)")}
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest text-center">Profil de Pression</h4>
                  {renderPhysicsChart(pressureData, "Pression (bar)")}
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest text-center">Profil de Température</h4>
                  {renderPhysicsChart(temperatureData, "Température (K)")}
                </div>
              </div>
              <p className="text-center text-[10px] text-emerald-600 uppercase tracking-widest">Physics Validation - Nexus V8.2 | Émeraude CFD-ML Hybrid</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="default" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
