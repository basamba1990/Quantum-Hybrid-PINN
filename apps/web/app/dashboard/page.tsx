'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project } from '@/types'
import { 
  Plus, 
  FlaskConical, 
  Activity, 
  Clock, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Layers, 
  ShieldCheck,
  ChevronRight,
  Atom
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          setLoading(false)
          return
        }
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        
        if (error) console.error('Fetch projects error:', error)
        setProjects(data || [])
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [supabase])

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin"></div>
        <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-r-2 border-l-2 border-emerald-500 animate-spin-slow"></div>
      </div>
      <p className="text-blue-500 font-mono text-xs animate-pulse uppercase tracking-widest">Initialisation du Nexus Quantique...</p>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 relative">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-600/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-500 font-mono text-[10px] uppercase tracking-[0.3em]">
            <Atom className="w-3 h-3" /> 
            <span>Centre de Commandement</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">
            Nexus <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Scientifique</span>
          </h1>
          <p className="text-gray-400 max-w-md text-sm leading-relaxed">
            Supervision des simulations Quantum-Hybrid-FNO et orchestration des validations physiques en temps réel.
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <button className="group relative px-8 py-4 bg-white text-black font-bold rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity" />
            <span className="relative flex items-center gap-2">
              <Plus className="w-5 h-5" /> Nouveau Projet de Recherche
            </span>
          </button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Projets Actifs', value: projects.length, icon: Layers, color: 'blue' },
          { label: 'Analyses PINN', value: '12', icon: Activity, color: 'emerald' },
          { label: 'Score Moyen', value: '94%', icon: ShieldCheck, color: 'purple' },
          { label: 'Temps Calcul', value: '1.2s', icon: Clock, color: 'orange' },
        ].map((stat, i) => (
          <div key={i} className="relative group">
            <div className="absolute inset-0 bg-white/[0.02] border border-white/10 rounded-3xl transition-all group-hover:border-white/20" />
            <div className="relative p-6 space-y-4">
              <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 w-fit`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-black text-white mt-1">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Projects Control Bar */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
            <input 
              placeholder="Filtrer les archives quantiques..." 
              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white hover:bg-white/10 transition-all">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-bold">Paramètres de Vue</span>
          </button>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="relative py-24 rounded-[40px] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />
            <FlaskConical className="h-16 w-16 text-gray-700 mb-6 relative" />
            <h3 className="text-2xl font-bold text-white relative">Aucune Donnée Détectée</h3>
            <p className="text-gray-500 mt-2 max-w-xs relative">Votre nexus est vide. Initialisez un nouveau projet pour commencer la simulation.</p>
            <Link href="/dashboard/projects/new" className="mt-8 relative">
              <Button variant="outline" className="rounded-xl border-white/10 hover:bg-white/10">
                Initialiser le Premier Projet
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project) => (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="group">
                <div className="relative h-full transition-all duration-500 group-hover:-translate-y-2">
                  {/* Card Glow */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-[32px] blur opacity-0 group-hover:opacity-20 transition duration-500" />
                  
                  <div className="relative h-full bg-[#0a0a0a] border border-white/10 rounded-[30px] overflow-hidden flex flex-col">
                    <div className="h-1.5 w-full bg-white/5 relative overflow-hidden">
                      <div className="absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r from-blue-500 to-emerald-500 group-hover:w-full transition-all duration-700" />
                    </div>
                    
                    <div className="p-8 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl">
                          <FlaskConical className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-1 rounded-full uppercase tracking-tighter">
                          <div className="w-1 h-1 bg-blue-500 rounded-full" />
                          V8-Active
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors mb-2 line-clamp-1">
                        {project.name}
                      </h3>
                      
                      <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed flex-1">
                        {project.description || "Aucune description scientifique fournie pour ce module de simulation."}
                      </p>
                      
                      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
	                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400">
	                            {project.name ? project.name[0].toUpperCase() : 'P'}
	                          </div>
	                          <div className="text-[10px] font-mono text-gray-500">
	                            <p className="uppercase tracking-widest">Date Init</p>
	                            <p className="text-gray-300">{project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Inconnue'}</p>
	                          </div>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
