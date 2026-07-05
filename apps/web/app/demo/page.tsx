'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Lock, Zap } from 'lucide-react'
import ScientificAuditCard from '@/components/scientific-audit-card'
import { DEMO_AUDIT_DATA, DEMO_SIMULATION_DATA } from '@/data/demo-simulation'

export default function DemoPage() {
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:text-blue-400 transition">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xl font-bold text-blue-400">Quantum-Hybrid PINN</span>
          </Link>
          <div className="flex gap-4 items-center">
            <span className="text-sm text-blue-300 bg-blue-500/20 px-3 py-1 rounded-full">
              Demo Mode (Read-Only)
            </span>
            <Link
              href="/auth/login?tab=signup"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold transition"
            >
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Quantum-Hybrid PINN
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent"> Demo</span>
            </h1>
            <p className="text-xl text-slate-300 mb-6">
              Explore the capabilities of our Physics-Informed Neural Networks with this pre-calculated hydrogen liquefaction simulation.
            </p>

            {/* Demo Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 mb-8">
              <div className="flex items-start gap-4">
                <Zap className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">About This Demo</h3>
                  <p className="text-slate-300 mb-3">
                    This demonstration showcases a real hydrogen liquefaction pipeline simulation using PINN V8.1. The data shown below is pre-calculated and represents a scientifically validated scenario.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li>✓ Credibility Score: 92.5/100 (Physically Coherent)</li>
                    <li>✓ 12-meter pipeline with 0.5m diameter</li>
                    <li>✓ Inlet: 50 bar, 25K | Outlet: 35 bar, 20K</li>
                    <li>✓ Real-time 3D visualization with scientific audit</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Feature Comparison */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                {
                  title: 'Demo Access',
                  features: ['View pre-calculated simulations', 'Interactive 3D visualization', 'Scientific audit reports', 'Read-only mode'],
                  current: true,
                },
                {
                  title: 'Professional Plan',
                  features: ['Create custom simulations', 'Advanced parametric analysis', 'API access', 'Priority support'],
                  current: false,
                },
                {
                  title: 'Enterprise',
                  features: ['Dedicated infrastructure', 'Custom EOS models', '24/7 support', 'On-premise deployment'],
                  current: false,
                },
              ].map((plan, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-6 border transition ${
                    plan.current
                      ? 'bg-blue-600/20 border-blue-400'
                      : 'bg-slate-800/50 border-slate-700 opacity-60'
                  }`}
                >
                  <h3 className="font-semibold mb-4">{plan.title}</h3>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Scientific Audit Card */}
          <div className="mb-12">
            <ScientificAuditCard
              auditData={DEMO_AUDIT_DATA}
              projectName="Hydrogen Liquefaction Pipeline (Demo)"
              isLoading={false}
            />
          </div>

          {/* Simulation Parameters */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-slate-800/50 border border-blue-500/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-6 text-blue-400">Simulation Parameters</h3>
              <div className="space-y-4">
                {Object.entries(DEMO_SIMULATION_DATA.parameters).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center pb-2 border-b border-slate-700">
                    <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono font-semibold">
                      {typeof value === 'number'
                        ? value > 1000
                          ? (value / 1e5).toFixed(1) + ' bar'
                          : value.toFixed(2)
                        : value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-blue-500/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-6 text-blue-400">Residual Analysis</h3>
              <div className="space-y-4">
                {Object.entries(DEMO_SIMULATION_DATA.audit.residuals).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400 capitalize text-sm">{key.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-xs text-green-400">
                        {typeof value === 'number' ? value.toExponential(2) : value}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full"
                        style={{
                          width: `${Math.max(5, Math.min(95, (Math.log10(value as number) + 5) * 10))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready for More?</h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              This demo shows just a fraction of what's possible with Quantum-Hybrid PINN. Upgrade to Professional to create unlimited custom simulations, access advanced parametric analysis, and integrate with your workflows via our REST API.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/pricing"
                className="px-8 py-4 rounded-lg bg-white text-blue-600 font-semibold hover:bg-slate-100 transition"
              >
                View Pricing
              </Link>
              <Link
                href="/auth/login?plan=professional"
                className="px-8 py-4 rounded-lg border-2 border-white text-white font-semibold hover:bg-white/10 transition"
              >
                Start Free Trial
              </Link>
            </div>
          </div>

          {/* Locked Features Notice */}
          <div className="mt-12 bg-slate-800/50 border border-amber-500/30 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <Lock className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2 text-amber-400">Premium Features Locked</h3>
                <p className="text-slate-300 mb-3">
                  The following features are available only to Premium and Enterprise subscribers:
                </p>
                <ul className="grid md:grid-cols-2 gap-2 text-sm text-slate-400">
                  <li>• Create custom simulations</li>
                  <li>• Parametric analysis & optimization</li>
                  <li>• REST API access</li>
                  <li>• Data export (CSV, JSON)</li>
                  <li>• Advanced visualizations</li>
                  <li>• Priority support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-blue-500/20 py-12 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-6xl mx-auto text-center text-slate-400 text-sm">
          <p>© 2026 Quantum-Hybrid PINN. All rights reserved. Demo data is pre-calculated and for demonstration purposes only.</p>
        </div>
      </footer>
    </div>
  )
}
