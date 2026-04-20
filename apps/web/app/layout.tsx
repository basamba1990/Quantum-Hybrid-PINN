import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { Providers } from './providers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Q-Hybrid Science Verify',
  description: 'Gestion de projets, analyses et rapports scientifiques',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Vérifier la session utilisateur côté serveur
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  // Déterminer si on est sur une page publique ou protégée
  const isPublicRoute = (pathname: string) => {
    const publicRoutes = ['/', '/auth/login', '/auth/callback']
    return publicRoutes.includes(pathname)
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
