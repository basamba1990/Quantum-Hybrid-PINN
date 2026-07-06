'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Check, X, ArrowRight, Zap } from 'lucide-react'
import { PaddleCheckout } from '@/components/paddle-checkout'

export default function PricingPage() {
  const plans = [
    {
      name: 'Researcher',
      price: '$99',
      period: '/month',
      description: 'For independent researchers and consultants',
      features: [
        { text: 'Up to 10 custom simulations/month', included: true },
        { text: '3D visualization (interactive)', included: true },
        { text: 'Scientific audit reports', included: true },
        { text: 'Basic parametric analysis', included: true },
        { text: 'REST API access (100 req/day)', included: true },
        { text: 'Email support (48h response)', included: true },
        { text: 'Data export (CSV only)', included: true },
        { text: 'Advanced parametric analysis', included: false },
        { text: 'Custom EOS models', included: false },
        { text: 'Priority support', included: false },
      ],
      highlight: false,
      badge: null,
    },
    {
      name: 'Professional',
      price: '$499',
      period: '/month',
      description: 'For engineering teams and R&D departments',
      features: [
        { text: 'Unlimited custom simulations', included: true },
        { text: '3D visualization (interactive)', included: true },
        { text: 'Scientific audit with certification', included: true },
        { text: 'Advanced parametric analysis', included: true },
        { text: 'REST API access (10k req/day)', included: true },
        { text: 'Email support (24h response)', included: true },
        { text: 'Data export (CSV, JSON, Excel)', included: true },
        { text: 'Batch processing (up to 100 jobs)', included: true },
        { text: 'Custom EOS models', included: false },
        { text: 'Phone support', included: false },
      ],
      highlight: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      price: '$2,499',
      period: '/month',
      description: 'For large organizations and multinationals',
      features: [
        { text: 'Everything in Professional', included: true },
        { text: 'Unlimited API requests', included: true },
        { text: 'Dedicated infrastructure', included: true },
        { text: 'Custom EOS models & validation', included: true },
        { text: '24/7 phone & email support', included: true },
        { text: 'Custom integrations (SAP, ANSYS)', included: true },
        { text: 'On-premise deployment option', included: true },
        { text: 'Advanced security & compliance', included: true },
        { text: 'SLA guarantee (99.9% uptime)', included: true },
        { text: 'Dedicated account manager', included: true },
      ],
      highlight: false,
      badge: null,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-400">
            Quantum-Hybrid PINN
          </Link>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-blue-400 transition">Back to Home</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Simple, Transparent
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent"> Pricing</span>
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Choose the plan that fits your industrial needs. All plans include our core PINN V8.1 simulation engine.
          </p>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-12 px-4 sm:px-6 lg:px-8" id="plans">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`relative rounded-2xl p-8 border transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-slate-800/80 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2)] scale-105 z-10'
                    : 'bg-slate-900/50 border-slate-700 hover:border-blue-500/50'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-slate-400 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-slate-400">{plan.period}</span>}
                  </div>
                </div>

                <div className="mb-8">
                  <PaddleCheckout
                    planId={
                      plan.name === 'Researcher' ? (process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_RESEARCHER || 'pri_01kws7mnzam0jvm7aha7s7txj3') : 
                      plan.name === 'Professional' ? (process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PROFESSIONAL || 'pri_01kws7wp26ngs9vf08wg7w2ny7') : 
                      (process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_ENTERPRISE || 'pri_01kws84eg5bpffg4m6r2pm85fv')
                    }
                    planName={plan.name}
                    price={plan.price === 'Custom' ? 2499 : parseInt(plan.price.replace('$', '').replace(',', ''))}
                    email=""
                    onSuccess={() => {
                      window.location.href = '/dashboard?success=true'
                    }}
                  />
                </div>

                <ul className="space-y-4">
                  {plan.features.map((feature, fidx) => (
                    <li key={fidx} className="flex items-start gap-3 text-sm">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-slate-600 flex-shrink-0" />
                      )}
                      <span className={feature.included ? 'text-slate-200' : 'text-slate-500'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mb-12 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: 'Can I change plans anytime?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we prorate charges accordingly.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept credit cards (Visa, Mastercard), PayPal, and Apple Pay via Paddle.'
              },
              {
                q: 'How does billing work?',
                a: 'Billing is monthly by default. Annual plans include a 20% discount.'
              },
              {
                q: 'Is my data secure?',
                a: 'All data is encrypted at rest and in transit. We comply with GDPR and ISO 27001 standards.'
              },
            ].map((item, idx) => (
              <div key={idx} className="border border-blue-500/20 rounded-lg p-6 hover:border-blue-500/50 transition">
                <h3 className="text-lg font-semibold mb-2 text-blue-400">{item.q}</h3>
                <p className="text-slate-300">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-8">
            Join engineering teams worldwide who are transforming their simulation workflows with Quantum-Hybrid PINN.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demo" className="px-8 py-4 rounded-lg border border-white text-white hover:bg-white/10 font-semibold transition flex items-center justify-center gap-2">
              <Zap className="w-5 h-5" />
              Try Demo First
            </Link>
            <a href="#plans" className="px-8 py-4 rounded-lg bg-white text-blue-600 font-semibold hover:bg-slate-100 transition flex items-center justify-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Select a Plan
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-blue-500/20 py-12 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-6xl mx-auto text-center text-slate-400 text-sm">
          <p>© 2026 Quantum-Hybrid PINN. All rights reserved. Secure payments via Paddle.</p>
        </div>
      </footer>
    </div>
  )
}
