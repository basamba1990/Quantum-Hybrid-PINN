import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BACKEND_URL = (
  process.env.CFD_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.H2_INFERENCE_API_URL ||
  ''
).replace(/\/$/, '')

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export async function POST(request: NextRequest) {
  if (!BACKEND_URL) return jsonError('CFD backend URL is not configured on the server.', 503)
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return jsonError('Supabase session is missing or expired.', 401)

  const apiToken = process.env.CFD_IMPORT_API_TOKEN
  if (!apiToken) return jsonError('CFD_IMPORT_API_TOKEN is missing on the server; import disabled.', 503)

  let incoming: Record<string, unknown>
  try {
    incoming = await request.json() as Record<string, unknown>
  } catch {
    return jsonError('Invalid JSON import session.', 400)
  }

  const files = Array.isArray(incoming.files) ? incoming.files : []
  const sidecar = incoming.sidecar
  const caseId = typeof incoming.caseId === 'string' ? incoming.caseId.trim() : ''
  const projectId = typeof incoming.projectId === 'string' ? incoming.projectId.trim() : ''
  const sessionId = typeof incoming.sessionId === 'string' ? incoming.sessionId.trim() : ''
  const bucket = typeof incoming.bucket === 'string' ? incoming.bucket.trim() : ''
  if (!caseId || !projectId || !sessionId || !bucket || !files.length || !sidecar) {
    return jsonError('caseId, projectId, sessionId, bucket, files[] and sidecar are required.', 400)
  }

  const payload = {
    case_id: caseId,
    project_id: projectId,
    owner_id: user.id,
    session_id: sessionId,
    bucket,
    files,
    sidecar,
  }
  try {
    const response = await fetch(`${BACKEND_URL}/v2/cfd/import-from-storage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(180_000),
    })
    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: `Backend returned a non-JSON response (HTTP ${response.status}).` }
    }
    if (!response.ok) return NextResponse.json({ ...(data as object), upstreamStatus: response.status, upstreamPath: '/v2/cfd/import-from-storage' }, { status: response.status })
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error during CFD Storage import.'
    return jsonError(message, 502)
  }
}
