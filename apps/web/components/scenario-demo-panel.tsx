'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const DEMO_CONFIG: Record<string, {
  title: string
  subtitle: string
  color: string
  parameters: Array<[string, string]>
  stages: string[]
}> = {
  LH2_TANK_THERMO_MULTIPHASE_V1: {
    title: 'Réservoir LH₂ — démonstration d’interface',
    subtitle: 'Le schéma et les paramètres sont visualisables. Aucun champ CFD n’est prétendu validé.',
    color: 'cyan',
    parameters: [
      ['Volume', '50 L'],
      ['Remplissage', '50 %'],
      ['Isolation', '10 / 20 / 30 mm'],
      ['Modèle', 'VOF · CSF · Ranz–Marshall'],
      ['Température initiale', '20,268 K'],
      ['Maillage de référence', '≈ 40 000 cellules'],
    ],
    stages: ['Contrat', 'Géométrie', 'Maillage VOF', 'Champs transitoires', 'Validation indépendante'],
  },
  PCCV_TRANSIENT_THERMO_V1: {
    title: 'Vanne cinq voies — démonstration d’interface',
    subtitle: 'La trajectoire et les artefacts attendus sont visualisables. Aucun résultat de vanne n’est prétendu calculé.',
    color: 'violet',
    parameters: [
      ['Type', 'Transitoire thermo-hydraulique'],
      ['Mobilité', 'Grille mobile'],
      ['Entrées', 'Cinq ports'],
      ['Champs attendus', 'u · p · T'],
      ['Validation', 'CFD indépendante / banc'],
      ['Statut', 'Oracle requis'],
    ],
    stages: ['Contrat', 'CAO', 'Grille mobile', 'Champs transitoires', 'Validation indépendante'],
  },
}

export function ScenarioDemoPanel({ scenarioType }: { scenarioType?: string | null }) {
  const config = scenarioType ? DEMO_CONFIG[scenarioType] : undefined
  if (!config) return null
  const accent = config.color === 'cyan' ? 'border-cyan-400/30 text-cyan-100' : 'border-violet-400/30 text-violet-100'
  const bar = config.color === 'cyan' ? 'bg-cyan-400' : 'bg-violet-400'

  return (
    <Card className={`overflow-hidden border-2 ${accent} bg-slate-950/80`} data-testid={`scenario-demo-${scenarioType}`}>
      <CardHeader className="border-b border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="uppercase italic tracking-tight">{config.title}</CardTitle>
            <p className="mt-2 text-xs text-slate-300">{config.subtitle}</p>
          </div>
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-mono text-[10px] font-bold text-amber-200">
            DEMO_NOT_VALIDATED
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid grid-cols-2 gap-3">
          {config.parameters.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
              <div className="mt-1 text-sm font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-400">
            <span>Pipeline de preuve</span><span>0 / {config.stages.length} gates passées</span>
          </div>
          <div className="space-y-3">
            {config.stages.map((stage, index) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[10px] text-slate-400">{index + 1}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full w-0 ${bar}`} /></div>
                <span className="w-36 text-right text-[10px] text-slate-400">{stage}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100/80">
            Cette vue confirme que le projet et son contrat sont chargés dans le dashboard. Elle ne constitue ni une sortie CFD, ni une validation expérimentale, ni un PASS scientifique.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
