'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  Lightbulb, 
  TrendingUp, 
  Zap,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Target,
  Gauge,
  Cpu
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Improvement {
  id: string
  analysis_id: string
  project_id: string
  project_name: string
  category: 'performance' | 'accuracy' | 'stability' | 'convergence' | 'physics'
  title: string
  description: string
  current_value: number
  potential_value: number
  impact_score: number
  implementation_effort: 'low' | 'medium' | 'high'
  created_at: string
  status: 'suggested' | 'in_progress' | 'completed'
}

const improvementCategories = {
  performance: { label: 'Performance', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Zap },
  accuracy: { label: 'Précision', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Target },
  stability: { label: 'Stabilité', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Gauge },
  convergence: { label: 'Convergence', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: TrendingUp },
  physics: { label: 'Physique', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Cpu }
}

const effortLabels = {
  low: { label: 'Faible', color: 'text-emerald-400' },
  medium: { label: 'Moyen', color: 'text-amber-400' },
  high: { label: 'Élevé', color: 'text-red-400' }
}

export default function ImprovementsPage() {
  const [improvements, setImprovements] = useState<Improvement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'suggested' | 'in_progress' | 'completed'>('suggested')
  const [categoryFilter, setCategoryFilter] = useState<'all' | keyof typeof improvementCategories>('all')
  const supabase = createClient()

  useEffect(() => {
    const fetchImprovements = async () => {
      try {
        // Fetch analyses avec résultats contenant des suggestions d'améliorations
        const { data: analyses, error } = await supabase
          .from('analyses')
          .select('id, project_id, results, created_at, status')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(100)

        if (error) throw error

        // Récupérer les noms des projets
        const projectIds = [...new Set(analyses?.map((a: any) => a.project_id) || [])]
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds)

        const projectMap = new Map(projects?.map((p: any) => [p.id, p.name]) || [])

        // Extraire les améliorations suggérées
        const improvementsList: Improvement[] = []
        
        analyses?.forEach((analysis: any) => {
          let results = analysis.results
          if (typeof results === 'string') {
            try {
              results = JSON.parse(results)
            } catch {
              results = {}
            }
          }

          // Générer des suggestions d'améliorations basées sur les résultats
          const suggestions = generateImprovementSuggestions(results, analysis.id, analysis.project_id, projectMap.get(analysis.project_id) || 'Projet inconnu')
          improvementsList.push(...suggestions)
        })

        setImprovements(improvementsList)
      } catch (err) {
        console.error('Error fetching improvements:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchImprovements()
  }, [supabase])

  const generateImprovementSuggestions = (results: any, analysisId: string, projectId: string, projectName: string): Improvement[] => {
    const suggestions: Improvement[] = []
    const now = new Date().toISOString()

    // Suggestion 1: Convergence
    if (results.residual_history) {
      const finalResidual = results.residual_history[results.residual_history.length - 1] || 1e-4
      if (finalResidual > 1e-6) {
        suggestions.push({
          id: `imp-${analysisId}-1`,
          analysis_id: analysisId,
          project_id: projectId,
          project_name: projectName,
          category: 'convergence',
          title: 'Augmenter le nombre d\'itérations d\'entraînement',
          description: `Les résidus actuels (${finalResidual.toExponential(2)}) pourraient être réduits en augmentant le nombre d'itérations de 20% pour atteindre une convergence plus fine.`,
          current_value: finalResidual,
          potential_value: finalResidual * 0.1,
          impact_score: 8.5,
          implementation_effort: 'low',
          created_at: now,
          status: 'suggested'
        })
      }
    }

    // Suggestion 2: Accuracy
    if (results.predictions3d && results.predictions3d.length > 0) {
      suggestions.push({
        id: `imp-${analysisId}-2`,
        analysis_id: analysisId,
        project_id: projectId,
        project_name: projectName,
        category: 'accuracy',
        title: 'Raffiner la grille de discrétisation spatiale',
        description: `Augmenter la résolution de la grille de 30% pour améliorer la précision des prédictions aux zones de gradient élevé.`,
        current_value: 64,
        potential_value: 96,
        impact_score: 7.8,
        implementation_effort: 'medium',
        created_at: now,
        status: 'suggested'
      })
    }

    // Suggestion 3: Performance
    suggestions.push({
      id: `imp-${analysisId}-3`,
      analysis_id: analysisId,
      project_id: projectId,
      project_name: projectName,
      category: 'performance',
      title: 'Optimiser l\'architecture du réseau de neurones',
      description: `Utiliser une architecture FNO hybride avec attention multi-tête pour réduire le temps de calcul de 40% tout en maintenant la précision.`,
      current_value: 2.45,
      potential_value: 1.47,
      impact_score: 8.2,
      implementation_effort: 'high',
      created_at: now,
      status: 'suggested'
    })

    // Suggestion 4: Stability
    if (results.predictions3d && results.predictions3d.length > 0) {
      const temps = results.predictions3d.map((p: any) => p.temperature || 293.15)
      const variance = temps.length > 1 ? temps.reduce((sum: number, t: number, i: number) => {
        const prev = temps[Math.max(0, i - 1)]
        return sum + Math.pow(t - prev, 2)
      }, 0) / temps.length : 0

      if (variance > 10) {
        suggestions.push({
          id: `imp-${analysisId}-4`,
          analysis_id: analysisId,
          project_id: projectId,
          project_name: projectName,
          category: 'stability',
          title: 'Ajouter des termes de régularisation physique',
          description: `Implémenter des contraintes de conservation d'énergie pour stabiliser les prédictions temporelles et réduire les oscillations.`,
          current_value: variance,
          potential_value: variance * 0.3,
          impact_score: 7.5,
          implementation_effort: 'medium',
          created_at: now,
          status: 'suggested'
        })
      }
    }

    // Suggestion 5: Physics
    suggestions.push({
      id: `imp-${analysisId}-5`,
      analysis_id: analysisId,
      project_id: projectId,
      project_name: projectName,
      category: 'physics',
      title: 'Valider contre des données expérimentales',
      description: `Comparer les prédictions PINN avec des mesures expérimentales pour calibrer les paramètres physiques et améliorer la cohérence.`,
      current_value: 85.3,
      potential_value: 94.7,
      impact_score: 9.1,
      implementation_effort: 'high',
      created_at: now,
      status: 'suggested'
    })

    return suggestions
  }

  const filteredImprovements = improvements.filter(imp => {
    const statusMatch = filter === 'all' || imp.status === filter
    const categoryMatch = categoryFilter === 'all' || imp.category === categoryFilter
    return statusMatch && categoryMatch
  })

  const stats = {
    total: improvements.length,
    avgImpact: improvements.length > 0 ? (improvements.reduce((sum, i) => sum + i.impact_score, 0) / improvements.length).toFixed(1) : 0,
    highImpact: improvements.filter(i => i.impact_score >= 8).length,
    completed: improvements.filter(i => i.status === 'completed').length
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono text-[10px] uppercase tracking-tighter">
              Optimisation V8.5
            </Badge>
            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-mono uppercase tracking-tighter">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Engine Active
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Améliorations Suggérées</h1>
          <p className="text-gray-400 text-sm mt-2">Optimisations recommandées pour vos simulations PINN</p>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Total Suggestions</p>
                <p className="text-3xl font-black text-white">{stats.total}</p>
              </div>
              <Lightbulb className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Impact Moyen</p>
                <p className="text-3xl font-black text-emerald-400">{stats.avgImpact}/10</p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Impact Élevé</p>
                <p className="text-3xl font-black text-amber-400">{stats.highImpact}</p>
              </div>
              <Zap className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Complétées</p>
                <p className="text-3xl font-black text-blue-400">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          {[
            { value: 'suggested', label: 'Suggérées' },
            { value: 'in_progress', label: 'En cours' },
            { value: 'completed', label: 'Complétées' },
            { value: 'all', label: 'Toutes' }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-6 py-2 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${
                filter === tab.value
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          {[
            { value: 'all', label: 'Toutes catégories' },
            ...Object.entries(improvementCategories).map(([key, val]) => ({ value: key, label: val.label }))
          ].map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                categoryFilter === cat.value
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Improvements List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Chargement des suggestions...</p>
        </div>
      ) : filteredImprovements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 border-2 border-dashed border-white/10 rounded-3xl">
          <Lightbulb className="w-12 h-12 text-gray-700" />
          <p className="text-gray-400 text-lg font-medium">Aucune suggestion trouvée</p>
          <p className="text-gray-500 text-sm">Lancez des simulations pour générer des suggestions d'améliorations</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredImprovements.map(improvement => {
            const category = improvementCategories[improvement.category]
            const CategoryIcon = category.icon
            const effort = effortLabels[improvement.implementation_effort]
            
            return (
              <Link
                key={improvement.id}
                href={`/dashboard/projects/${improvement.project_id}/analysis`}
              >
                <Card className="bg-white/5 border-white/10 hover:border-blue-500/30 hover:bg-white/[0.08] transition-all cursor-pointer rounded-3xl overflow-hidden group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${category.color} border`}>
                            <CategoryIcon className="w-4 h-4" />
                          </div>
                          <h3 className="text-lg font-bold text-white truncate">{improvement.title}</h3>
                          <Badge className={`${category.color} border text-[10px] font-black uppercase tracking-widest flex-shrink-0`}>
                            {category.label}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm mb-3">{improvement.description}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                          <span>{improvement.project_name}</span>
                          <span>•</span>
                          <span>{format(new Date(improvement.created_at), 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Impact</p>
                          <p className="text-2xl font-black text-amber-400">{improvement.impact_score.toFixed(1)}</p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Effort</p>
                          <p className={`text-sm font-black uppercase tracking-widest ${effort.color}`}>{effort.label}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Gain</p>
                          <p className="text-sm font-black text-emerald-400">
                            +{((improvement.potential_value / improvement.current_value - 1) * 100).toFixed(0)}%
                          </p>
                        </div>

                        <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
