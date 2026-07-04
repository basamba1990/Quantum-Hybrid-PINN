import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import crypto from 'crypto'

/**
 * Webhook pour traiter les notifications de paiement Paystack
 * POST /api/webhooks/paystack
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    // Vérifier la signature Paystack
    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      console.error('PAYSTACK_SECRET_KEY not configured')
      return NextResponse.json(
        { error: 'Configuration error' },
        { status: 500 }
      )
    }

    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      console.warn('Invalid Paystack signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = JSON.parse(body)

    // Vérifier que c'est un événement de paiement réussi
    if (event.event !== 'charge.success') {
      console.log('Ignoring event:', event.event)
      return NextResponse.json({ success: true })
    }

    const { data } = event
    const { reference, customer, metadata, amount, currency } = data

    // Vérifier que le paiement a bien été reçu
    if (data.status !== 'success') {
      console.log('Payment not successful:', data.status)
      return NextResponse.json({ success: false })
    }

    const supabase = createClient()

    // Récupérer les informations du paiement
    const userEmail = customer.email || metadata.user_email
    const plan = metadata.plan

    // Mettre à jour le profil utilisateur avec le nouvel abonnement
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .update({
        subscription: plan,
        subscription_status: 'active',
        subscription_start_date: new Date(),
        subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        last_payment_reference: reference,
      })
      .eq('email', userEmail)
      .select()

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
      amount: amount / 100, // Paystack retourne les montants en centimes
      currency,
      status: 'completed',
      payment_reference: reference,
      payment_method: 'paystack',
      metadata: {
        paystack_id: data.id,
        customer_name: customer.customer_code,
        authorization: data.authorization,
      },
    })

    // Envoyer un email de confirmation (optionnel)
    // await sendSubscriptionConfirmationEmail(userEmail, plan)

    console.log(`Subscription activated for ${userEmail} - Plan: ${plan}`)

    return NextResponse.json({
      success: true,
      message: 'Subscription activated',
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
