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
  ScatterChart,
  Scatter,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchAnalysisData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch turbulence spectra
        const turbResponse = await fetch(`${API_BASE_URL}/v2/analysis/turbulence-spectra`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time }),
        });
        if (turbResponse.ok) {
          const turbResult = await turbResponse.json();
          setTurbulenceData(turbResult.data);
        }

        // Fetch boundary layer
        const blResponse = await fetch(`${API_BASE_URL}/v2/analysis/boundary-layer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time, x: 0.5, z: 0.5 }),
        });
        if (blResponse.ok) {
          const blResult = await blResponse.json();
          setBoundaryLayerData(blResult.data);
        }

        // Fetch residuals map
        const resResponse = await fetch(`${API_BASE_URL}/v2/analysis/residuals-map`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulation_id: simulationId, time, plane: 'xy', coord: 0.0 }),
        });
        if (resResponse.ok) {
          const resResult = await resResponse.json();
          setResidualData(resResult.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de la récupération des données');
      } finally {
        setLoading(false);
      }
    };

    if (simulationId && time >= 0) {
      fetchAnalysisData();
    }
  }, [simulationId, time, API_BASE_URL]);

  const convertTurbulenceForChart = (data: TurbulenceData) => {
    return data.wavenumbers.map((k, i) => ({
      k: k.toFixed(3),
      energy: data.energy_density[i] || 0,
    }));
  };

  const convertBoundaryLayerForChart = (data: BoundaryLayerData) => {
    return data.y.map((y, i) => ({
      y: y.toFixed(4),
      velocity: data.velocity[i] || 0,
      y_plus: data.y_plus[i] || 0,
    }));
  };

  const generateHeatmapColors = (map: number[][]): string => {
    // Génère une représentation SVG simple de la carte de chaleur
    const maxVal = Math.max(...map.flat());
    const minVal = Math.min(...map.flat());
    const range = maxVal - minVal || 1;

    const rows = map.map((row, i) =>
      row.map((val, j) => {
        const normalized = (val - minVal) / range;
        const hue = (1 - normalized) * 240; // Bleu (240) à Rouge (0)
        return `<rect x="${j * 5}" y="${i * 5}" width="5" height="5" fill="hsl(${hue}, 100%, 50%)" />`;
      }).join('')
    ).join('');

    return `<svg width="${map[0]?.length * 5}px" height="${map.length * 5}px">${rows}</svg>`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Chargement des analyses physiques avancées...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Erreur: {error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analyse Physique Avancée Multi-Physique</CardTitle>
          <CardDescription>
            Spectres de turbulence, profils de couche limite et cartes de résidus PINN/FNO
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="turbulence">Spectres de Turbulence</TabsTrigger>
              <TabsTrigger value="boundary-layer">Couche Limite</TabsTrigger>
              <TabsTrigger value="residuals">Cartes de Résidus</TabsTrigger>
            </TabsList>

            {/* Turbulence Spectra Tab */}
            <TabsContent value="turbulence" className="space-y-4 mt-4">
              {turbulenceData ? (
                <>
                  <div className="bg-blue-50 p-4 rounded border border-blue-200 mb-4">
                    <p className="text-sm text-blue-900">
                      <strong>Spectre d'Énergie Cinétique Turbulente (TKE):</strong> Ce graphique montre la distribution
                      de l'énergie cinétique à travers les différentes échelles (nombres d'onde). Une pente de -5/3
                      (Kolmogorov) indique une cascade énergétique turbulente saine.
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={convertTurbulenceForChart(turbulenceData)}>
                      <defs>
                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="k" label={{ value: 'Nombre d\'onde (k)', position: 'insideBottomRight', offset: -5 }} />
                      <YAxis scale="log" label={{ value: 'Densité d\'énergie (log)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value) => (typeof value === 'number' ? value.toExponential(2) : value)} />
                      <Area type="monotone" dataKey="energy" stroke="#8884d8" fillOpacity={1} fill="url(#colorEnergy)" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-gray-600">Nombre d'onde max</p>
                        <p className="text-lg font-bold">{Math.max(...turbulenceData.wavenumbers).toFixed(3)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-gray-600">Énergie totale</p>
                        <p className="text-lg font-bold">{turbulenceData.energy_density.reduce((a, b) => a + b, 0).toExponential(2)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-gray-600">Nombre de modes</p>
                        <p className="text-lg font-bold">{turbulenceData.wavenumbers.length}</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500">Données de turbulence non disponibles</p>
              )}
            </TabsContent>

            {/* Boundary Layer Tab */}
            <TabsContent value="boundary-layer" className="space-y-4 mt-4">
              {boundaryLayerData ? (
                <>
                  <div className="bg-green-50 p-4 rounded border border-green-200 mb-4">
                    <p className="text-sm text-green-900">
                      <strong>Profil de Couche Limite:</strong> Ce profil montre la variation de vitesse normale à la paroi.
                      La région linéaire (y+ &lt; 5) est la sous-couche visqueuse, suivie de la région logarithmique.
                      Ce profil est essentiel pour valider la physique de la simulation près des parois.
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={convertBoundaryLayerForChart(boundaryLayerData)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="y" label={{ value: 'Distance à la paroi (y)', position: 'insideBottomRight', offset: -5 }} />
                      <YAxis label={{ value: 'Vitesse (m/s)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="velocity" stroke="#82ca9d" name="Vitesse" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-gray-600">Vitesse max</p>
                        <p className="text-lg font-bold">{Math.max(...boundaryLayerData.velocity).toFixed(3)} m/s</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-gray-600">y+ max</p>
                        <p className="text-lg font-bold">{Math.max(...boundaryLayerData.y_plus).toFixed(1)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-gray-600">Épaisseur couche limite</p>
                        <p className="text-lg font-bold">{Math.max(...boundaryLayerData.y).toFixed(4)} m</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500">Données de couche limite non disponibles</p>
              )}
            </TabsContent>

            {/* Residuals Map Tab */}
            <TabsContent value="residuals" className="space-y-4 mt-4">
              {residualData ? (
                <>
                  <div className="bg-orange-50 p-4 rounded border border-orange-200 mb-4">
                    <p className="text-sm text-orange-900">
                      <strong>Carte des Résidus PINN/FNO:</strong> Cette carte affiche l'amplitude des résidus des équations
                      physiques (Navier-Stokes, continuité, énergie) en chaque point. Les zones rouges indiquent des régions
                      où le modèle a du mal à satisfaire les lois physiques. Les zones bleues indiquent une bonne convergence.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <div dangerouslySetInnerHTML={{ __html: generateHeatmapColors(residualData.map) }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-gray-600">Plan d'analyse</p>
                        <p className="text-lg font-bold">{residualData.plane.toUpperCase()}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-gray-600">Coordonnée</p>
                        <p className="text-lg font-bold">{residualData.coord.toFixed(3)}</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500">Données de résidus non disponibles</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Physical Insights Card */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-l-purple-500">
        <CardHeader>
          <CardTitle className="text-base">Insights Physiques Avancés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            ✓ <strong>Turbulence:</strong> L'analyse spectrale révèle la structure multi-échelle de la turbulence.
            Une cascade énergétique saine suit la loi de Kolmogorov (-5/3).
          </p>
          <p>
            ✓ <strong>Couche Limite:</strong> Le profil de vitesse valide la physique près des parois.
            Les modèles RANS doivent capturer correctement cette région critique.
          </p>
          <p>
            ✓ <strong>Résidus PINN/FNO:</strong> Les cartes de résidus identifient les zones où le modèle
            ML nécessite une correction CFD ou un entraînement supplémentaire.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
