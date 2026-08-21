import type { ScenarioType } from '@/types/simulation-scenarios'

/**
 * Surfaces tessellées depuis les STEP AP242 par Open CASCADE.
 * Les chemins sont des assets versionnés du frontend ; aucun volume paramétrique
 * de remplacement n'est utilisé lorsqu'un scénario industriel est sélectionné.
 */
export function getScenarioCadAssetUrl(scenarioType?: string | null, evidence: unknown[] = []): string | undefined {
  const evidenceText = [scenarioType, ...evidence]
    .flatMap((value) => typeof value === 'string' ? [value] : [])
    .join(' ')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
  if (evidenceText.includes('HEAVY_DUTY_HYDROGEN_REFUELING') || evidenceText.includes('RAVITAILLEMENT HYDROGENE POIDS LOURDS') || evidenceText.includes('HEAVY DUTY REFUEL')) {
    return '/cad/HEAVY_DUTY_HYDROGEN_REFUELING/geometry.glb'
  }
  if (evidenceText.includes('LH2_LARGE_SCALE_STORAGE_1250M3') || (evidenceText.includes('STOCKAGE LH2') && evidenceText.includes('1250'))) {
    return '/cad/LH2_LARGE_SCALE_STORAGE_1250M3/geometry.glb'
  }
  if (evidenceText.includes('DEEP_MINING_BLOCK') || evidenceText.includes('BLOC MINIER')) {
    return '/cad/DEEP_MINING_BLOCK/geometry.glb'
  }
  if (evidenceText.includes('FPGA_HEATSINK') || evidenceText.includes('DISSIPATEUR FPGA')) {
    return '/cad/FPGA_HEATSINK/geometry.glb'
  }
  switch (scenarioType) {
    case 'HEAVY_DUTY_HYDROGEN_REFUELING':
      return '/cad/HEAVY_DUTY_HYDROGEN_REFUELING/geometry.glb'
    case 'LH2_LARGE_SCALE_STORAGE_1250M3':
      return '/cad/LH2_LARGE_SCALE_STORAGE_1250M3/geometry.glb'
    case 'DEEP_MINING_BLOCK':
      return '/cad/DEEP_MINING_BLOCK/geometry.glb'
    case 'FPGA_HEATSINK':
      return '/cad/FPGA_HEATSINK/geometry.glb'
    default:
      return undefined
  }
}

// Les assets canoniques DN50 et LH2 du manifeste ont été mesurés en millimètres
// (2550 mm et 13460 mm). Les assets Deep Mining et FPGA sont déjà en mètres.
const GLB_LENGTH_UNITS: Record<string, "m" | "mm"> = {
  HEAVY_DUTY_HYDROGEN_REFUELING: "mm",
  LH2_LARGE_SCALE_STORAGE_1250M3: "mm",
  DEEP_MINING_BLOCK: "m",
  FPGA_HEATSINK: "m",
}

export function getScenarioCadUnitScale(scenarioType?: string | null): number {
  return GLB_LENGTH_UNITS[scenarioType ?? ""] === "mm" ? 1e-3 : 1
}

export const CAD_ASSET_SHA256: Record<string, string> = {
  '/cad/HEAVY_DUTY_HYDROGEN_REFUELING/geometry.glb': '390120e618696d355ba4eb4aa56bfbc0ca22beb2d1bbb3ec2399cc66206f1eb9',
  '/cad/LH2_LARGE_SCALE_STORAGE_1250M3/geometry.glb': '780bfe480ff8ec975170c3ee164079cd23721551bd873b409aa1776e67ec80e3',
  '/cad/DEEP_MINING_BLOCK/geometry.glb': 'eed8af34114d80b31dd07945f686edfd7361cb6816deff048df39c50b1e8e42e',
  '/cad/FPGA_HEATSINK/geometry.glb': 'bec40c51207fd907a888aada3718118bdfe746146ba7e50bdabea426cec9ef05',
}
