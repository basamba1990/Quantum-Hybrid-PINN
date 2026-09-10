import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pinnTrainingProfileSchema } from '@/lib/pinn-training-schema'

export const runtime = 'nodejs'

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Session Supabase absente.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const parsed = pinnTrainingProfileSchema.safeParse(body?.profile)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid PINN training profile', issues: parsed.error.issues }, { status: 400 })
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
  if (!projectId) return NextResponse.json({ error: 'projectId requis.' }, { status: 422 })
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle()
  if (!project) return NextResponse.json({ error: 'Projet introuvable ou non autorisé.' }, { status: 404 })
  const profileHash = await sha256(stable(parsed.data))
  const { data, error } = await supabase.from('pinn_training_profiles').upsert({
    project_id: projectId, user_id: user.id, profile_version: parsed.data.profileVersion,
    classification: parsed.data.classification, project_status_required: parsed.data.projectStatusRequired,
    solver_execution: parsed.data.solverExecution, dataset: parsed.data.dataset, model_config: parsed.data.modelConfig,
    sampling: parsed.data.sampling, loss_weights: parsed.data.lossWeights, schedule: parsed.data.schedule,
    acceptance: parsed.data.acceptance, profile_hash: profileHash, updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const safeStatus = parsed.data.acceptance.doNotPromoteToValidated && parsed.data.projectStatusRequired === 'VALIDATION_CANDIDATE'
    ? 'VALIDATION_CANDIDATE' : parsed.data.projectStatusRequired
  await supabase.from('projects').update({ validation_status: safeStatus }).eq('id', projectId).eq('user_id', user.id)
  return NextResponse.json({ profile: data, profileHash, validationStatus: safeStatus })
}
