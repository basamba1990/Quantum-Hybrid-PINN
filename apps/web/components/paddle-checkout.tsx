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
      if (typeof window !== 'undefined') {
        // ✅ CORRECTIF V8.3 : Vérification plus robuste de l'objet Paddle
        const checkPaddle = setInterval(async () => {
          if (window.Paddle) {
            clearInterval(checkPaddle);
            try {
              let token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || 'live_ce999e230ab010638729f5f28bf';
              
              if (token) {
                console.log('Initializing Paddle with token:', token.substring(0, 10) + '...');
                window.Paddle.Initialize({
                  token: token,
                  eventCallback: (event: any) => {
                    console.log('Paddle Event:', event.name, event);
                    if (event.name === 'checkout.completed' || event.name === 'transaction.completed') {
                      onSuccess?.()
                    }
                  }
                });
              }
            } catch (err) {
              console.error('Failed to initialize Paddle:', err);
            }
          }
        }, 500);
        
        // Timeout après 10s
        setTimeout(() => clearInterval(checkPaddle), 10000);
      }
    }

    initPaddle()
  }, [])

  const handleCheckout = async () => {
    try {
      if (!window.Paddle) {
        throw new Error('Paddle not loaded')
      }

      // ✅ CORRECTIF V8.2 : Fallback sur les IDs de prix fournis par l'utilisateur
      let finalPriceId = planId;
      if (!finalPriceId || finalPriceId === 'undefined') {
        if (planName === 'Researcher') finalPriceId = 'pri_01kws7mnzam0jvm7aha7s7txj3';
        else if (planName === 'Professional') finalPriceId = 'pri_01kws7wp26ngs9vf08wg7w2ny7';
        else if (planName === 'Enterprise') finalPriceId = 'pri_01kws84eg5bpffg4m6r2pm85fv';
      }

      const checkoutConfig: any = {
        items: [
          {
            priceId: finalPriceId,
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

      // ✅ CORRECTIF V8.3 : S'assurer que l'email est passé
      if (email && email.trim()) {
        checkoutConfig.customer = {
          email: email.trim(),
        }
      } else {
        console.warn('Paddle: No user email provided for checkout tracking');
      }

      // Ouvrir le Paddle Checkout
      window.Paddle.Checkout.open(checkoutConfig)
    } catch (error) {
      console.error('Paddle checkout error:', error)
      alert('Erreur de paiement : ' + (error instanceof Error ? error.message : String(error)))
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
