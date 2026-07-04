'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

/**
 * Hook pour vérifier si l'utilisateur est administrateur
 * L'administrateur a accès illimité à toutes les fonctionnalités
 */
export function useAdmin() {
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [adminEmail] = useState('basamba1990@yahoo.fr')

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user?.email === adminEmail) {
          setIsAdmin(true)
          // Mettre à jour le cookie pour le middleware
          document.cookie = `user_email=${user.email}; path=/; max-age=86400`
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdmin()
  }, [supabase, adminEmail])

  return { isAdmin, isLoading, adminEmail }
}

/**
 * Hook pour vérifier le statut d'abonnement
 */
export function useSubscription() {
  const supabase = createClient()
  const [subscription, setSubscription] = useState<'demo' | 'professional' | 'enterprise'>('demo')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const userSubscription = user.user_metadata?.subscription || 'demo'
          setSubscription(userSubscription)
        } else {
          setSubscription('demo')
        }
      } catch (error) {
        console.error('Error checking subscription:', error)
        setSubscription('demo')
      } finally {
        setIsLoading(false)
      }
    }

    checkSubscription()
  }, [supabase])

  return { subscription, isLoading }
}

/**
 * Hook pour vérifier l'accès aux fonctionnalités premium
 */
export function usePremiumAccess() {
  const { isAdmin } = useAdmin()
  const { subscription } = useSubscription()

  const hasAccess = isAdmin || subscription === 'professional' || subscription === 'enterprise'
  const isPremium = subscription === 'professional' || subscription === 'enterprise'
  const isEnterprise = subscription === 'enterprise'

  return { hasAccess, isPremium, isEnterprise, isAdmin }
}
