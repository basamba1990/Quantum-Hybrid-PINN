'use client'

// KELLY SENECAL TRULY-INDUSTRIAL DYNAMIC AUDIT V2.1.7
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  ShieldCheck, 
  Activity, 
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface AuditRecord {
  id: string
  project_id: string
  project_name: string
  credibility_score: number
  is_physically_coherent: boolean
  anomalies_count: number
  created_at: string
  status: 'completed' | 'in_progress' | 'failed'
}

export default function AuditsPage() {
  const [audits, setAudits] = useState<AuditRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'coherent' | 'anomaly'>('all')
  const supabase = createClient()

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const { data, error } = await supabase
          .from('analyses')
          .select('id, project_id, name, credibility_score, results, created_at, status')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error

        // Récupérer les noms des projets
        const projectIds = [...new Set(data?.map((d: any) => d.project_id) || [])]
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds)

        const projectMap = new Map(projects?.map((p: any) => [p.id, p.name]) || [])

        const auditRecords: AuditRecord[] = (data || []).map((analysis: any) => {
          let results = analysis.results
          if (typeof results === 'string') {
            try {
              results = JSON.parse(results)
            } catch {
              results = {}
            }
          }

          return {
            id: analysis.id,
            project_id: analysis.project_id,
            project_name: projectMap.get(analysis.project_id) || 'Projet inconnu',
            credibility_score: Number(analysis.credibility_score || results?.credibilityScore || 0),
            is_physically_coherent: Number(analysis.credibility_score || results?.credibilityScore || 0) > 50,
            anomalies_count: results?.anomalies?.length || 0,
            created_at: analysis.created_at,
            status: analysis.status
          }
        })

        setAudits(auditRecords)
      } catch (err) {
        console.error('Error fetching audits:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAudits()
  }, [supabase])

  const filteredAudits = audits.filter(audit => {
    if (filter === 'coherent') return audit.is_physically_coherent
    if (filter === 'anomaly') return !audit.is_physically_coherent
    return true
  })

  const stats = {
    total: audits.length,
    coherent: audits.filter(a => a.is_physically_coherent).length,
    anomalies: audits.filter(a => !a.is_physically_coherent).length,
    avgScore: audits.length > 0 ? (audits.reduce((sum, a) => sum + (Number(a.credibility_score) || 0), 0) / audits.length).toFixed(1) : "0.0"
  }

  const getCredibilityBadge = (score: number) => {
    if (score >= 90) return { label: 'INDUSTRIAL-GOLD', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
    if (score >= 75) return { label: 'CERTIFIED-PRO', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
    if (score >= 50) return { label: 'VALIDATION-REQUIRED', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    return { label: 'CRITICAL', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[10px] uppercase tracking-tighter">
              Audit V8.5
            </Badge>
            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-mono uppercase tracking-tighter">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Engine Active
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Audits Scientifiques</h1>
          <p className="text-gray-400 text-sm mt-2">Historique complet de la validation physique de vos simulations</p>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Total Audits</p>
                <p className="text-3xl font-black text-white">{stats.total}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Cohérents</p>
                <p className="text-3xl font-black text-emerald-400">{stats.coherent}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Anomalies</p>
                <p className="text-3xl font-black text-amber-400">{stats.anomalies}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Score Moyen</p>
                <p className="text-3xl font-black text-blue-400">{stats.avgScore}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-3">
        {[
          { value: 'all', label: 'Tous les audits' },
          { value: 'coherent', label: 'Physiquement cohérents' },
          { value: 'anomaly', label: 'Avec anomalies' }
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

      {/* Audits List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Chargement des audits...</p>
        </div>
      ) : filteredAudits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 border-2 border-dashed border-white/10 rounded-3xl">
          <ShieldCheck className="w-12 h-12 text-gray-700" />
          <p className="text-gray-400 text-lg font-medium">Aucun audit trouvé</p>
          <p className="text-gray-500 text-sm">Lancez une simulation pour générer un audit scientifique</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAudits.map(audit => {
            const badge = getCredibilityBadge(audit.credibility_score)
            return (
              <Link
                key={audit.id}
                href={`/dashboard/projects/${audit.project_id}/analysis`}
              >
                <Card className="bg-white/5 border-white/10 hover:border-blue-500/30 hover:bg-white/[0.08] transition-all cursor-pointer rounded-3xl overflow-hidden group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white truncate">{audit.project_name}</h3>
                          <Badge className={`${badge.color} border text-[10px] font-black uppercase tracking-widest`}>
                            {badge.label}
                          </Badge>
                          {audit.is_physically_coherent ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="font-mono text-[10px]">ID: {audit.id.slice(0, 8)}</span>
                          <span>{format(new Date(audit.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Score</p>
                          <p className="text-2xl font-black text-blue-400">{audit.credibility_score.toFixed(1)}%</p>
                        </div>
                        {audit.anomalies_count > 0 && (
                          <div className="text-right">
                            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Anomalies</p>
                            <p className="text-2xl font-black text-amber-400">{audit.anomalies_count}</p>
                          </div>
                        )}
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
