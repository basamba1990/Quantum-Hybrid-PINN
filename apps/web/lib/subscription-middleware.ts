import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface SubscriptionStatus {
  isActive: boolean;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'free' | 'active' | 'past_due' | 'cancelled' | 'expired';
}

export async function checkSubscription(
  userEmail: string
): Promise<SubscriptionStatus> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        isActive: false,
        plan: 'free',
        status: 'free',
      };
    }

    return {
      isActive: data.status === 'active',
      plan: data.plan || 'free',
      status: data.status,
    };
  } catch (error) {
    console.error('Subscription check error:', error);
    return {
      isActive: false,
      plan: 'free',
      status: 'free',
    };
  }
}

export async function verifySubscriptionAccess(
  userEmail: string,
  requiredPlan: 'free' | 'starter' | 'pro' | 'enterprise' = 'free'
): Promise<boolean> {
  const subscription = await checkSubscription(userEmail);

  if (!subscription.isActive) {
    return requiredPlan === 'free';
  }

    // Since we only have the Starter plan now, any active subscription grants access
    return subscription.plan === 'starter';
}

export async function incrementSimulationCount(
  userEmail: string
): Promise<void> {
  try {
    // This would be implemented based on your usage tracking schema
    // For now, we'll just log it
    console.log(`Simulation count incremented for ${userEmail}`);
  } catch (error) {
    console.error('Error incrementing simulation count:', error);
  }
}

export async function getSimulationQuota(
  userEmail: string
): Promise<{ used: number; limit: number }> {
  try {
    const subscription = await checkSubscription(userEmail);

    const quotas = {
      free: { used: 0, limit: 0 },
      starter: { used: 0, limit: -1 }, // Unlimited for Starter plan
    };

    return quotas[subscription.plan as 'free' | 'starter'] || quotas.free;
  } catch (error) {
    console.error('Error getting simulation quota:', error);
    return { used: 0, limit: 0 };
  }
}
