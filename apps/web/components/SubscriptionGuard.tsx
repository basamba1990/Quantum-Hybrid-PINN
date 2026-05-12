'use client';

import { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
  requiredPlan?: 'starter' | 'pro' | 'enterprise';
  fallback?: ReactNode;
}

export function SubscriptionGuard({
  children,
  requiredPlan = 'starter',
  fallback,
}: SubscriptionGuardProps) {
  const { subscription, loading, isActive, isPro } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check if user has required subscription level
  const hasAccess =
    isActive &&
    (requiredPlan === 'starter' ||
      (requiredPlan === 'pro' && isPro) ||
      (requiredPlan === 'enterprise' && subscription.plan === 'enterprise'));

  if (!hasAccess) {
    return (
      fallback || (
        <Card className="border-amber-500/50 bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Subscription Required
            </CardTitle>
            <CardDescription>
              This feature requires an active subscription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 mb-4">
              Upgrade your plan to access this feature and unlock advanced capabilities.
            </p>
            <Button asChild>
              <a href="/pricing">View Plans</a>
            </Button>
          </CardContent>
        </Card>
      )
    );
  }

  return <>{children}</>;
}
