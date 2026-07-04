import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Webhook pour traiter les notifications de paiement Flutterwave
 * POST /api/webhooks/flutterwave
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data, status } = body

    // Vérifier la signature Flutterwave (optionnel mais recommandé)
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH
    const signature = request.headers.get('verif-hash')

    if (secretHash && signature !== secretHash) {
      console.warn('Invalid Flutterwave signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Vérifier le statut du paiement
    if (status !== 'success') {
      console.log('Payment failed:', data)
      return NextResponse.json({ success: false })
    }

    const supabase = createClient()

    // Récupérer les informations du paiement
    const { tx_ref, amount, currency, customer, meta } = data
    const userEmail = customer.email || meta.user_email
    const plan = meta.plan

    // Vérifier que le paiement a bien été reçu
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY
    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${data.id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    )

    const verifyData = await verifyResponse.json()

    if (verifyData.status !== 'success' || verifyData.data.status !== 'successful') {
      console.error('Payment verification failed:', verifyData)
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      )
    }

    // Mettre à jour le profil utilisateur avec le nouvel abonnement
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .update({
        subscription: plan,
        subscription_status: 'active',
        subscription_start_date: new Date(),
        subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        last_payment_reference: tx_ref,
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
      amount,
      currency,
      status: 'completed',
      payment_reference: tx_ref,
      payment_method: 'flutterwave',
      metadata: {
        flutterwave_id: data.id,
        customer_name: customer.name,
        phone: customer.phone_number,
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
