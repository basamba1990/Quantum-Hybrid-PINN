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
  return NextResponse.json({ error, code: status === 502 ? 'CFD_IMPORT_UPSTREAM_UNAVAILABLE' : 'CFD_IMPORT_REQUEST_INVALID' }, { status })
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
  const analysisId = typeof incoming.analysisId === 'string' ? incoming.analysisId.trim() : ''
  const sessionId = typeof incoming.sessionId === 'string' ? incoming.sessionId.trim() : ''
  const bucket = typeof incoming.bucket === 'string' ? incoming.bucket.trim() : ''
  if (!caseId || !projectId || !sessionId || !bucket || !files.length || !sidecar) {
    return jsonError('caseId, projectId, sessionId, bucket, files[] and sidecar are required.', 400)
  }

  const payload = {
    case_id: caseId,
    project_id: projectId,
    ...(analysisId ? { analysis_id: analysisId } : {}),
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
      data = {
        error: `Le backend CFD a renvoyé une réponse non JSON (HTTP ${response.status}).`,
        code: response.status === 502 || response.status === 503 || response.status === 504
          ? 'CFD_IMPORT_WORKER_UNAVAILABLE'
          : 'CFD_IMPORT_INVALID_UPSTREAM_RESPONSE',
      }
    }
    if (!response.ok) {
      const objectData = data && typeof data === 'object' ? data as Record<string, unknown> : {}
      const detail = objectData.detail
      const normalized = objectData.error
        ? objectData
        : {
            ...objectData,
            error: typeof detail === 'string'
              ? detail
              : detail && typeof detail === 'object' && typeof (detail as Record<string, unknown>).message === 'string'
                ? String((detail as Record<string, unknown>).message)
                : `Échec de l’import CFD (HTTP ${response.status}).`,
            code: detail && typeof detail === 'object' && typeof (detail as Record<string, unknown>).code === 'string'
              ? String((detail as Record<string, unknown>).code)
              : objectData.code || 'CFD_IMPORT_UPSTREAM_ERROR',
          }
      return NextResponse.json({ ...normalized, upstreamStatus: response.status, upstreamPath: '/v2/cfd/import-from-storage' }, { status: response.status })
    }
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error during CFD Storage import.'
    return NextResponse.json({
      error: `Le worker d’import CFD n’a pas répondu: ${message}`,
      code: 'CFD_IMPORT_WORKER_UNAVAILABLE',
    }, { status: 502 })
  }
}
