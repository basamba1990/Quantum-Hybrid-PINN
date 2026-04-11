import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Zap, BarChart3, Lock, Rocket, ArrowRight } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">FluidAI</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>Dashboard</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <a href={getLoginUrl()}>Sign In</a>
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                  <a href={getLoginUrl()}>Get Started</a>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
            <Rocket className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">Physics-Informed AI for CFD Validation</span>
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-black mb-6 leading-tight">
            Validate CFD Simulations with <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">AI Physics</span>
          </h1>
          
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
            FluidAI combines Physics-Informed Neural Networks with advanced Navier-Stokes solvers to automatically validate your CFD simulations. Get credibility scores, detect anomalies, and generate professional reports in seconds.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg h-12" asChild>
              <a href={getLoginUrl()}>Start Free Trial <ArrowRight className="ml-2 w-5 h-5" /></a>
            </Button>
            <Button size="lg" variant="outline" className="text-lg h-12 border-slate-600 hover:bg-slate-800">
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="text-3xl font-bold text-blue-400 mb-2">30-40%</div>
              <p className="text-slate-300">Faster validation vs manual review</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="text-3xl font-bold text-cyan-400 mb-2">0-100</div>
              <p className="text-slate-300">Credibility score with physics validation</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
              <div className="text-3xl font-bold text-blue-400 mb-2">Real-time</div>
              <p className="text-slate-300">Instant analysis and reporting</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Powerful Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: BarChart3,
                title: "Physics Validation",
                description: "Full Navier-Stokes equations with continuity, momentum, and energy conservation"
              },
              {
                icon: Zap,
                title: "Real-time Analysis",
                description: "Video-to-physics pipeline with instant credibility scoring"
              },
              {
                icon: Lock,
                title: "Enterprise Grade",
                description: "OpenFOAM and Ansys compatibility with secure data handling"
              },
              {
                icon: CheckCircle2,
                title: "Anomaly Detection",
                description: "Automatically identify unphysical results and violations"
              },
              {
                icon: Rocket,
                title: "AI Reports",
                description: "LLM-generated narratives with professional formatting"
              },
              {
                icon: BarChart3,
                title: "Detailed Metrics",
                description: "PDE residuals, field visualizations, and export options"
              }
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Card key={idx} className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors">
                  <CardHeader>
                    <Icon className="w-8 h-8 text-blue-400 mb-4" />
                    <CardTitle className="text-white">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Simple, Transparent Pricing</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Pay-Per-Analysis",
                price: "$100-500",
                description: "Perfect for occasional users",
                features: ["Per-analysis pricing", "Standard support", "Self-serve portal", "JSON/Markdown export"]
              },
              {
                name: "SaaS Subscription",
                price: "$5K-50K/mo",
                description: "For professional teams",
                features: ["Unlimited analyses", "Priority GPU access", "Custom integrations", "Dedicated support", "OpenFOAM/Ansys compatibility"],
                highlighted: true
              },
              {
                name: "Enterprise",
                price: "$500K+/yr",
                description: "On-premise deployment",
                features: ["Full source code", "Dedicated support", "Custom domains", "SLA guarantee", "Training included"]
              }
            ].map((tier, idx) => (
              <Card key={idx} className={`border-2 transition-all ${
                tier.highlighted 
                  ? "bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20" 
                  : "bg-slate-800/50 border-slate-700"
              }`}>
                <CardHeader>
                  <CardTitle className="text-white">{tier.name}</CardTitle>
                  <CardDescription className="text-slate-400">{tier.description}</CardDescription>
                  <div className="text-3xl font-bold text-blue-400 mt-4">{tier.price}</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full ${
                    tier.highlighted 
                      ? "bg-blue-600 hover:bg-blue-700" 
                      : "bg-slate-700 hover:bg-slate-600"
                  }`} asChild>
                    <a href={getLoginUrl()}>Get Started</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Validate Your Simulations?</h2>
          <p className="text-xl text-blue-100 mb-8">Join leading aerospace, energy, and automotive companies using FluidAI.</p>
          <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100 text-lg h-12" asChild>
            <a href={getLoginUrl()}>Start Your Free Trial Today</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-slate-400">
          <p>&copy; 2026 FluidAI. All rights reserved. Physics-Informed AI for Scientific Simulation Validation.</p>
        </div>
      </footer>
    </div>
  );
}