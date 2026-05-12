'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

export default function SubscriptionDashboardPage() {
  const { subscription, loading, isActive } = useSubscription();
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortalUrl = async () => {
      try {
        const response = await fetch('/api/subscriptions/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: 'user@example.com' }), // Replace with actual user email
        });

        if (response.ok) {
          const data = await response.json();
          setPortalUrl(data.portalUrl);
        }
      } catch (error) {
        console.error('Failed to fetch portal URL:', error);
      }
    };

    if (isActive) {
      fetchPortalUrl();
    }
  }, [isActive]);

  const getStatusIcon = () => {
    switch (subscription.status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'past_due':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
      case 'expired':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusColor = () => {
    switch (subscription.status) {
      case 'active':
        return 'bg-green-500/20 text-green-300';
      case 'past_due':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'cancelled':
      case 'expired':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-slate-500/20 text-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-700 rounded w-1/3"></div>
            <div className="h-32 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Subscription Management</h1>

        {/* Subscription Status Card */}
        <Card className="border-slate-700 bg-slate-800/50 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              Subscription Status
            </CardTitle>
            <CardDescription>Manage your subscription and billing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">Current Plan</p>
                <p className="text-lg font-semibold text-white capitalize">
                  {subscription.plan === 'free' ? 'Free' : subscription.plan}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Status</p>
                <Badge className={getStatusColor()}>
                  {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </Badge>
              </div>
            </div>

            {subscription.plan === 'free' && (
              <div className="pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-300 mb-4">
                  Upgrade to a paid plan to unlock advanced features and unlimited simulations.
                </p>
                <Button asChild>
                  <a href="/pricing">View Plans</a>
                </Button>
              </div>
            )}

            {isActive && portalUrl && (
              <div className="pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-300 mb-4">
                  Manage your billing, payment methods, and subscription settings.
                </p>
                <Button asChild variant="outline">
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                    Open Billing Portal
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>Your simulation usage this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Simulations Run</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Compute Time (hours)</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Storage Used</p>
                <p className="text-2xl font-bold text-white">0 MB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
