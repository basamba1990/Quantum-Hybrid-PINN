import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { Providers } from './providers'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering to avoid static generation conflicts with cookies
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Q-Hybrid Science Verify',
  description: 'Gestion de projets, analyses et rapports scientifiques',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user = null
  
  try {
    // Vérifier la session utilisateur côté serveur avec gestion d'erreur
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data) {
      user = data.user
    }
  } catch (e) {
    console.error('Failed to fetch user in RootLayout:', e)
  }

  return (
    <html lang="fr" className="dark">
      <body className="flex min-h-screen bg-background text-foreground">
        <Providers>
          {/* Afficher le Sidebar uniquement si l'utilisateur est authentifié */}
          {user && <Sidebar user={user} />}
          
          <main className={`flex-1 overflow-y-auto ${user ? '' : 'w-full'}`}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
