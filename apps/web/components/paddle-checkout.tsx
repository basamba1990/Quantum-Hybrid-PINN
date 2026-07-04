'use client'

import React, { useEffect } from 'react'

interface PaddleCheckoutProps {
  planId: string
  planName: string
  price: number
  email: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function PaddleCheckout({
  planId,
  planName,
  price,
  email,
  onSuccess,
  onError,
}: PaddleCheckoutProps) {
  useEffect(() => {
    // Charger le script Paddle
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.async = true
    document.body.appendChild(script)

    script.onload = () => {
      // Initialiser Paddle
      if (window.Paddle) {
        window.Paddle.Setup({
          token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '',
        })
      }
    }

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const handleCheckout = async () => {
    try {
      if (!window.Paddle) {
        throw new Error('Paddle not loaded')
      }

      // Ouvrir le Paddle Checkout
      window.Paddle.Checkout.open({
        items: [
          {
            priceId: planId,
            quantity: 1,
          },
        ],
        customer: {
          email,
        },
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          locale: 'fr',
        },
        onCheckoutClose: () => {
          console.log('Checkout closed')
        },
        onCheckoutComplete: (data: any) => {
          console.log('Checkout completed:', data)
          onSuccess?.()
        },
      })
    } catch (error) {
      console.error('Paddle checkout error:', error)
      onError?.(error instanceof Error ? error : new Error('Unknown error'))
    }
  }

  return (
    <button
      onClick={handleCheckout}
      className="px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-white transition"
    >
      Start Free Trial - ${price}/month
    </button>
  )
}

// Extend Window type for Paddle
declare global {
  interface Window {
    Paddle?: any
  }
}
