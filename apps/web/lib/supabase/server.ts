import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async () => {
  const cookieStore = await cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Validation stricte des variables d'environnement requises
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[Supabase SSR] Missing environment variables:\n' +
      `  - NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}\n` +
      `  - NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗'}\n` +
      'Configure these in your .env.local or Vercel project settings.'
    )
    
    // Retourner un client stub pour éviter les crashes, mais qui ne fonctionnera pas
    return createServerClient(
      supabaseUrl || 'https://placeholder-project.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key',
      {
        cookies: {
          getAll() { return [] },
          setAll() {}
        }
      }
    )
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
            console.debug('[Supabase SSR] Cookie setting failed (expected in Server Components):', error)
          }
        },
      },
    }
  )
}
