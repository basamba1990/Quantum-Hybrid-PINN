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
      cta: 'Start Free Trial',
      ctaLink: '/auth/signup?plan=researcher',
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
      cta: 'Start Free Trial',
      ctaLink: '/auth/signup?plan=professional',
      highlight: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'contact us',
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
      cta: 'Contact Sales',
      ctaLink: '/contact?type=enterprise',
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
            Choose the plan that fits your needs. All plans include our core PINN V8.1 simulation engine.
            Start with a 14-day free trial, no credit card required.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className="text-slate-400">Monthly</span>
            <div className="relative inline-flex items-center bg-slate-800 rounded-full p-1">
              <button className="px-4 py-2 rounded-full bg-blue-600 text-white font-semibold">Monthly</button>
              <button className="px-4 py-2 rounded-full text-slate-400 hover:text-white">Annual (Save 20%)</button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`rounded-2xl transition transform hover:scale-105 relative ${
                  plan.highlight
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-600 ring-2 ring-blue-400 scale-105 md:scale-110 shadow-2xl shadow-blue-600/50'
                    : 'bg-slate-800/50 border border-blue-500/20 hover:border-blue-500/50'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="px-4 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 text-sm font-bold">
                      {plan.badge}
                    </div>
                  </div>
                )}

                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-slate-300 text-sm mb-6">{plan.description}</p>

                  <div className="mb-6">
                    <div className="text-4xl font-bold">
                      {plan.price}
                      {plan.period && <span className="text-lg text-slate-300">{plan.period}</span>}
                    </div>
                    {plan.name === 'Researcher' && (
                      <p className="text-xs text-slate-400 mt-2">Perfect for getting started</p>
                    )}
                    {plan.name === 'Professional' && (
                      <p className="text-xs text-slate-200 mt-2">Best value for engineering teams</p>
                    )}
                    {plan.name === 'Enterprise' && (
                      <p className="text-xs text-slate-400 mt-2">Custom solutions for your organization</p>
                    )}
                  </div>

                  <PaddleCheckout
                    planId={process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || ''}
                    planName={plan.name}
                    price={parseInt(plan.price.replace('$', ''))}
                    email=""
                    onSuccess={() => {
                      alert(`Welcome to ${plan.name}! Your subscription is active.`)
                    }}
                    onError={(error) => {
                      alert(`Payment failed: ${error.message}`)
                    }}
                  />

                  <div className="space-y-4">
                    {plan.features.map((feature, fidx) => (
                      <div key={fidx} className="flex items-start gap-3">
                        {feature.included ? (
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? 'text-slate-200 text-sm' : 'text-slate-500 text-sm'}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold mb-12 text-center">Detailed Feature Comparison</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-500/20">
                  <th className="text-left py-4 px-4 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold">Researcher</th>
                  <th className="text-center py-4 px-4 font-semibold text-blue-400">Professional</th>
                  <th className="text-center py-4 px-4 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Simulations/month', researcher: '10', professional: 'Unlimited', enterprise: 'Unlimited' },
                  { feature: 'PINN V8.1 Engine', researcher: '✓', professional: '✓', enterprise: '✓' },
                  { feature: '3D Visualization', researcher: '✓', professional: '✓', enterprise: '✓' },
                  { feature: 'API Requests/day', researcher: '100', professional: '10,000', enterprise: 'Unlimited' },
                  { feature: 'Custom EOS Models', researcher: '✗', professional: '✗', enterprise: '✓' },
                  { feature: 'Support Response Time', researcher: '48h', professional: '24h', enterprise: '1h' },
                  { feature: 'Phone Support', researcher: '✗', professional: '✗', enterprise: '✓' },
                  { feature: 'SLA Guarantee', researcher: '✗', professional: '✗', enterprise: '99.9%' },
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50">
                    <td className="py-4 px-4 text-slate-300">{row.feature}</td>
                    <td className="py-4 px-4 text-center text-slate-400">{row.researcher}</td>
                    <td className="py-4 px-4 text-center text-blue-300 font-semibold">{row.professional}</td>
                    <td className="py-4 px-4 text-center text-slate-400">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                a: 'We accept all major credit cards (Visa, Mastercard) via Flutterwave. You can also pay via bank transfer for Enterprise plans.'
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes! All plans include a 14-day free trial with full access to features. No credit card required to start.'
              },
              {
                q: 'What about data security?',
                a: 'All data is encrypted in transit and at rest. We comply with GDPR, ISO 27001, and maintain regular security audits.'
              },
              {
                q: 'Do you offer annual billing discounts?',
                a: 'Yes! Annual plans include 20% discount. Contact our sales team for Enterprise annual pricing.'
              },
              {
                q: 'What happens if I exceed my API limits?',
                a: 'We notify you when approaching limits. You can upgrade anytime, or we can discuss custom limits for your use case.'
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
            <Link href="/auth/signup" className="px-8 py-4 rounded-lg bg-white text-blue-600 font-semibold hover:bg-slate-100 transition flex items-center justify-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Start Free Trial
            </Link>
          </div>

          <p className="text-blue-100 text-sm mt-6">
            14-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-blue-500/20 py-12 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-6xl mx-auto text-center text-slate-400 text-sm">
          <p>© 2026 Quantum-Hybrid PINN. All rights reserved. Payments processed securely via Flutterwave.</p>
        </div>
      </footer>
    </div>
  )
}
