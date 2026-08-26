'use client'

import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { UploadCloud, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export type CfdImportResponse = {
  analysisId?: string
  analysis_id?: string
  datasetId?: string
  dataset_id?: string
  projectId?: string
  project_id?: string
  meshRevision?: string
  pointCount?: number
  cellCount?: number
  frameCount?: number
  status?: string
  artifactHashes?: { sidecar: string; frames: Record<string, string> }
  error?: string
  detail?: string
}

type Props = {
  caseId: string
  projectId?: string
  onBeforeImport?: () => Promise<string>
  onImported?: (result: CfdImportResponse) => void
}

const MAX_FILE_BYTES = 50 * 1024 * 1024

export function CFDImportForm({ caseId, projectId, onBeforeImport, onImported }: Props) {
  const [vtuFiles, setVtuFiles] = useState<File[]>([])
  const [sidecar, setSidecar] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CfdImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalBytes = useMemo(
    () => vtuFiles.reduce((sum, file) => sum + file.size, 0) + (sidecar?.size ?? 0),
    [vtuFiles, sidecar],
  )

  function selectVtu(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const invalid = files.find(
      file => !file.name.toLowerCase().endsWith('.vtu') || file.size === 0 || file.size > MAX_FILE_BYTES,
    )
    if (invalid) {
      setError(`VTU file rejected: ${invalid.name}. A .vtu extension and a maximum size of 50 MiB are required.`)
      setVtuFiles([])
      return
    }
    setError(null)
    setResult(null)
    setVtuFiles(files)
  }

  function selectSidecar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json') || file.size === 0 || file.size > MAX_FILE_BYTES) {
      setError('Sidecar rejected: a non-empty JSON file of 50 MiB maximum is required.')
      setSidecar(null)
      return
    }
    setError(null)
    setResult(null)
    setSidecar(file)
  }

  async function submit() {
    setError(null)
    setResult(null)
    if (!caseId.trim()) {
      setError('Enter the project or scenario identifier first.')
      return
    }
    if (!vtuFiles.length || !sidecar) {
      setError('Select at least one VTU frame and its JSON sidecar.')
      return
    }
    if (totalBytes > MAX_FILE_BYTES) {
      setError('The total upload size exceeds 50 MiB.')
      return
    }

    setBusy(true)
    let ensuredProjectId = projectId
    try {
      ensuredProjectId = ensuredProjectId ?? await onBeforeImport?.()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to create the project before CFD import.'
      setError(message)
      toast.error(message)
      setBusy(false)
      return
    }
    if (!ensuredProjectId) {
      setError('The project must be created before the CFD dataset can be persisted.')
      setBusy(false)
      return
    }

    const formData = new FormData()
    for (const file of vtuFiles) formData.append('vtu_files', file, file.name)
    formData.append('sidecar', sidecar, sidecar.name)
    formData.append('case_id', caseId)
    formData.append('project_id', ensuredProjectId)
    try {
      const response = await fetch('/api/cfd/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const payload = await response.json() as CfdImportResponse
      if (!response.ok) {
        throw new Error(payload.error || payload.detail || `Import rejected (HTTP ${response.status}).`)
      }
      const normalizedPayload: CfdImportResponse = {
        ...payload,
        analysisId: payload.analysisId ?? payload.analysis_id,
        datasetId: payload.datasetId ?? payload.dataset_id,
        projectId: payload.projectId ?? payload.project_id,
      }
      setResult(normalizedPayload)
      onImported?.(normalizedPayload)
      toast.success(`Dataset imported: ${normalizedPayload.analysisId ?? 'identifier unavailable'}`)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'CFD import failed.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="form" aria-label="Import a CFD artifact" className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-start gap-3">
        <UploadCloud className="mt-0.5 h-5 w-5 text-cyan-300" />
        <div>
          <h2 className="font-semibold text-white">Import a CFD artifact</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            The server computes SHA-256 hashes, reads cell connectivity and rejects missing units or evidence.
            Import never creates scientific certification.
          </p>
        </div>
      </div>

      <label className="block text-sm text-slate-300">
        Frames VTU
        <input className="mt-2 block w-full text-sm text-slate-300" type="file" accept=".vtu" multiple onChange={selectVtu} disabled={busy} />
        <span className="mt-1 block text-xs text-slate-500">{vtuFiles.length ? `${vtuFiles.length} frame(s) selected` : 'The same topology is required for every frame'}</span>
      </label>

      <label className="block text-sm text-slate-300">
        Contract sidecar
        <input className="mt-2 block w-full text-sm text-slate-300" type="file" accept="application/json,.json" onChange={selectSidecar} disabled={busy} />
        <span className="mt-1 block text-xs text-slate-500">The sidecar must declare the exact hash of every frame.</span>
      </label>

      <div className="flex items-start gap-2 border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>A synthetic dataset remains `STRUCTURAL_TEST_UNVALIDATED`, even when its mesh is readable.</span>
      </div>

      <button type="button" onClick={() => void submit()} disabled={busy || !caseId.trim() || !vtuFiles.length || !sidecar} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
        <UploadCloud className="h-4 w-4" />
        {busy ? 'Verifying and persisting…' : 'Import and verify'}
      </button>

      {error && <div role="alert" className="flex items-start gap-2 border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {result && <div className="space-y-1 border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Import confirmed — status {result.status}</div><div>Analysis ID : <code>{result.analysisId}</code></div><div>Mesh revision : <code>{result.meshRevision}</code></div><div>{result.pointCount} points · ${result.cellCount} cells · ${result.frameCount} frame(s)</div></div>}
    </div>
  )
}
