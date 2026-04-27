import { createServerClient, parse, serialize } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set(name, value, options)
        },
        remove(name: string, options: any) {
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.delete(name)
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Routes protégées
  const protectedRoutes = ['/dashboard', '/api/assistant']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Routes publiques
  const publicRoutes = ['/', '/auth/login', '/auth/callback']
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname)

  // Si l'utilisateur n'est pas authentifié et essaie d'accéder à une route protégée
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Si l'utilisateur est authentifié et essaie d'accéder à la page de connexion
  if (user && request.nextUrl.pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  runtime: 'nodejs', // ← Force l'utilisation de Node.js au lieu d'Edge
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
