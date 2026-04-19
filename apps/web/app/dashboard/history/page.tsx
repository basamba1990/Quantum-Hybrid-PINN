'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, Search, Download, Trash2, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'

const historyData = [
  { id: 1, name: 'Simulation Hydrogène V1', date: '2024-03-15', status: 'Terminé', accuracy: '98.5%', type: 'PINN' },
  { id: 2, name: 'Test Convergence Adam', date: '2024-03-14', status: 'Terminé', accuracy: '94.2%', type: 'Hybrid' },
  { id: 3, name: 'Modèle Navier-Stokes 2D', date: '2024-03-12', status: 'Erreur', accuracy: '--', type: 'Classical' },
  { id: 4, name: 'Quantum PINN Optimization', date: '2024-03-10', status: 'Terminé', accuracy: '99.1%', type: 'Quantum' },
]

export default function HistoryPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <History className="text-primary w-10 h-10" />
          Historique des Simulations
        </h1>
        <p className="text-gray-400 mt-2">Consultez et comparez vos anciennes sessions de calcul</p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input 
            placeholder="Filtrer l'historique..." 
            className="pl-10 glass-card border-white/10"
          />
        </div>
        <Button variant="outline" className="glass-card border-white/10">
          Exporter tout
        </Button>
      </div>

      <div className="grid gap-4">
        {historyData.map((run) => (
          <Card key={run.id} className="glass-card border-white/10 hover:border-primary/30 transition-all duration-300 group">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  run.status === 'Terminé' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{run.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-500">{run.date}</span>
                    <Badge variant="outline" className="text-[10px] uppercase border-white/10 text-gray-400">
                      {run.type}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right hidden md:block">
                  <p className="text-xs text-gray-500 uppercase">Précision</p>
                  <p className={`font-mono font-bold ${run.status === 'Terminé' ? 'text-white' : 'text-gray-600'}`}>
                    {run.accuracy}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="hover:bg-white/5 text-gray-400">
                    <Download size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:bg-white/5 text-gray-400">
                    <ExternalLink size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:bg-white/5 text-gray-400 hover:text-red-400">
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
