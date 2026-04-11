import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Clock, Zap, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "wouter";

interface Analysis {
  id: string;
  title: string;
  status: "pending" | "processing" | "completed" | "failed";
  credibilityScore?: number;
  progress: number;
  createdAt: string;
}

const statusConfig = {
  pending: { icon: Clock, color: "bg-yellow-500/20", textColor: "text-yellow-600", label: "Pending" },
  processing: { icon: Zap, color: "bg-blue-500/20", textColor: "text-blue-600", label: "Processing" },
  completed: { icon: CheckCircle2, color: "bg-green-500/20", textColor: "text-green-600", label: "Completed" },
  failed: { icon: XCircle, color: "bg-red-500/20", textColor: "text-red-600", label: "Failed" }
};

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setAnalyses([
        { id: "1", title: "Wing Aerodynamic Analysis", status: "completed", credibilityScore: 92, progress: 100, createdAt: new Date().toISOString() },
        { id: "2", title: "Thermal Management", status: "processing", progress: 65, createdAt: new Date().toISOString() },
        { id: "3", title: "Turbine Blade Flow", status: "completed", credibilityScore: 78, progress: 100, createdAt: new Date().toISOString() }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const filteredAnalyses = analyses.filter(a => 
    (filterStatus === "all" || a.status === filterStatus) &&
    a.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: analyses.length,
    completed: analyses.filter(a => a.status === "completed").length,
    processing: analyses.filter(a => a.status === "processing").length,
    avgCredibility: analyses.filter(a => a.credibilityScore).reduce((sum, a) => sum + (a.credibilityScore || 0), 0) / Math.max(1, analyses.filter(a => a.credibilityScore).length)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-slate-400">Welcome back, {user?.name || "User"}</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate("/upload")}>
            <Upload className="w-4 h-4 mr-2" />
            New Analysis
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">{stats.processing}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">Avg Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyan-400">{stats.avgCredibility.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle>Analyses</CardTitle>
            <CardDescription>View all CFD simulation analyses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-700 border-slate-600" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-48 bg-slate-700 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {loading ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-8 text-center text-slate-400">Loading...</CardContent>
            </Card>
          ) : filteredAnalyses.map((a) => {
            const config = statusConfig[a.status];
            const Icon = config.icon;
            return (
              <Card key={a.id} className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 cursor-pointer" onClick={() => navigate(`/analysis/${a.id}`)}>
                <CardContent className="py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-3 rounded-lg ${config.color}`}>
                        <Icon className={`w-6 h-6 ${config.textColor}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{a.title}</h3>
                        <p className="text-sm text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {a.status === "processing" && <div className="text-sm text-slate-400">{a.progress}%</div>}
                      {a.credibilityScore && <div className="text-2xl font-bold text-cyan-400">{a.credibilityScore}</div>}
                      <Badge className={`${config.color} ${config.textColor} border-0`}>{config.label}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}