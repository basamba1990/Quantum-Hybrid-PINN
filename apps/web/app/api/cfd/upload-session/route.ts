import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = (process.env.CFD_ARTIFACT_BUCKET || 'cfd-artifacts').trim()
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_BYTES = 50 * 1024 * 1024
const MAX_FILES = 32

type FileSpec = { name: string; size: number; contentType?: string }

type RequestBody = {
  caseId?: unknown
  projectId?: unknown
  files?: unknown
  sidecar?: unknown
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function validateFile(value: unknown, extension: '.vtu' | '.json'): FileSpec | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.name !== 'string' || !SAFE_NAME.test(item.name)) return null
  if (!item.name.toLowerCase().endsWith(extension)) return null
  if (typeof item.size !== 'number' || !Number.isSafeInteger(item.size) || item.size <= 0 || item.size > MAX_BYTES) return null
  return { name: item.name, size: item.size, contentType: typeof item.contentType === 'string' ? item.contentType : undefined }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return jsonError('Session Supabase absente ou expirée.', 401)

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return jsonError('JSON de session d’upload invalide.', 400)
  }

  const caseId = typeof body.caseId === 'string' ? body.caseId.trim() : ''
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  if (!caseId || caseId.length > 160) return jsonError('caseId invalide.', 400)
  if (!UUID.test(projectId)) return jsonError('projectId doit être un UUID valide.', 400)

  const rawFiles = Array.isArray(body.files) ? body.files : []
  if (rawFiles.length === 0 || rawFiles.length > MAX_FILES) return jsonError('Nombre de frames VTU invalide.', 400)
  const parsedFiles = rawFiles.map((file) => validateFile(file, '.vtu'))
  const sidecar = validateFile(body.sidecar, '.json')
  if (parsedFiles.some(file => file === null) || !sidecar) return jsonError('Noms, extensions ou tailles de fichiers invalides.', 400)
  const files = parsedFiles.filter((file): file is FileSpec => file !== null)
  if (new Set(files.map(file => file.name)).size !== files.length) return jsonError('Noms de frames dupliqués.', 409)

  const admin = createAdminClient()
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (projectError) return jsonError(`Vérification du projet échouée: ${projectError.message}`, 502)
  if (!project) return jsonError('Projet absent ou non accessible par l’utilisateur connecté.', 404)

  const sessionId = crypto.randomUUID()
  const prefix = `${user.id}/${caseId}/${sessionId}`
  const specs = [...files, sidecar]
  const uploads: Array<{ role: 'frame' | 'sidecar'; name: string; path: string; signedUrl: string; token: string; size: number }> = []
  for (const file of specs) {
    const role = file === sidecar ? 'sidecar' : 'frame'
    const path = `${prefix}/${file.name}`
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false })
    if (error || !data?.token || !data.signedUrl) return jsonError(`Signature d’upload impossible pour ${file.name}: ${error?.message ?? 'réponse incomplète'}`, 502)
    uploads.push({ role, name: file.name, path: data.path, signedUrl: data.signedUrl, token: data.token, size: file.size })
  }

  return NextResponse.json({ sessionId, bucket: BUCKET, projectId, caseId, uploads }, { status: 201 })
}
