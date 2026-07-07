import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. IGNORER TOUT CE QUI N'EST PAS UNE PAGE (Statique, API interne, etc.)
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // ✅ ÉTAPE 4 : Vérifier si c'est l'administrateur développeur (accès illimité)
  const adminEmail = 'basamba1990@yahoo.fr'
  const userEmail = request.cookies.get('user_email')?.value

  // Initialiser la réponse
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Si pas de config, on laisse passer mais on ajoute un header de diagnostic
  if (!supabaseUrl || !supabaseAnonKey) {
    response.headers.set('x-auth-status', 'missing-env-vars')
    return response
  }

  try {
    // ✅ ÉTAPE 4 : Si c'est l'admin, lui donner accès complet (via cookie)
    if (userEmail === adminEmail) {
      return NextResponse.next()
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Vérification légère de l'utilisateur
    const { data: { user } } = await supabase.auth.getUser()

    // ✅ CORRECTIF V8.2 : Bypass admin par email de session (Sécurité renforcée)
    if (user?.email === adminEmail) {
      return NextResponse.next()
    }

    // 2. LOGIQUE DE REDIRECTION SIMPLIFIÉE
    const isDashboard = pathname.startsWith('/dashboard')
    const isLoginPage = pathname === '/auth/login' || pathname === '/login'

    // Redirection /login -> /auth/login pour éviter le 404
    if (pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    if (!user && isDashboard) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      // Ajouter l'URL de redirection pour revenir au dashboard après login
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // ✅ CORRECTION V8.1 : Vérifier le rôle de l'utilisateur pour les routes Premium
    if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/simulations'))) {
      // ✅ CORRECTIF V8.3 : Vérifier l'admin EN PREMIER avant de vérifier l'abonnement
      if (user.email === adminEmail || userEmail === adminEmail) {
        return NextResponse.next()
      }
      
      const userRole = user.user_metadata?.role || 'free'
      const subscription = user.user_metadata?.subscription || 'free'

      // Rediriger vers pricing si l'utilisateur n'a pas d'abonnement actif (free ou demo)
      if (subscription === 'free' || subscription === 'demo' || userRole === 'free') {
         const url = request.nextUrl.clone()
         url.pathname = '/pricing'
         url.searchParams.set('upgrade_required', 'true')
         return NextResponse.redirect(url)
      }
    }

    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      // Rediriger vers la page demandée initialement ou le dashboard
      const next = request.nextUrl.searchParams.get('next') || '/dashboard'
      
      // ✅ CORRECTION V8.1 : Vérifier si l'utilisateur a accès au dashboard
      const userRole = user.user_metadata?.role || 'free'
      const subscription = user.user_metadata?.subscription || 'demo'
      
      if ((subscription === 'demo' || userRole === 'free') && next === '/dashboard') {
        // Rediriger vers la page de démo gratuite au lieu du dashboard
        url.pathname = '/demo'
      } else {
        url.pathname = next
      }
      
      url.searchParams.delete('next')
      return NextResponse.redirect(url)
    }
  } catch (e) {
    // En cas d'erreur dans le middleware, on laisse passer la requête
    // pour éviter de bloquer l'utilisateur avec un 403/500
    console.error('Middleware error:', e)
    // ✅ CORRECTION V8.1 : Log détaillé pour le diagnostic
    console.error('Middleware diagnostic:', {
      pathname,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.next()
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
