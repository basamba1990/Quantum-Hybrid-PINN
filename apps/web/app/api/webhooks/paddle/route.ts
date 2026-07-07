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
    let secretKey = process.env.PADDLE_WEBHOOK_SECRET
    
    // ✅ CORRECTIF V8.2 : Fallback sur le secret fourni par l'utilisateur
    if (!secretKey || secretKey === 'undefined') {
      secretKey = 'pdl_ntfset_01kws492x6qb9f0c42xt8tep8b_wnAaaK5Drp1W1QlmjGYZVsrmYlw0zYBX'
    }

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
      let plan = 'researcher' // Par défaut
      const priceId = items[0]?.price_id

      const researcherPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_RESEARCHER || 'pri_01kws7mnzam0jvm7aha7s7txj3'
      const professionalPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PROFESSIONAL || 'pri_01kws7wp26ngs9vf08wg7w2ny7'
      const enterprisePriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_ENTERPRISE || 'pri_01kws84eg5bpffg4m6r2pm85fv'

      // Log for debugging (only in development or secure logs)
      console.log('Webhook Price ID received:', priceId);

      if (priceId === researcherPriceId) {
        plan = 'researcher'
      } else if (priceId === professionalPriceId) {
        plan = 'professional'
      } else if (priceId === enterprisePriceId) {
        plan = 'enterprise'
      } else {
        // Fallback checks for safety
        if (priceId?.toLowerCase().includes('researcher')) plan = 'researcher'
        else if (priceId?.toLowerCase().includes('professional')) plan = 'professional'
        else if (priceId?.toLowerCase().includes('enterprise')) plan = 'enterprise'
      }

      // Mettre à jour l'utilisateur dans la table users
      const { error: dbError } = await supabase
        .from('users')
        .update({
          role: plan === 'enterprise' ? 'admin' : 'user',
          updated_at: new Date()
        })
        .eq('email', userEmail)

      if (dbError) {
        console.error('Error updating users table:', dbError)
        return NextResponse.json(
          { error: 'Failed to update user role' },
          { status: 500 }
        )
      }

      // Enregistrer dans la table subscriptions (LemonSqueezy legacy ou Paddle)
      await supabase.from('subscriptions').insert({
        user_email: userEmail,
        lemon_subscription_id: data.id, // On réutilise cette colonne pour stocker l'ID Paddle
        status: 'active',
        plan: plan,
        created_at: new Date()
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
