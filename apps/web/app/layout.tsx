import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Q-Hybrid Science Verify',
  description: 'Gestion de projets, analyses et rapports scientifiques',
}

import { Sidebar } from '@/components/Sidebar'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <body className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
