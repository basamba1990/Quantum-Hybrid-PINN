import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BACKEND_URL = (
  process.env.CFD_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.H2_INFERENCE_API_URL ||
  ''
).replace(/\/$/, '')

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  if (!BACKEND_URL) {
    return NextResponse.json({ error: 'URL du backend CFD non configurée.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Session Supabase absente ou expirée.' }, { status: 401 })
  }

  const { analysisId } = await params
  if (!analysisId || !/^[A-Za-z0-9_-]{1,160}$/.test(analysisId)) {
    return NextResponse.json({ error: 'analysisId CFD invalide.' }, { status: 400 })
  }

  const apiToken = process.env.CFD_IMPORT_API_TOKEN
  if (!apiToken) {
    return NextResponse.json(
      { error: 'CFD_IMPORT_API_TOKEN absent côté serveur; lecture G0–G5 désactivée.' },
      { status: 503 },
    )
  }

  try {
    const response = await fetch(`${BACKEND_URL}/v2/cfd/${encodeURIComponent(analysisId)}/gates`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => ({ error: 'Réponse backend non JSON.' }))
    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur réseau lors de la lecture G0–G5.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
