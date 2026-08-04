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
  ChevronRight,
  Zap,
  BarChart3,
  FileText,
  ShieldCheck,
  Lightbulb,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'

const menuItems = [
  // Section Principale
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', section: 'PRINCIPAL' },
  { icon: FlaskConical, label: 'Pipeline', href: '/dashboard/simulations', section: 'PRINCIPAL' },
  { icon: Zap, label: 'Physics', href: '/dashboard/benchmarks', section: 'PRINCIPAL' },
  { icon: BarChart3, label: 'Analysis', href: '/dashboard/sweet-spot-analysis', section: 'PRINCIPAL' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings', section: 'PRINCIPAL' },
  
  // Section Secondaire
  { icon: MessageSquare, label: 'Assistant IA', href: '/dashboard/assistant', section: 'OUTILS' },
  { icon: FileText, label: 'Média', href: '/dashboard/media', section: 'OUTILS' },
  { icon: Users, label: 'Social Hub', href: '/dashboard/social-hub', section: 'OUTILS' },
  { icon: ShieldCheck, label: 'Audits', href: '/dashboard/audits', section: 'OUTILS' },
  { icon: Lightbulb, label: 'Améliorations', href: '/dashboard/improvements', section: 'OUTILS' },
]

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
  section: 'PRINCIPAL' | 'OUTILS'
}

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
    <div className="w-72 bg-black/40 backdrop-blur-2xl border-r border-white/10 flex flex-col h-screen sticky top-0 overflow-hidden">
      {/* Decorative Background Element */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/30 rounded-full blur-[100px]" />
      </div>

      <div className="p-8 relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg shadow-lg shadow-blue-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            QUANTUM<span className="text-blue-500">PINN</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">Engine Active</span>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-6 mt-4 relative overflow-y-auto">
        {/* Section Principale */}
        <div>
          <div className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest px-4 mb-3 font-bold flex items-center gap-2">
            <Zap className="w-3 h-3" />
            Navigation Principale
          </div>
          <div className="space-y-2">
            {menuItems.filter(item => item.section === 'PRINCIPAL').map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                    isActive 
                      ? "bg-gradient-to-r from-cyan-600/20 to-purple-600/20 text-white border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)] animate-glow-cyan" 
                      : "text-gray-400 hover:bg-white/5 hover:text-white hover:border-white/10 border border-transparent"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-purple-500" />
                  )}
                  <div className="flex items-center gap-4">
                    <item.icon className={cn("w-5 h-5 transition-all duration-300 group-hover:scale-110", isActive ? "text-cyan-400" : "group-hover:text-cyan-400")} />
                    <span className="font-semibold text-sm tracking-tight">{item.label}</span>
                  </div>
                  {isActive ? (
                    <ChevronRight className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-gray-700 group-hover:bg-cyan-500/50" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Section Outils */}
        <div>
          <div className="text-[10px] font-mono text-purple-500 uppercase tracking-widest px-4 mb-3 font-bold flex items-center gap-2">
            <Settings className="w-3 h-3" />
            Outils & Utilitaires
          </div>
          <div className="space-y-2">
            {menuItems.filter(item => item.section === 'OUTILS').map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                    isActive 
                      ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]" 
                      : "text-gray-400 hover:bg-white/5 hover:text-white hover:border-white/10 border border-transparent"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500" />
                  )}
                  <div className="flex items-center gap-4">
                    <item.icon className={cn("w-5 h-5 transition-all duration-300 group-hover:scale-110", isActive ? "text-purple-400" : "group-hover:text-purple-400")} />
                    <span className="font-semibold text-sm tracking-tight">{item.label}</span>
                  </div>
                  {isActive ? (
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-gray-700 group-hover:bg-purple-500/50" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="p-6 border-t border-white/5 bg-white/[0.02] relative">
        {user && (
          <div className="mb-6 px-2">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-sm font-bold border border-white/10">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.email?.split('@')[0]}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:text-red-400 transition-all duration-300 rounded-xl hover:bg-red-500/10 group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm">Déconnexion Système</span>
        </button>
      </div>
    </div>
  )
}
