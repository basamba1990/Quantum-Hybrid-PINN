'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

interface PricingPlan {
  name: string;
  price: string;
  currency: string;
  billing_period: string;
  description: string;
  features: string[];
  checkout_link: string;
  highlighted?: boolean;
}

const plans: PricingPlan[] = [
  {
    name: 'Starter',
    price: '28',
    currency: '$',
    billing_period: '/mois',
    description: 'Accès complet à la plateforme de simulation Quantum-Hybrid-PINN',
    features: [
      'Simulations illimitées',
      'Modèles CFD + PINN avancés',
      'Support prioritaire par email',
      'Analyses et visualisations avancées',
      'Accès API',
      'Accélération GPU',
      'Export des résultats (CSV, PDF)',
    ],
    checkout_link: 'https://quantum-hybrid-pinn.lemonsqueezy.com/checkout/buy/starter',
    highlighted: true,
  }
];

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = (checkoutLink: string) => {
    setIsLoading(true);
    window.location.href = checkoutLink;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Tarification Simple et Transparente
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Débloquez toute la puissance de la simulation hybride quantique avec notre plan unique.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="flex justify-center mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className="relative flex flex-col w-full max-w-md border-2 border-blue-500 shadow-2xl shadow-blue-500/20 bg-slate-800/50 backdrop-blur"
            >
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Plan Recommandé
                </span>
              </div>

              <CardHeader>
                <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                <CardDescription className="text-slate-300">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-white">
                      {plan.currency}{plan.price}
                    </span>
                    <span className="text-slate-400 ml-2">{plan.billing_period}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Environ 17 000 CFA par mois</p>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleCheckout(plan.checkout_link)}
                  disabled={isLoading}
                  className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  S'abonner Maintenant
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-slate-800/30 backdrop-blur rounded-lg p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">Questions Fréquentes</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Comment fonctionne l'abonnement ?
              </h3>
              <p className="text-slate-300">
                Une fois abonné, vous aurez un accès illimité à toutes les fonctionnalités de simulation. Le paiement est récurrent chaque mois.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Puis-je annuler à tout moment ?
              </h3>
              <p className="text-slate-300">
                Oui, vous pouvez annuler votre abonnement à tout moment depuis votre tableau de bord. Vous garderez l'accès jusqu'à la fin de la période en cours.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Quels sont les moyens de paiement acceptés ?
              </h3>
              <p className="text-slate-300">
                Nous acceptons les cartes bancaires internationales via Lemon Squeezy, notre processeur de paiement sécurisé.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
