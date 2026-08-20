'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'free' | 'professional' | 'enterprise' | 'admin'
  requiredSubscription?: 'demo' | 'professional' | 'enterprise'
  fallbackUrl?: string
}

/**
 * Composant de protection des routes
 * Vérifie l'authentification et le rôle de l'utilisateur
 */
export function ProtectedRoute({
  children,
  requiredRole = 'free',
  requiredSubscription = 'demo',
  fallbackUrl = '/pricing',
}: ProtectedRouteProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/login')
          return
        }

        // ✅ CORRECTIF V8.2 : Bypass admin par email (comme dans le middleware)
        const adminEmail = 'basamba1990@yahoo.fr'
        if (user.email === adminEmail) {
          setIsAuthorized(true)
          setIsLoading(false)
          return
        }

        // Récupérer le rôle et l'abonnement de l'utilisateur
        const userRole = user.user_metadata?.role || 'free'
        const subscription = user.user_metadata?.subscription || 'demo'

        // Vérifier les permissions
        const roleHierarchy = { free: 0, professional: 1, enterprise: 2, admin: 3 }
        const subscriptionHierarchy = { demo: 0, professional: 1, enterprise: 2 }

        const userRoleLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0
        const requiredRoleLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0

        const userSubLevel = subscriptionHierarchy[subscription as keyof typeof subscriptionHierarchy] || 0
        const requiredSubLevel = subscriptionHierarchy[requiredSubscription as keyof typeof subscriptionHierarchy] || 0

        if (userRoleLevel >= requiredRoleLevel && userSubLevel >= requiredSubLevel) {
          setIsAuthorized(true)
        } else {
          router.push(fallbackUrl)
        }
      } catch (error) {
        console.error('Error checking access:', error)
        router.push('/auth/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [router, supabase, requiredRole, requiredSubscription, fallbackUrl])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">
          <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}

export default ProtectedRoute
