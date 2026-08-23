import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BACKEND_URL = (
  process.env.H2_INFERENCE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ''
).replace(/\/$/, '')

export async function POST(request: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json({ error: 'URL du backend CFD non configurée.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Session Supabase absente ou expirée.' }, { status: 401 })
  }

  const incoming = await request.formData()
  const vtuFiles = incoming.getAll('vtu_files').filter((value): value is File => value instanceof File)
  const sidecar = incoming.get('sidecar')
  const caseId = incoming.get('case_id')
  const projectId = incoming.get('project_id')

  if (vtuFiles.length === 0 || !(sidecar instanceof File) || typeof caseId !== 'string' || !caseId.trim() || typeof projectId !== 'string' || !projectId.trim()) {
    return NextResponse.json(
      { error: 'Le formulaire doit contenir vtu_files[], sidecar, case_id et project_id.' },
      { status: 400 },
    )
  }

  const body = new FormData()
  for (const file of vtuFiles) body.append('vtu_files', file, file.name)
  body.append('sidecar', sidecar, sidecar.name)
  body.append('case_id', caseId.trim())
  body.append('project_id', projectId.trim())
  body.append('owner_id', user.id)

  const apiToken = process.env.CFD_IMPORT_API_TOKEN
  if (!apiToken) {
    return NextResponse.json(
      { error: 'CFD_IMPORT_API_TOKEN absent côté serveur; import désactivé par sécurité.' },
      { status: 503 },
    )
  }

  try {
    const response = await fetch(`${BACKEND_URL}/v2/cfd/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(180_000),
    })
    const payload = await response.json().catch(() => ({ error: 'Réponse backend non JSON.' }))
    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur réseau lors de l’import CFD.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
