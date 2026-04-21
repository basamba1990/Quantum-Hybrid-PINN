
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project } from '@/types'
import { Plus, FlaskConical, Activity, Clock, Search, Filter } from 'lucide-react'
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
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-gray-400 mt-2">Gérez vos simulations Q-Hybrid-Science-Verify</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-6 py-2 rounded-lg transition-colors">
            <Plus className="mr-2 h-4 w-4" /> Nouveau Projet
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Projets</CardTitle>
            <FlaskConical className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Simulations Actives</CardTitle>
            <Activity className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Dernière Run</CardTitle>
            <Clock className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Rechercher un projet..." 
              className="pl-10 glass-card border-white/10 focus:ring-primary/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="glass-card border-white/10">
            <Filter className="mr-2 h-4 w-4" /> Filtres
          </Button>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl border-dashed border-white/10">
            <FlaskConical className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold">Aucun projet trouvé</h3>
            <p className="text-gray-400 mt-2">Commencez par créer votre première simulation quantique.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                <Card className="glass-card group hover:border-primary/50 transition-all duration-300 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <CardHeader>
                    <CardTitle className="group-hover:text-primary transition-colors">{project.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 line-clamp-2 text-sm">{project.description}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
