import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Share2, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface AnalysisData {
  id: string;
  title: string;
  status: string;
  credibilityScore: number;
  continuityResidual: number;
  momentumResidual: number;
  energyResidual: number;
  anomalies: string[];
  createdAt: string;
}

export default function AnalysisPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/analysis/:id");
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  useEffect(() => {
    // Mock data - replace with tRPC call
    setLoading(true);
    setTimeout(() => {
      setAnalysis({
        id: params?.id || "1",
        title: "Wing Aerodynamic Analysis",
        status: "completed",
        credibilityScore: 92,
        continuityResidual: 0.0245,
        momentumResidual: 0.0312,
        energyResidual: 0.0189,
        anomalies: [],
        createdAt: new Date().toISOString(),
      });
      setLoading(false);
    }, 500);
  }, [params?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Zap className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-slate-400">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Analysis not found</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const residualData = [
    { name: "Continuity", value: analysis.continuityResidual },
    { name: "Momentum", value: analysis.momentumResidual },
    { name: "Energy", value: analysis.energyResidual },
  ];

  const scoreColor = analysis.credibilityScore >= 80 ? "text-green-400" : analysis.credibilityScore >= 60 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-slate-400 hover:text-white">
              ← Back to Dashboard
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="border-slate-600">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">{analysis.title}</h1>
          <p className="text-slate-400">Created {new Date(analysis.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700 md:col-span-2">
            <CardHeader>
              <CardTitle>Credibility Score</CardTitle>
              <CardDescription>Overall physics validation score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className={`text-6xl font-bold ${scoreColor}`}>{analysis.credibilityScore}</div>
                <div className="flex-1">
                  <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full transition-all ${analysis.credibilityScore >= 80 ? "bg-green-500" : analysis.credibilityScore >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${analysis.credibilityScore}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-400">
                    {analysis.credibilityScore >= 80 ? "Excellent - Highly credible simulation" : analysis.credibilityScore >= 60 ? "Good - Minor physics violations" : "Fair - Moderate violations"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="bg-green-500/20 text-green-400 border-0 text-base py-2 px-3">
                <CheckCircle2 className="w-4 h-4 mr-2 inline" />
                Completed
              </Badge>
              {analysis.anomalies.length === 0 && (
                <p className="text-sm text-green-400 mt-4">✓ No anomalies detected</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* PDE Residuals */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle>PDE Residuals</CardTitle>
            <CardDescription>Physics equation violation metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={residualData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="value" fill="#3b82f6" name="Residual Value" />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Continuity</p>
                <p className="text-2xl font-bold text-blue-400">{analysis.continuityResidual.toFixed(4)}</p>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Momentum</p>
                <p className="text-2xl font-bold text-cyan-400">{analysis.momentumResidual.toFixed(4)}</p>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Energy</p>
                <p className="text-2xl font-bold text-purple-400">{analysis.energyResidual.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different views */}
        <Tabs defaultValue="fields" className="space-y-4">
          <TabsList className="bg-slate-800/50 border-slate-700">
            <TabsTrigger value="fields">Field Visualization</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
          </TabsList>

          {/* Field Visualization */}
          <TabsContent value="fields">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Physical Fields</CardTitle>
                <CardDescription>Velocity, pressure, and viscosity distributions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-700/50 p-6 rounded-lg text-center">
                    <p className="text-sm text-slate-400 mb-2">Velocity Field (U)</p>
                    <div className="w-full h-40 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg"></div>
                  </div>
                  <div className="bg-slate-700/50 p-6 rounded-lg text-center">
                    <p className="text-sm text-slate-400 mb-2">Velocity Field (V)</p>
                    <div className="w-full h-40 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg"></div>
                  </div>
                  <div className="bg-slate-700/50 p-6 rounded-lg text-center">
                    <p className="text-sm text-slate-400 mb-2">Pressure Field</p>
                    <div className="w-full h-40 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics */}
          <TabsContent value="metrics">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Analysis Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="text-sm text-slate-400 mb-2">Max Velocity</p>
                    <p className="text-2xl font-bold">2.45 m/s</p>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="text-sm text-slate-400 mb-2">Max Pressure</p>
                    <p className="text-2xl font-bold">101.3 kPa</p>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="text-sm text-slate-400 mb-2">Min Pressure</p>
                    <p className="text-2xl font-bold">99.8 kPa</p>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="text-sm text-slate-400 mb-2">Avg Viscosity</p>
                    <p className="text-2xl font-bold">0.001 Pa·s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anomalies */}
          <TabsContent value="anomalies">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Anomaly Detection</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.anomalies.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <p className="text-slate-400">No anomalies detected</p>
                    <p className="text-sm text-slate-500 mt-2">All physics constraints are satisfied</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analysis.anomalies.map((anomaly, idx) => (
                      <div key={idx} className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-slate-300">{anomaly}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report */}
          <TabsContent value="report">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Analysis Report</CardTitle>
                <CardDescription>AI-generated narrative analysis</CardDescription>
              </CardHeader>
              <CardContent className="prose prose-invert max-w-none">
                <p className="text-slate-300">
                  This CFD simulation demonstrates excellent physical consistency with a credibility score of 92/100.
                  The continuity equation residual of 0.0245 indicates strong mass conservation, while the momentum
                  residual of 0.0312 suggests well-resolved velocity fields. The energy residual of 0.0189 reflects
                  proper thermal distribution modeling.
                </p>
                <p className="text-slate-300 mt-4">
                  No anomalies were detected in the simulation. The velocity magnitude remains within realistic bounds
                  (max 2.45 m/s), pressure gradients are smooth, and no numerical instabilities are present.
                </p>
                <p className="text-slate-300 mt-4">
                  Recommendation: This simulation is suitable for publication and further analysis. The physics-informed
                  validation confirms the numerical solution's reliability.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}