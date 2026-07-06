'use client'

import React, { useEffect } from 'react'

interface PaddleCheckoutProps {
  planId: string
  planName: string
  price: number
  email?: string
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
    const initPaddle = async () => {
      // Attendre que Paddle soit disponible sur window
      if (typeof window !== 'undefined' && window.Paddle) {
        try {
          let token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
          
          if (!token) {
            const response = await fetch('/api/admin/payment-config-public')
            const data = await response.json()
            token = data.paddle_client_token
          }

          if (token) {
            window.Paddle.Initialize({
              token: token,
              eventCallback: (event: any) => {
                if (event.name === 'checkout.completed') {
                  onSuccess?.()
                }
              }
            })
          }
        } catch (err) {
          console.error('Failed to initialize Paddle:', err)
        }
      }
    }

    initPaddle()
  }, [])

  const handleCheckout = async () => {
    try {
      if (!window.Paddle) {
        throw new Error('Paddle not loaded')
      }

      const checkoutConfig: any = {
        items: [
          {
            priceId: planId,
            quantity: 1,
          },
        ],
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
      }

      // Ajouter l'email si fourni
      if (email && email.trim()) {
        checkoutConfig.customer = {
          email,
        }
      }

      // Ouvrir le Paddle Checkout
      window.Paddle.Checkout.open(checkoutConfig)
    } catch (error) {
      console.error('Paddle checkout error:', error)
      onError?.(error instanceof Error ? error : new Error('Unknown error'))
    }
  }

  return (
    <button
      onClick={handleCheckout}
      className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-white transition flex items-center justify-center gap-2 mb-8"
    >
      Select {planName} - ${price}/month
    </button>
  )
}

// Extend Window type for Paddle
declare global {
  interface Window {
    Paddle?: any
  }
}
