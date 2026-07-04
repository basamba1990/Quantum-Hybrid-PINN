'use client'

import React from 'react'
import Link from 'next/link'
import { Check, X, ArrowRight } from 'lucide-react'

export default function PricingPage() {
  const plans = [
    {
      name: 'Demo',
      price: 'Free',
      description: 'Perfect for exploring the platform',
      features: [
        { text: 'Pre-calculated demo simulations', included: true },
        { text: '3D visualization (read-only)', included: true },
        { text: 'Scientific audit reports', included: true },
        { text: 'Custom simulations', included: false },
        { text: 'API access', included: false },
        { text: 'Priority support', included: false },
        { text: 'Data export', included: false },
      ],
      cta: 'Try Demo',
      ctaLink: '/demo',
      highlight: false,
    },
    {
      name: 'Professional',
      price: '$499',
      period: '/month',
      description: 'For engineering teams',
      features: [
        { text: 'Unlimited custom simulations', included: true },
        { text: '3D visualization (interactive)', included: true },
        { text: 'Scientific audit with certification', included: true },
        { text: 'Advanced parametric analysis', included: true },
        { text: 'REST API access', included: true },
        { text: 'Email support (24h)', included: true },
        { text: 'Data export (CSV, JSON)', included: true },
      ],
      cta: 'Start Free Trial',
      ctaLink: '/auth/signup?plan=professional',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large organizations',
      features: [
        { text: 'Everything in Professional', included: true },
        { text: 'Dedicated infrastructure', included: true },
        { text: 'Custom EOS models', included: true },
        { text: 'Priority API support', included: true },
        { text: 'Phone & email support (24/7)', included: true },
        { text: 'Custom integrations', included: true },
        { text: 'On-premise deployment option', included: true },
      ],
      cta: 'Contact Sales',
      ctaLink: '/contact?type=enterprise',
      highlight: false,
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
            Choose the plan that fits your needs. All plans include our core PINN simulation engine.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`rounded-2xl transition transform hover:scale-105 ${
                  plan.highlight
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-600 ring-2 ring-blue-400 scale-105 md:scale-110'
                    : 'bg-slate-800/50 border border-blue-500/20 hover:border-blue-500/50'
                }`}
              >
                <div className="p-8">
                  {plan.highlight && (
                    <div className="mb-4 inline-block px-3 py-1 rounded-full bg-white/20 text-sm font-semibold">
                      Most Popular
                    </div>
                  )}

                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-slate-300 text-sm mb-6">{plan.description}</p>

                  <div className="mb-6">
                    <div className="text-4xl font-bold">
                      {plan.price}
                      {plan.period && <span className="text-lg text-slate-300">{plan.period}</span>}
                    </div>
                  </div>

                  <Link
                    href={plan.ctaLink}
                    className={`w-full block text-center py-3 rounded-lg font-semibold mb-8 transition ${
                      plan.highlight
                        ? 'bg-white text-blue-600 hover:bg-slate-100'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {plan.cta}
                  </Link>

                  <div className="space-y-4">
                    {plan.features.map((feature, fidx) => (
                      <div key={fidx} className="flex items-start gap-3">
                        {feature.included ? (
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? 'text-slate-200' : 'text-slate-500'}>
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

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mb-12 text-center">Frequently Asked Questions</h2>

          <div className="space-y-6">
            {[
              {
                q: 'Can I change plans anytime?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.'
              },
              {
                q: 'Do you offer annual billing discounts?',
                a: 'Yes! Annual plans include 20% discount. Contact our sales team for details.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, wire transfers, and purchase orders for Enterprise plans.'
              },
              {
                q: 'Is there a free trial for Professional plan?',
                a: 'Yes, we offer a 14-day free trial with full access to Professional features.'
              },
              {
                q: 'What about data security?',
                a: 'All data is encrypted in transit and at rest. We comply with GDPR, SOC 2, and ISO 27001.'
              },
              {
                q: 'Do you offer API rate limits?',
                a: 'Demo: 10 req/min, Professional: 1000 req/min, Enterprise: Custom limits.'
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
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-slate-300 mb-8">
            Start with our free demo or begin your 14-day trial of the Professional plan.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demo" className="px-8 py-4 rounded-lg border border-blue-400 text-blue-400 hover:bg-blue-400/10 font-semibold transition">
              Try Demo
            </Link>
            <Link href="/auth/signup" className="px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold flex items-center justify-center gap-2 transition">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-blue-500/20 py-12 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-6xl mx-auto text-center text-slate-400 text-sm">
          <p>© 2026 Quantum-Hybrid PINN. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
