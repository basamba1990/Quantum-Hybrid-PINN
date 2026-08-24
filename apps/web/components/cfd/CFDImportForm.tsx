'use client'

import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { UploadCloud, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export type CfdImportResponse = {
  analysisId?: string
  datasetId?: string
  projectId?: string
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

const MAX_FILE_BYTES = 100 * 1024 * 1024

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
      setError(`Fichier VTU refusé : ${invalid.name}. Extension .vtu et taille maximale de 100 MB requises.`)
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
      setError('Sidecar refusé : fichier JSON non vide de 100 MB maximum requis.')
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
      setError('Renseignez d’abord l’identifiant du projet/scénario.')
      return
    }
    if (!vtuFiles.length || !sidecar) {
      setError('Sélectionnez au moins une frame VTU et son sidecar JSON.')
      return
    }
    if (totalBytes > MAX_FILE_BYTES) {
      setError('La taille totale de l’upload dépasse 100 MB.')
      return
    }

    setBusy(true)
    let ensuredProjectId = projectId
    try {
      ensuredProjectId = ensuredProjectId ?? await onBeforeImport?.()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Impossible de créer le projet avant l’import CFD.'
      setError(message)
      toast.error(message)
      setBusy(false)
      return
    }
    if (!ensuredProjectId) {
      setError('Le projet doit être créé avant la persistance du dataset CFD.')
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
        throw new Error(payload.error || payload.detail || `Import refusé (HTTP ${response.status}).`)
      }
      setResult(payload)
      onImported?.(payload)
      toast.success(`Dataset importé : ${payload.analysisId ?? 'identifiant indisponible'}`)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Échec de l’import CFD.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="form" aria-label="Importer un artefact CFD" className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-start gap-3">
        <UploadCloud className="mt-0.5 h-5 w-5 text-cyan-300" />
        <div>
          <h2 className="font-semibold text-white">Importer un artefact CFD</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Le serveur calcule les SHA-256, lit la connectivité et refuse toute unité ou preuve absente.
            L’import ne crée jamais une certification scientifique.
          </p>
        </div>
      </div>

      <label className="block text-sm text-slate-300">
        Frames VTU
        <input className="mt-2 block w-full text-sm text-slate-300" type="file" accept=".vtu" multiple onChange={selectVtu} disabled={busy} />
        <span className="mt-1 block text-xs text-slate-500">{vtuFiles.length ? `${vtuFiles.length} frame(s) sélectionnée(s)` : 'Même topologie exigée pour toutes les frames'}</span>
      </label>

      <label className="block text-sm text-slate-300">
        Sidecar du contrat
        <input className="mt-2 block w-full text-sm text-slate-300" type="file" accept="application/json,.json" onChange={selectSidecar} disabled={busy} />
        <span className="mt-1 block text-xs text-slate-500">Le sidecar doit déclarer les hashes exacts de chaque frame.</span>
      </label>

      <div className="flex items-start gap-2 border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Un dataset synthétique reste `STRUCTURAL_TEST_UNVALIDATED`, même si son maillage est lisible.</span>
      </div>

      <button type="button" onClick={() => void submit()} disabled={busy || !caseId.trim() || !vtuFiles.length || !sidecar} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
        <UploadCloud className="h-4 w-4" />
        {busy ? 'Vérification et persistance…' : 'Importer et vérifier'}
      </button>

      {error && <div role="alert" className="flex items-start gap-2 border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {result && <div className="space-y-1 border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Import confirmé — statut {result.status}</div><div>Analysis ID : <code>{result.analysisId}</code></div><div>Mesh revision : <code>{result.meshRevision}</code></div><div>{result.pointCount} points · {result.cellCount} cellules · {result.frameCount} frame(s)</div></div>}
    </div>
  )
}
