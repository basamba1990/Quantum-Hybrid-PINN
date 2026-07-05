import { createClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'
import demoData from '@/lib/demo_project_data.json'

export async function POST(request: Request) {
  const supabase = createClient()
  
  // 1. Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  
  try {
    // 2. Create Project
    const { data: project, error: pError } = await supabase
      .from('projects')
      .insert({
        name: demoData.project.name,
        description: demoData.project.description,
        user_id: user.id,
        status: demoData.project.status || 'active'
      })
      .select()
      .single()
      
    if (pError) {
      console.error('Project injection error:', pError)
      return NextResponse.json({ error: `Project error: ${pError.message}` }, { status: 500 })
    }
    
    // 3. Create Analysis
    const { data: analysis, error: aError } = await supabase
      .from('analyses')
      .insert({
        name: demoData.analysis.title || 'Demo Analysis',
        project_id: project.id,
        user_id: user.id,
        status: demoData.analysis.status || 'completed',
        results: demoData.analysis.results || {}
      })
      .select()
      .single()
      
    if (aError) {
      console.error('Analysis injection error:', aError)
      return NextResponse.json({ error: `Analysis error: ${aError.message}` }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, projectId: project.id, analysisId: analysis.id })
  } catch (err) {
    console.error('Global injection error:', err)
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Unknown error during injection' 
    }, { status: 500 })
  }
}
