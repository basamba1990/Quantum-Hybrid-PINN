'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Zap, Brain, Waves, BarChart3, Shield, Menu, X, Boxes as Cube } from 'lucide-react'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Quantum-Hybrid PINN
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="hover:text-blue-400 transition">Features</a>
              <a href="#benefits" className="hover:text-blue-400 transition">Benefits</a>
              <a href="#demo" className="hover:text-blue-400 transition">Demo</a>
              <a href="#contact" className="hover:text-blue-400 transition">Contact</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/demo" className="px-4 py-2 rounded-lg border border-blue-400 text-blue-400 hover:bg-blue-400/10 transition">
                Démo
              </Link>
              <Link href="/pricing" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition font-medium">
                S'abonner
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-2">
              <a href="#features" className="block py-2 hover:text-blue-400">Features</a>
              <a href="#benefits" className="block py-2 hover:text-blue-400">Benefits</a>
              <a href="#demo" className="block py-2 hover:text-blue-400">Demo</a>
              <a href="#contact" className="block py-2 hover:text-blue-400">Contact</a>
              <div className="flex gap-2 pt-4">
                <Link href="/demo" className="flex-1 px-4 py-2 rounded-lg border border-blue-400 text-center">
                  Try Demo
                </Link>
                <Link href="/auth/signup" className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-center">
                  Get Started
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30">
            <span className="text-sm text-blue-300">AI-Powered Physics Simulation</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Physics-Informed Neural Networks for
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent"> Industrial Simulation</span>
          </h1>

          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Advanced AI-powered fluid dynamics and thermal analysis for hydrogen storage, pipelines, and industrial systems. Certifications scientifiques intégrées.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demo" className="px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold flex items-center justify-center gap-2 transition">
              Try the Demo <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#features" className="px-8 py-4 rounded-lg border border-blue-400 text-blue-400 hover:bg-blue-400/10 font-semibold transition">
              See the Concept
            </Link>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-blue-400 text-sm font-semibold mb-2">WATCH THE DEMO</p>
            <h2 className="text-4xl font-bold mb-4">See Quantum-Hybrid PINN in Action</h2>
            <p className="text-slate-300">Advanced 3D visualization and scientific audit of fluid dynamics simulations</p>
          </div>

          <div className="aspect-video rounded-2xl bg-slate-900 border border-blue-500/20 flex items-center justify-center overflow-hidden">
            <div className="text-center">
              <Cube className="w-16 h-16 mx-auto mb-4 text-blue-400 opacity-50" />
              <p className="text-slate-400">Interactive 3D Visualization Demo</p>
              <Link href="/demo" className="mt-4 inline-block px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition">
                Launch Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-12 text-center">The Challenge</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: '⏱️',
                title: 'Time-Consuming Simulations',
                desc: 'Traditional CFD simulations take weeks or months to complete'
              },
              {
                icon: '💰',
                title: 'Prohibitive Costs',
                desc: 'High computational costs for parametric analysis and optimization'
              },
              {
                icon: '❓',
                title: 'Uncertainty in Predictions',
                desc: 'Lack of scientific certainty and validation in results'
              },
              {
                icon: '🔬',
                title: 'Expensive Validation',
                desc: 'Need for costly experimental validation and certification'
              }
            ].map((item, idx) => (
              <div key={idx} className="p-6 rounded-xl bg-slate-800/50 border border-blue-500/20 hover:border-blue-500/50 transition">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold mb-4 text-center">The Solution</h2>
          <p className="text-center text-slate-300 mb-12 max-w-2xl mx-auto">
            Quantum-Hybrid PINN combines cutting-edge AI with physics constraints for accurate, fast, and certified simulations
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Brain className="w-8 h-8" />,
                title: 'PINN V8.1',
                desc: 'Physics-Informed Neural Networks with advanced thermodynamic validation'
              },
              {
                icon: <Waves className="w-8 h-8" />,
                title: '3D Navier-Stokes',
                desc: 'Complete fluid dynamics simulation with real-time 3D visualization'
              },
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: 'Scientific Audit',
                desc: 'Automatic validation of residuals and physical coherence'
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: 'Deep Kalman Filter',
                desc: 'Data assimilation for improved accuracy and uncertainty quantification'
              },
              {
                icon: <Cube className="w-8 h-8" />,
                title: '3D Field Visualization',
                desc: 'Interactive scalar fields and trajectory analysis'
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: 'Risk Management',
                desc: 'Industrial certification and compliance validation'
              }
            ].map((feature, idx) => (
              <div key={idx} className="p-6 rounded-xl bg-slate-900/50 border border-blue-500/20 hover:border-blue-500/50 transition group">
                <div className="text-blue-400 mb-4 group-hover:text-cyan-400 transition">{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-12 text-center">Why Choose Quantum-Hybrid PINN?</h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-400">For Engineers</h3>
              <ul className="space-y-3">
                {[
                  'Fast, accurate simulations in hours not weeks',
                  'Scientifically validated results with audit trails',
                  'Interactive 3D visualization for better insights',
                  'Parametric analysis at a fraction of the cost'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <ArrowRight className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4 text-cyan-400">For Organizations</h3>
              <ul className="space-y-3">
                {[
                  'Reduce project timelines by 60-80%',
                  'Lower computational and validation costs',
                  'Improve decision-making with certified data',
                  'Scale simulations across multiple projects'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <ArrowRight className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Simulations?</h2>
          <p className="text-blue-100 mb-8">
            Join early adopters and experience the future of industrial simulation
          </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demo" className="px-8 py-4 rounded-lg bg-white text-blue-600 font-semibold hover:bg-slate-100 transition">
              Essayer la Démo
            </Link>
            <Link href="/pricing" className="px-8 py-4 rounded-lg border-2 border-white text-white font-semibold hover:bg-white/10 transition">
              Voir les Tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-blue-500/20 py-12 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-blue-400">Quantum-Hybrid PINN</span>
              </div>
              <p className="text-slate-400 text-sm">
                AI-powered physics simulations for industrial applications
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#features" className="hover:text-blue-400 transition">Features</a></li>
                <li><a href="/demo" className="hover:text-blue-400 transition">Demo</a></li>
                <li><a href="/pricing" className="hover:text-blue-400 transition">Pricing</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-blue-400 transition">About</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Blog</a></li>
                <li><a href="#contact" className="hover:text-blue-400 transition">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><Link href="/privacy" className="hover:text-blue-400 transition">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-blue-400 transition">Terms</Link></li>
                <li><Link href="/refunds" className="hover:text-blue-400 transition">Refunds</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-blue-500/20 pt-8 text-center text-slate-400 text-sm">
            <p>© 2026 Quantum-Hybrid PINN. All rights reserved. Built for industrial engineers, by engineers.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
