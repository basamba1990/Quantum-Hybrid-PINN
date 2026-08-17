import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

function getRuntimeConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhookSecret = process.env.LEMON_WEBHOOK_SECRET;

  if (!supabaseUrl || !supabaseServiceKey || !webhookSecret) {
    return null;
  }

  return { supabaseUrl, supabaseServiceKey, webhookSecret };
}

interface LemonSqueezyWebhookPayload {
  event_name: string;
  data: {
    id: string;
    type: string;
    attributes: {
      user_email: string;
      status: string;
      product_id?: string;
      variant_id?: string;
      [key: string]: any;
    };
  };
}

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(signature, 'utf8');
  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(req: Request) {
  try {
    const config = getRuntimeConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Lemon Squeezy webhook is not configured' },
        { status: 503 }
      );
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    const payload = await req.text();
    const signature = req.headers.get('x-signature');

    if (!signature || !verifyWebhookSignature(payload, signature, config.webhookSecret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event: LemonSqueezyWebhookPayload = JSON.parse(payload);

    switch (event.event_name) {
      case 'subscription_created': {
        const { user_email, status } = event.data.attributes;
        const lemon_subscription_id = event.data.id;
        
        // Extract plan from product/variant info
        const plan = event.data.attributes.variant_id || 'starter';

        await supabase.from('subscriptions').insert({
          user_email,
          lemon_subscription_id,
          status,
          plan,
        });

        break;
      }

      case 'subscription_updated': {
        const { user_email, status } = event.data.attributes;
        const lemon_subscription_id = event.data.id;

        await supabase
          .from('subscriptions')
          .update({ status })
          .eq('lemon_subscription_id', lemon_subscription_id);

        break;
      }

      case 'subscription_cancelled': {
        const lemon_subscription_id = event.data.id;

        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('lemon_subscription_id', lemon_subscription_id);

        break;
      }

      case 'subscription_expired': {
        const lemon_subscription_id = event.data.id;

        await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('lemon_subscription_id', lemon_subscription_id);

        break;
      }

      case 'order_created': {
        // Handle one-time purchases if needed
        break;
      }

      default:
        console.log(`Unhandled event: ${event.event_name}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
