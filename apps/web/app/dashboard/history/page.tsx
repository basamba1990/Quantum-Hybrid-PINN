'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, Search, Download, Trash2, ExternalLink, Loader2, FlaskConical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'

interface SimulationRun {
  id: string
  name: string
  created_at: string
  status: string
  project_id: string
  // Note: ces champs pourraient être étendus selon la structure réelle de vos analyses
  accuracy?: string
  type?: string
}

export default function HistoryPage() {
  const [historyData, setHistoryData] = useState<SimulationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // On récupère les analyses qui servent d'historique de simulation
        const { data, error } = await supabase
          .from('analyses')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setHistoryData(data || [])
      } catch (err) {
        console.error('Error fetching history:', err)
        toast.error("Erreur lors de la récupération de l'historique")
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [supabase])

  const filteredData = historyData.filter(run =>
    run.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette simulation de l\'historique ?')) return
    
    try {
      const { error } = await supabase.from('analyses').delete().eq('id', id)
      if (error) throw error
      setHistoryData(prev => prev.filter(item => item.id !== id))
      toast.success('Simulation supprimée')
    } catch (err) {
      toast.error('Erreur lors de la suppression')
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Chargement de l'historique...</p>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <History className="text-primary w-10 h-10" />
          Historique des Simulations
        </h1>
        <p className="text-gray-400 mt-2">Consultez et comparez vos anciennes sessions de calcul réelles</p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input 
            placeholder="Filtrer l'historique..." 
            className="pl-10 glass-card border-white/10 bg-white/5"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="glass-card border-white/10 hover:bg-white/5">
          Exporter tout
        </Button>
      </div>

      <div className="grid gap-4">
        {filteredData.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[32px]">
            <FlaskConical className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white">Aucun historique</h3>
            <p className="text-gray-500 mt-2">Lancez une analyse pour la voir apparaître ici.</p>
          </div>
        ) : (
          filteredData.map((run) => (
            <Card key={run.id} className="glass-card border-white/10 hover:border-primary/30 transition-all duration-300 group bg-white/5">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    run.status === 'completed' ? 'bg-green-500/10 text-green-400' : 
                    run.status === 'pending' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    <History size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{run.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500">
                        {format(new Date(run.created_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase border-white/10 text-gray-400">
                        {run.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-gray-500 uppercase">Précision</p>
                    <p className={`font-mono font-bold ${run.status === 'completed' ? 'text-white' : 'text-gray-600'}`}>
                      {run.accuracy || '--'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="hover:bg-white/5 text-gray-400 group relative"
                    >
                      <Download size={18} />
                    </Button>
                    <Link href={`/dashboard/projects/${run.project_id}/analyses`}>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="hover:bg-white/5 text-gray-400 group relative"
                      >
                        <ExternalLink size={18} />
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(run.id)}
                      className="hover:bg-white/5 text-gray-400 hover:text-red-400 group relative"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
