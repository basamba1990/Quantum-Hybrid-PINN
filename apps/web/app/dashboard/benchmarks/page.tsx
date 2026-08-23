'use client'

import Link from 'next/link'
import CFDViewer from '@/components/cfd/CFDViewer'
import { loadCertifiedCfdDataset } from '@/lib/cfd/cfd-repository'

export default function IndustrialBenchmarksPage() {
  const loaded = loadCertifiedCfdDataset(null)

  return (
    <main className="min-h-screen bg-[#020617] p-8 text-slate-200">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-white/10 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-blue-400">CFD contract validation</p>
          <h1 className="mt-3 text-4xl font-black text-white">Benchmarks fondés sur artefacts</h1>
          <p className="mt-3 max-w-3xl text-slate-400">
            Cette page ne génère aucune donnée et ne simule aucun solveur. Elle affiche uniquement un dataset cfd-volume.v1 réellement fourni par le repository CFD.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-4 border border-white/10 bg-slate-900/40 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">État de l’artefact</h2>
            <p className="text-sm text-amber-400">{loaded.dataset ? 'Dataset chargé' : 'Aucun dataset CFD chargé'}</p>
            <p className="text-xs text-slate-400">
              Les résidus, métriques de maillage et statuts de certification ne sont jamais fabriqués par cette page.
            </p>
            <Link href="/dashboard/projects/new" className="inline-flex border border-blue-400/40 px-4 py-2 text-sm text-blue-300">
              Importer un artefact CFD
            </Link>
          </div>
          <CFDViewer dataset={loaded.buffers} className="min-h-[600px]" />
        </section>
      </div>
    </main>
  )
}
