import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const lemonSqueezyApiKey = process.env.LEMON_SQUEEZY_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { userEmail } = await req.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    // Get subscription info from Supabase
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('lemon_subscription_id')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    // Get customer portal URL from Lemon Squeezy
    // Note: This assumes you have a way to retrieve the customer portal URL
    // You may need to use the Lemon Squeezy API to fetch this
    const response = await fetch('https://api.lemonsqueezy.com/v1/customers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lemonSqueezyApiKey}`,
        'Accept': 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch customer portal' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    // Return portal URL (you'll need to construct this based on Lemon Squeezy's API)
    return NextResponse.json({
      portalUrl: `https://quantum-hybrid-pinn.lemonsqueezy.com/customer-portal`,
    });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
