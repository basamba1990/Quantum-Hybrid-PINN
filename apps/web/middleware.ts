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

  // Initialiser la réponse
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Si pas de config, on laisse passer pour éviter le 403/500
  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  try {
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

    // 2. LOGIQUE DE REDIRECTION SIMPLIFIÉE
    const isDashboard = pathname.startsWith('/dashboard')
    const isLoginPage = pathname === '/auth/login'

    if (!user && isDashboard) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      // Ajouter l'URL de redirection pour revenir au dashboard après login
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      // Rediriger vers la page demandée initialement ou le dashboard
      const next = request.nextUrl.searchParams.get('next') || '/dashboard'
      url.pathname = next
      url.searchParams.delete('next')
      return NextResponse.redirect(url)
    }
  } catch (e) {
    // En cas d'erreur dans le middleware, on laisse passer la requête
    // pour éviter de bloquer l'utilisateur avec un 403/500
    console.error('Middleware error:', e)
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
