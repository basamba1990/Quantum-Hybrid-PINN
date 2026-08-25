import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ analysisId: string }> }

const BACKEND_URL = (
  process.env.CFD_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.H2_INFERENCE_API_URL ||
  ''
).replace(/\/$/, '')

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!BACKEND_URL) {
    return NextResponse.json({ error: 'URL du backend CFD non configurée.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Session Supabase absente ou expirée.' }, { status: 401 })
  }

  const { analysisId } = await context.params
  if (!/^[0-9a-fA-F-]{36}$/.test(analysisId)) {
    return NextResponse.json({ error: 'analysisId CFD invalide.' }, { status: 422 })
  }

  const apiToken = process.env.CFD_IMPORT_API_TOKEN
  if (!apiToken) {
    return NextResponse.json({ error: 'CFD_IMPORT_API_TOKEN absent côté serveur.' }, { status: 503 })
  }

  try {
    const response = await fetch(`${BACKEND_URL}/v2/cfd/${encodeURIComponent(analysisId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => ({ error: 'Réponse backend non JSON.' }))
    if (!response.ok && typeof payload === 'object' && payload !== null) {
      return NextResponse.json(
        { ...payload, upstreamStatus: response.status, upstreamPath: `/v2/cfd/${analysisId}` },
        { status: response.status },
      )
    }
    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur réseau lors de la lecture du dataset CFD.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
