import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route pour initier un paiement Paystack
 * POST /api/payment/initiate
 * 
 * Body:
 * {
 *   plan: 'researcher' | 'professional' | 'enterprise',
 *   email: string,
 *   name: string,
 * }
 */

const PLAN_PRICES: Record<string, { amount: number; currency: string; description: string }> = {
  researcher: { amount: 9900, currency: 'NGN', description: 'Researcher Plan - Monthly' }, // $99 en NGN (approximatif)
  professional: { amount: 49900, currency: 'NGN', description: 'Professional Plan - Monthly' }, // $499 en NGN
  enterprise: { amount: 150000, currency: 'NGN', description: 'Enterprise Plan - Monthly' }, // $1500 en NGN
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan, email, name } = body

    // Valider les données
    if (!plan || !email || !name) {
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

    // Récupérer la clé secrète Paystack
    const secretKey = process.env.PAYSTACK_SECRET_KEY

    if (!secretKey) {
      return NextResponse.json(
        { error: 'Payment configuration not set up' },
        { status: 500 }
      )
    }

    const planInfo = PLAN_PRICES[plan]
    const reference = `QHP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Préparer le payload pour Paystack
    const payload = {
      email,
      amount: planInfo.amount, // Paystack utilise les centimes (ou l'unité minimale)
      reference,
      metadata: {
        plan,
        user_name: name,
        user_email: email,
      },
    }

    // Appeler l'API Paystack pour initialiser le paiement
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok || !data.status) {
      console.error('Paystack error:', data)
      return NextResponse.json(
        { error: 'Failed to initiate payment', details: data.message },
        { status: 500 }
      )
    }

    // Retourner l'URL de paiement
    return NextResponse.json({
      success: true,
      payment_link: data.data.authorization_url,
      access_code: data.data.access_code,
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
