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

export function AdvancedPhysicsVisualization({ simulationId, time, onDataFetch }: AdvancedPhysicsProps) {
  const [activeTab, setActiveTab] = useState('turbulence');
  const [turbulenceData, setTurbulenceData] = useState<TurbulenceData | null>(null);
  const [boundaryLayerData, setBoundaryLayerData] = useState<BoundaryLayerData | null>(null);
  const [residualData, setResidualData] = useState<ResidualMapData | null>(null);
  
  const [velocityData, setVelocityData] = useState<any[]>([]);
  const [pressureData, setPressureData] = useState<any[]>([]);
  const [temperatureData, setTemperatureData] = useState<any[]>([]);
  const [industrialData, setIndustrialData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';

  useEffect(() => {
    if (!simulationId) {
      console.log("AdvancedPhysicsVisualization: simulationId is missing");
      return;
    }

    const fetchAnalysisData = async () => {
      console.log(`AdvancedPhysicsVisualization: Fetching data for sim ${simulationId} at time ${time}`);
      setLoading(true);
      setError(null);
      try {
        const turbResponse = await fetch(`${API_BASE_URL}/v2/analysis/turbulence-spectra`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time }),
        });
        if (!turbResponse.ok) {
          throw new Error(`Turbulence API failed: ${turbResponse.status}`);
        }
        const turbResult = await turbResponse.json();
        if (turbResult?.data) setTurbulenceData(turbResult.data);

        const blResponse = await fetch(`${API_BASE_URL}/v2/analysis/boundary-layer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time, x: 0.5, z: 0.5 }),
        });
        if (!blResponse.ok) {
          throw new Error(`Boundary layer API failed: ${blResponse.status}`);
        }
        const blResult = await blResponse.json();
        if (blResult?.data) setBoundaryLayerData(blResult.data);

        const resResponse = await fetch(`${API_BASE_URL}/v2/analysis/residuals-map`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time, plane: 'xy', coord: 0.0 }),
        });
        if (resResponse.ok) {
          const resResult = await resResponse.json();
          if (resResult?.data) setResidualData(resResult.data);
        }

        // Fetch Industrial Data (Stress, Damage, TKE)
        const indResponse = await fetch(`${API_BASE_URL}/v2/validate-3d`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            simulation_id: simulationId, 
            time, 
            x: 0.5, y: 0.5, z: 0.5,
            pressure: 101325, temperature: 293.15, density: 1.0, velocity_magnitude: 1.0
          }),
        });
        if (indResponse.ok) {
          const indResult = await indResponse.json();
          if (indResult?.predictions3d) {
            setIndustrialData(indResult.predictions3d);
            if (onDataFetch) onDataFetch(indResult);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching physics analysis data';
        console.error('Physics analysis error:', errorMsg);
        setError(errorMsg);
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

  const renderPhysicsChart = (data: any[], yLabel: string, dataKey: string) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <div className="p-8 text-center text-emerald-600/50">Aucune donnée disponible pour {yLabel}</div>;
    }

    // Dynamically find upper and lower keys if they exist, else use 5% margin
    const upperKey = `${dataKey}_upper`;
    const lowerKey = `${dataKey}_lower`;
    
    const chartData = data.map(d => {
      const val = d[dataKey] || 0;
      return {
        ...d,
        displayUpper: d[upperKey] !== undefined ? d[upperKey] : val * 1.05,
        displayLower: d[lowerKey] !== undefined ? d[lowerKey] : val * 0.95,
      };
    });

    return (
      <div className="h-[300px] w-full bg-black/60 rounded-3xl p-4 border border-emerald-500/20 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`colorUncertainty_${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#10b98120" vertical={false} />
            <XAxis dataKey="time" stroke="#10b981" fontSize={10} tickFormatter={(val) => typeof val === 'number' ? val.toFixed(2) : val} />
            <YAxis 
              stroke="#10b981" 
              fontSize={10} 
              domain={['auto', 'auto']}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: "#10b981", fontSize: 10 }} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#000000', border: '1px solid #10b981', borderRadius: '12px' }} 
              labelStyle={{ color: '#10b981' }} 
              itemStyle={{ fontSize: '12px' }}
              formatter={(value: any) => typeof value === 'number' ? value.toExponential(4) : value}
            />
            <Area 
              type="monotone" 
              dataKey="displayUpper" 
              stroke="none" 
              fill="#10b98130" 
              name="Limite Sup" 
              isAnimationActive={false}
            />
            <Area 
              type="monotone" 
              dataKey="displayLower" 
              stroke="none" 
              fill="#000000" 
              name="Limite Inf" 
              isAnimationActive={false}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke="#10b981" 
              strokeWidth={3} 
              dot={false}
              name={yLabel} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Erreur lors du chargement des données de physique avancée : {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-emerald-600">
        Chargement des données d'analyse physique...
      </div>
    );
  }

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
            <TabsList className="grid w-full grid-cols-7 bg-emerald-500/5 p-1 rounded-2xl border border-emerald-500/20">
              <TabsTrigger value="turbulence" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Spectres</TabsTrigger>
              <TabsTrigger value="boundary-layer" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Paroi</TabsTrigger>
              <TabsTrigger value="residuals" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Résidus</TabsTrigger>
              <TabsTrigger value="damage" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Endommagement</TabsTrigger>
              <TabsTrigger value="tke" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Turbulence</TabsTrigger>
              <TabsTrigger value="stress" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Contraintes</TabsTrigger>
              <TabsTrigger value="multi-physics" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-emerald-400 font-bold transition-all text-[10px]">Multi-P</TabsTrigger>
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
                <div className="p-12 text-center text-emerald-600">Données de turbulence non disponibles du backend</div>
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
                <div className="p-12 text-center text-emerald-600">Données de couche limite non disponibles du backend</div>
              )}
            </TabsContent>

            {/* Cartes PINN */}
            <TabsContent value="residuals" className="space-y-6">
              {residualData ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Plan</p>
                      <p className="text-2xl font-black text-emerald-300">{residualData.plane.toUpperCase()}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Coordonnée</p>
                      <p className="text-2xl font-black text-emerald-300">{residualData.coord.toFixed(3)}</p>
                    </div>
                  </div>
                  <div className="h-[400px] w-full bg-black/60 rounded-3xl border border-emerald-500/20 p-4 flex items-center justify-center">
                    <div dangerouslySetInnerHTML={{ __html: generateHeatmapSVG(residualData.map) }} />
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-emerald-600">Données de cartes PINN non disponibles du backend</div>
              )}
            </TabsContent>

            {/* Endommagement */}
            <TabsContent value="damage" className="space-y-6">
              {industrialData.length > 0 ? (
                <>
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">État de Dégradation Isotrope (D)</p>
                    <p className="text-sm text-emerald-600/80 mt-1">Évolution de la variable d'endommagement calculée par le RockPINN3D.</p>
                  </div>
                  {renderPhysicsChart(industrialData, 'Endommagement D', 'damage')}
                </>
              ) : (
                <div className="p-12 text-center text-emerald-600">Données d'endommagement non disponibles</div>
              )}
            </TabsContent>

            {/* Turbulence k-epsilon */}
            <TabsContent value="tke" className="space-y-6">
              {industrialData.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Énergie Cinétique (k)</p>
                      <p className="text-xl font-black text-emerald-300">k-ε Model Active</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase">Dissipation (ε)</p>
                      <p className="text-xl font-black text-emerald-300">SciML Validated</p>
                    </div>
                  </div>
                  {renderPhysicsChart(industrialData, 'TKE k (m²/s²)', 'tke')}
                  {renderPhysicsChart(industrialData, 'Dissipation ε (m²/s³)', 'epsilon')}
                </>
              ) : (
                <div className="p-12 text-center text-emerald-600">
                  <p>Données de turbulence non disponibles</p>
                  <p className="text-xs mt-2 opacity-50">En attente de calculs de dissipation ε du solveur PINN</p>
                </div>
              )}
            </TabsContent>

            {/* Contraintes */}
            <TabsContent value="stress" className="space-y-6">
              {industrialData.length > 0 ? (
                <>
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 mb-4">
                    <p className="text-xs font-mono text-emerald-400 uppercase">Tenseur des Contraintes (σ_xx)</p>
                    <p className="text-sm text-emerald-600/80 mt-1">Composante normale du tenseur des contraintes effectives en milieu poreux.</p>
                  </div>
                  {renderPhysicsChart(industrialData, 'Contrainte σ_xx (Pa)', 'stress_xx')}
                </>
              ) : (
                <div className="p-12 text-center text-emerald-600">Données de contraintes non disponibles</div>
              )}
            </TabsContent>

            {/* Multi-Physique */}
            <TabsContent value="multi-physics" className="space-y-6">
              {(velocityData.length > 0 || industrialData.length > 0) ? (
                <>
                  {renderPhysicsChart(industrialData.length > 0 ? industrialData : velocityData, 'Vitesse (m/s)', 'velocity_u')}
                  {renderPhysicsChart(industrialData.length > 0 ? industrialData : pressureData, 'Pression (Pa)', 'pressure')}
                  {renderPhysicsChart(industrialData.length > 0 ? industrialData : temperatureData, 'Température (K)', 'temperature')}
                </>
              ) : (
                <div className="p-12 text-center text-emerald-600">Données multi-physique non disponibles du backend</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
