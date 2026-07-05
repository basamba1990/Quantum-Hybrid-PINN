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
      description: 'Pour les chercheurs indépendants et consultants',
      features: [
        { text: 'Jusqu\'à 10 simulations personnalisées/mois', included: true },
        { text: 'Visualisation 3D interactive', included: true },
        { text: 'Rapports d\'audit scientifique', included: true },
        { text: 'Analyse paramétrique de base', included: true },
        { text: 'Accès API REST (100 req/jour)', included: true },
        { text: 'Support email (réponse 48h)', included: true },
        { text: 'Export de données (CSV uniquement)', included: true },
        { text: 'Analyse paramétrique avancée', included: false },
        { text: 'Modèles EOS personnalisés', included: false },
        { text: 'Support prioritaire', included: false },
      ],
      highlight: false,
      badge: null,
    },
    {
      name: 'Professional',
      price: '$499',
      period: '/month',
      description: 'Pour les équipes d\'ingénierie et départements R&D',
      features: [
        { text: 'Simulations personnalisées illimitées', included: true },
        { text: 'Visualisation 3D interactive', included: true },
        { text: 'Audit scientifique avec certification', included: true },
        { text: 'Analyse paramétrique avancée', included: true },
        { text: 'Accès API REST (10k req/jour)', included: true },
        { text: 'Support email (réponse 24h)', included: true },
        { text: 'Export de données (CSV, JSON, Excel)', included: true },
        { text: 'Traitement par lots (jusqu\'à 100 jobs)', included: true },
        { text: 'Modèles EOS personnalisés', included: false },
        { text: 'Support téléphonique', included: false },
      ],
      highlight: true,
      badge: 'Plus Populaire',
    },
    {
      name: 'Enterprise',
      price: '$2,499',
      period: '/month',
      description: 'Pour les grandes organisations et multinationales',
      features: [
        { text: 'Tout ce qui est dans Professional', included: true },
        { text: 'Requêtes API illimitées', included: true },
        { text: 'Infrastructure dédiée', included: true },
        { text: 'Modèles EOS personnalisés & validation', included: true },
        { text: 'Support 24/7 téléphone & email', included: true },
        { text: 'Intégrations personnalisées (SAP, ANSYS)', included: true },
        { text: 'Option de déploiement sur site', included: true },
        { text: 'Sécurité avancée & conformité', included: true },
        { text: 'Garantie SLA (99.9% disponibilité)', included: true },
        { text: 'Gestionnaire de compte dédié', included: true },
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
            <Link href="/" className="hover:text-blue-400 transition">Retour à l'accueil</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Tarification Simple et
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent"> Transparente</span>
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Sélectionnez le plan adapté à vos besoins industriels. Tous nos plans incluent le moteur de simulation PINN V8.1.
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
          <h2 className="text-4xl font-bold mb-12 text-center">Questions Fréquentes</h2>
          <div className="space-y-6">
            {[
              {
                q: 'Puis-je changer de plan à tout moment ?',
                a: 'Oui, vous pouvez passer à un plan supérieur ou inférieur à tout moment. Les modifications prennent effet immédiatement.'
              },
              {
                q: 'Quels modes de paiement acceptez-vous ?',
                a: 'Nous acceptons les cartes bancaires (Visa, Mastercard), PayPal et Apple Pay via Paddle.'
              },
              {
                q: 'Comment fonctionne la facturation ?',
                a: 'La facturation est mensuelle par défaut. Les plans annuels bénéficient d\'une réduction de 20%.'
              },
              {
                q: 'Mes données sont-elles sécurisées ?',
                a: 'Toutes les données sont cryptées au repos et en transit. Nous respectons les normes RGPD et ISO 27001.'
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
          <h2 className="text-4xl font-bold mb-4">Prêt à commencer ?</h2>
          <p className="text-blue-100 mb-8">
            Rejoignez les équipes d'ingénierie qui transforment leurs flux de simulation avec Quantum-Hybrid PINN.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demo" className="px-8 py-4 rounded-lg border border-white text-white hover:bg-white/10 font-semibold transition flex items-center justify-center gap-2">
              <Zap className="w-5 h-5" />
              Essayer la Démo
            </Link>
            <a href="#plans" className="px-8 py-4 rounded-lg bg-white text-blue-600 font-semibold hover:bg-slate-100 transition flex items-center justify-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Sélectionner un Plan
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-blue-500/20 py-12 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-6xl mx-auto text-center text-slate-400 text-sm">
          <p>© 2026 Quantum-Hybrid PINN. Tous droits réservés. Paiements sécurisés via Paddle.</p>
        </div>
      </footer>
    </div>
  )
}
