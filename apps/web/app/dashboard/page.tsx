'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Project } from '@/types'

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          console.error('Auth error or no user:', userError)
          // If no user, maybe the session is not yet ready, retry once
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
        
        if (error) {
          console.error('Fetch projects error:', error)
        }
        
        setProjects(data || [])
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [supabase])

  if (loading) return <div className="p-8">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Mes Projets</h1>
        <Link
          href="/dashboard/projects/new"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Nouveau Projet
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-gray-500">Aucun projet pour le moment.</p>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="p-4 border rounded-lg hover:shadow-lg transition"
            >
              <h2 className="text-xl font-semibold">{project.name}</h2>
              <p className="text-gray-600">{project.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}