import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

/**
 * Webhook pour traiter les notifications de paiement Paddle
 * POST /api/webhooks/paddle
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('paddle-signature')

    // Vérifier la signature Paddle
    const secretKey = process.env.PADDLE_WEBHOOK_SECRET
    if (!secretKey) {
      console.error('PADDLE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Configuration error' },
        { status: 500 }
      )
    }

    // Paddle utilise une signature HMAC-SHA256
    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      console.warn('Invalid Paddle signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = JSON.parse(body)

    // Traiter les événements de paiement réussi
    if (event.type === 'subscription.created' || event.type === 'subscription.updated') {
      const { data } = event

      const supabase = await createClient()

      // Récupérer les informations du client
      const { customer_id, items, custom_data } = data
      const userEmail = custom_data?.email || data.customer?.email

      if (!userEmail) {
        console.error('No email found in Paddle event')
        return NextResponse.json({ error: 'No email found' }, { status: 400 })
      }

      // Déterminer le plan basé sur le prix
      let plan = 'professional'
      const priceId = items[0]?.price_id

      if (priceId?.includes('researcher')) {
        plan = 'researcher'
      } else if (priceId?.includes('enterprise')) {
        plan = 'enterprise'
      }

      // Mettre à jour le profil utilisateur avec le nouvel abonnement
      const { error: userError } = await supabase
        .from('profiles')
        .update({
          subscription: plan,
          subscription_status: 'active',
          subscription_start_date: new Date(),
          subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
          last_payment_reference: data.id,
        })
        .eq('email', userEmail)

      if (userError) {
        console.error('Error updating user subscription:', userError)
        return NextResponse.json(
          { error: 'Failed to update subscription' },
          { status: 500 }
        )
      }

      // Enregistrer la transaction
      await supabase.from('transactions').insert({
        user_email: userEmail,
        plan,
        amount: items[0]?.price?.amount / 100, // Paddle retourne les montants en centimes
        currency: items[0]?.price?.currency_code || 'USD',
        status: 'completed',
        payment_reference: data.id,
        payment_method: 'paddle',
        metadata: {
          paddle_subscription_id: data.id,
          paddle_customer_id: customer_id,
          items: items,
        },
      })

      console.log(`Subscription activated for ${userEmail} - Plan: ${plan}`)

      return NextResponse.json({
        success: true,
        message: 'Subscription activated',
      })
    }

    // Ignorer les autres événements
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
