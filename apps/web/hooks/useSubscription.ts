import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

interface SubscriptionData {
  status: 'free' | 'active' | 'past_due' | 'cancelled' | 'expired';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  subscription_id?: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    status: 'free',
    plan: 'free',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userEmail = user?.email;
    if (!userEmail) {
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/subscriptions/check?email=${encodeURIComponent(userEmail)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }

        const data = await response.json();
        setSubscription(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setSubscription({
          status: 'free',
          plan: 'free',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user?.email]);

  const isActive = subscription.status === 'active';
  const isPro = subscription.plan === 'pro' || subscription.plan === 'enterprise';
  const isStarter = subscription.plan === 'starter';

  return {
    subscription,
    loading,
    error,
    isActive,
    isPro,
    isStarter,
  };
}
