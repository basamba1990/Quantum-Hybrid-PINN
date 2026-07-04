import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route pour initier un paiement Flutterwave
 * POST /api/payment/initiate
 * 
 * Body:
 * {
 *   plan: 'researcher' | 'professional' | 'enterprise',
 *   email: string,
 *   name: string,
 *   phone: string,
 * }
 */

const PLAN_PRICES: Record<string, { amount: number; currency: string; description: string }> = {
  researcher: { amount: 99, currency: 'USD', description: 'Researcher Plan - Monthly' },
  professional: { amount: 499, currency: 'USD', description: 'Professional Plan - Monthly' },
  enterprise: { amount: 1500, currency: 'USD', description: 'Enterprise Plan - Monthly' },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan, email, name, phone } = body

    // Valider les données
    if (!plan || !email || !name || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!PLAN_PRICES[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      )
    }

    // Récupérer les clés Flutterwave depuis les variables d'environnement
    const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY

    if (!publicKey || !secretKey) {
      return NextResponse.json(
        { error: 'Payment configuration not set up' },
        { status: 500 }
      )
    }

    const planInfo = PLAN_PRICES[plan]
    const reference = `QHP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Préparer le payload pour Flutterwave
    const payload = {
      tx_ref: reference,
      amount: planInfo.amount,
      currency: planInfo.currency,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
      customer: {
        email,
        name,
        phone_number: phone,
      },
      customizations: {
        title: 'Quantum-Hybrid PINN',
        description: planInfo.description,
        logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
      meta: {
        plan,
        user_email: email,
      },
    }

    // Appeler l'API Flutterwave pour initialiser le paiement
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Flutterwave error:', data)
      return NextResponse.json(
        { error: 'Failed to initiate payment' },
        { status: 500 }
      )
    }

    // Retourner l'URL de paiement
    return NextResponse.json({
      success: true,
      payment_link: data.data.link,
      reference,
    })
  } catch (error) {
    console.error('Payment initiation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
