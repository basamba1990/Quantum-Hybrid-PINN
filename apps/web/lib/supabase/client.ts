import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ivhxnaxhgfbiqlhgfkik.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!url || !key) {
    console.error('Supabase environment variables are missing. Please check your .env file or Vercel dashboard.')
  }

  return createBrowserClient(url, key)
}
