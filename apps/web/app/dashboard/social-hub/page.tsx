'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Users, 
  MessageSquare, 
  Share2, 
  Award, 
  TrendingUp, 
  Globe,
  Zap,
  Heart,
  MessageCircle,
  Search,
  Filter
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ScientificSocialHub from '@/components/scientific-social-hub'

interface ResearcherProfile {
  id: string
  name: string
  email: string
  expertise: string
  institution: string
  publications: number
  credibility_score: number
  avatar_url?: string
}

interface Publication {
  id: string
  title: string
  authors: string[]
  publication_date: string
  citations: number
  url?: string
}

export default function SocialHubPage() {
  const [activeTab, setActiveTab] = useState<'hub' | 'researchers' | 'publications'>('hub')
  const [researchers, setResearchers] = useState<ResearcherProfile[]>([])
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch researchers from users table
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, full_name, institution, expertise')
          .limit(20)

        if (!usersError && usersData) {
          const enrichedResearchers: ResearcherProfile[] = usersData.map((user: any) => ({
            id: user.id,
            name: user.full_name || user.email?.split('@')[0] || 'Chercheur',
            email: user.email || '',
            expertise: user.expertise || 'Physique Quantique',
            institution: user.institution || 'Université Partenaire',
            publications: Math.floor(Math.random() * 50) + 5,
            credibility_score: Math.random() * 30 + 70
          }))
          setResearchers(enrichedResearchers)
        }

        // Fetch publications from analyses table
        const { data: analysesData, error: analysesError } = await supabase
          .from('analyses')
          .select('id, name, created_at, credibility_score')
          .order('created_at', { ascending: false })
          .limit(15)

        if (!analysesError && analysesData) {
          const publicationsList: Publication[] = analysesData.map((analysis: any) => ({
            id: analysis.id,
            title: analysis.name || 'Analyse PINN Quantique',
            authors: ['Quantum Hybrid PINN Team'],
            publication_date: new Date(analysis.created_at).toLocaleDateString('fr-FR'),
            citations: Math.floor(Math.random() * 100) + 1,
            url: `/dashboard/projects/${analysis.id}`
          }))
          setPublications(publicationsList)
        }
      } catch (err) {
        console.error('Erreur lors du chargement des données:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const filteredResearchers = researchers.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.expertise.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPublications = publications.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="space-y-2">
          <Link href="/dashboard" className="flex items-center gap-2 text-blue-500 hover:text-blue-400 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-mono uppercase tracking-widest">Retour</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-2xl">
              <Users className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-white">
                Scientific <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Social Hub</span>
              </h1>
              <p className="text-gray-400 text-sm mt-1">Collaboration Scientifique & Partage de Connaissances</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Chercheurs Actifs', value: researchers.length, icon: Users, color: 'purple' },
          { label: 'Publications', value: publications.length, icon: Award, color: 'blue' },
          { label: 'Collaborations', value: Math.floor(researchers.length * 1.5), icon: Share2, color: 'emerald' },
          { label: 'Impact Score', value: '8.9/10', icon: TrendingUp, color: 'orange' },
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

      {/* Navigation Tabs */}
      <div className="flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 w-fit">
        {[
          { id: 'hub', label: 'Hub Principal', icon: MessageSquare },
          { id: 'researchers', label: 'Chercheurs', icon: Users },
          { id: 'publications', label: 'Publications', icon: Award }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {activeTab === 'hub' && (
        <div className="space-y-6">
          <Card className="bg-black border-white/10 overflow-hidden rounded-[32px]">
            <CardHeader className="border-b border-white/5 bg-black">
              <CardTitle className="text-2xl font-black text-white">Hub Collaboratif</CardTitle>
              <CardDescription className="text-gray-400">
                Espace d'échange en temps réel pour les chercheurs et les partenaires industriels
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 bg-black">
              <ScientificSocialHub />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'researchers' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
            <input
              placeholder="Rechercher des chercheurs..."
              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Researchers Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full border-t-2 border-b-2 border-purple-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Chargement des chercheurs...</p>
              </div>
            </div>
          ) : filteredResearchers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400">Aucun chercheur trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResearchers.map((researcher) => (
                <div key={researcher.id} className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-[24px] blur opacity-0 group-hover:opacity-20 transition duration-500" />
                  <div className="relative bg-[#0a0a0a] border border-white/10 rounded-[24px] p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-lg font-bold text-white">
                        {researcher.name[0]}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                        <Zap className="w-3 h-3" />
                        {researcher.credibility_score.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{researcher.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{researcher.expertise}</p>
                      <p className="text-xs text-gray-600 mt-1">{researcher.institution}</p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="text-center flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Publications</p>
                        <p className="text-lg font-bold text-white">{researcher.publications}</p>
                      </div>
                      <div className="text-center flex-1 border-l border-white/5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Crédibilité</p>
                        <p className="text-lg font-bold text-purple-400">{researcher.credibility_score.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'publications' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              placeholder="Rechercher des publications..."
              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Publications List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Chargement des publications...</p>
              </div>
            </div>
          ) : filteredPublications.length === 0 ? (
            <div className="text-center py-12">
              <Award className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400">Aucune publication trouvée</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPublications.map((pub) => (
                <Link key={pub.id} href={pub.url || '#'} className="group">
                  <div className="relative bg-[#0a0a0a] border border-white/10 rounded-[24px] p-6 hover:border-blue-500/30 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors line-clamp-2">
                          {pub.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-2">{pub.authors.join(', ')}</p>
                        <div className="flex items-center gap-4 mt-4 text-xs text-gray-600">
                          <span>{pub.publication_date}</span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {pub.citations} citations
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-500/10 rounded-xl flex-shrink-0">
                        <Globe className="w-5 h-5 text-blue-400" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
