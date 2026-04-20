'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  FlaskConical, 
  MessageSquare, 
  History, 
  Settings,
  LogOut,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'

const menuItems = [
  { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard' },
  { icon: FlaskConical, label: 'Simulations', href: '/dashboard/simulations' },
  { icon: MessageSquare, label: 'Assistant IA', href: '/dashboard/assistant' },
  { icon: History, label: 'Historique', href: '/dashboard/history' },
  { icon: Settings, label: 'Paramètres', href: '/dashboard/settings' },
]

interface SidebarProps {
  user?: User
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast.error('Erreur lors de la déconnexion')
        return
      }
      toast.success('Déconnecté avec succès')
      router.push('/auth/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Une erreur s\'est produite')
    }
  }

  return (
    <div className="w-64 glass-card border-r border-white/10 flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Quantum PINN
        </h1>
        {user && (
          <p className="text-xs text-gray-500 mt-2 truncate">{user.email}</p>
        )}
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-primary/20 text-primary border border-primary/20" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "group-hover:text-white")} />
                <span className="font-medium">{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-4 h-4" />}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>
    </div>
  )
}
