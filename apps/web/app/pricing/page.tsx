'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

interface PricingPlan {
  name: string;
  price: number;
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
    price: 29,
    currency: 'USD',
    billing_period: '/month',
    description: 'Perfect for getting started with quantum-hybrid simulations',
    features: [
      'Up to 10 simulations/month',
      'Basic CFD + PINN models',
      'Community support',
      'Email support',
      'Basic analytics',
      'Export results (CSV, PDF)',
    ],
    checkout_link: 'https://quantum-hybrid-pinn.lemonsqueezy.com/checkout/buy/starter',
  },
  {
    name: 'Pro',
    price: 99,
    currency: 'USD',
    billing_period: '/month',
    description: 'For professional researchers and engineers',
    features: [
      'Unlimited simulations',
      'Advanced CFD + PINN models',
      'Priority email support',
      'Advanced analytics & visualization',
      'Custom model training',
      'API access',
      'Batch processing',
      'GPU acceleration',
    ],
    checkout_link: 'https://quantum-hybrid-pinn.lemonsqueezy.com/checkout/buy/pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 0,
    currency: 'USD',
    billing_period: 'Custom',
    description: 'For large-scale deployments and custom needs',
    features: [
      'Everything in Pro',
      'Dedicated support',
      'Custom integrations',
      'On-premise deployment',
      'SLA guarantee',
      'Custom model development',
      'Advanced security features',
      'Unlimited API calls',
    ],
    checkout_link: '#contact',
  },
];

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = (checkoutLink: string) => {
    if (checkoutLink === '#contact') {
      // Redirect to contact form
      window.location.href = '/contact';
      return;
    }

    setIsLoading(true);
    window.location.href = checkoutLink;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Choose the perfect plan for your quantum-hybrid simulation needs. All plans include access to our core features.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.highlighted
                  ? 'border-2 border-blue-500 shadow-2xl shadow-blue-500/20'
                  : 'border border-slate-700'
              } bg-slate-800/50 backdrop-blur`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                <CardDescription className="text-slate-300">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                {/* Price */}
                <div className="mb-6">
                  {plan.price > 0 ? (
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-white">
                        ${plan.price}
                      </span>
                      <span className="text-slate-400 ml-2">{plan.billing_period}</span>
                    </div>
                  ) : (
                    <div className="text-2xl font-semibold text-slate-300">
                      Custom Pricing
                    </div>
                  )}
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
                  className={`w-full py-2 ${
                    plan.highlighted
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-slate-800/30 backdrop-blur rounded-lg p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I change my plan anytime?
              </h3>
              <p className="text-slate-300">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Is there a free trial?
              </h3>
              <p className="text-slate-300">
                Yes, we offer a 14-day free trial for all paid plans. No credit card required.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-slate-300">
                We accept all major credit cards (Visa, Mastercard, American Express) and other payment methods through our payment processor.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-slate-300">
                We offer a 30-day money-back guarantee if you're not satisfied with your subscription.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
