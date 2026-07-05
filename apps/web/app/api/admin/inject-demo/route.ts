import { createClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'
import demoData from '@/lib/demo_project_data.json'

export async function POST(request: Request) {
  const supabase = createClient()
  
  // 1. Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  
  // 2. Create Project
  const { data: project, error: pError } = await supabase
    .from('projects')
    .insert({
      ...demoData.project,
      user_id: user.id
    })
    .select()
    .single()
    
  if (pError) return NextResponse.json({ error: pError.message }, { status: 500 })
  
  // 3. Create Analysis
  const { data: analysis, error: aError } = await supabase
    .from('analyses')
    .insert({
      ...demoData.analysis,
      project_id: project.id,
      user_id: user.id
    })
    .select()
    .single()
    
  if (aError) return NextResponse.json({ error: aError.message }, { status: 500 })
  
  return NextResponse.json({ success: true, projectId: project.id, analysisId: analysis.id })
}
