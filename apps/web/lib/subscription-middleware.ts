import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface SubscriptionStatus {
  isActive: boolean;
  plan: 'free' | 'researcher' | 'professional' | 'enterprise';
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
      // ✅ CORRECTIF V8.3 : Les nouveaux utilisateurs n'ont pas d'accès actif par défaut
      return {
        isActive: false,
        plan: 'free',
        status: 'free',
      };
    }

    // ✅ CORRECTIF V8.3 : Vérification stricte du statut actif
    const isActive = data.status === 'active' || data.status === 'trialing';
    
    return {
      isActive: isActive,
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
  requiredPlan: 'free' | 'researcher' | 'professional' | 'enterprise' = 'free'
): Promise<boolean> {
  const subscription = await checkSubscription(userEmail);

  if (!subscription.isActive) {
    return requiredPlan === 'free';
  }

  // Hierarchy: enterprise > professional > researcher > free
  const planWeights = {
    free: 0,
    researcher: 1,
    professional: 2,
    enterprise: 3
  };

  return planWeights[subscription.plan] >= planWeights[requiredPlan];
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
      free: { used: 0, limit: 1 }, // 1 demo simulation
      researcher: { used: 0, limit: 10 },
      professional: { used: 0, limit: -1 }, // Unlimited
      enterprise: { used: 0, limit: -1 }, // Unlimited
    };

    return quotas[subscription.plan] || quotas.free;
  } catch (error) {
    console.error('Error getting simulation quota:', error);
    return { used: 0, limit: 0 };
  }
}
