import type { ScenarioType } from '@/types/simulation-scenarios'

/**
 * Surfaces tessellées depuis les STEP AP242 par Open CASCADE.
 * Les chemins sont des assets versionnés du frontend ; aucun volume paramétrique
 * de remplacement n'est utilisé lorsqu'un scénario industriel est sélectionné.
 */
export function getScenarioCadAssetUrl(scenarioType?: string | null): string | undefined {
  switch (scenarioType) {
    case 'HEAVY_DUTY_HYDROGEN_REFUELING':
      return '/cad/HEAVY_DUTY_HYDROGEN_REFUELING/geometry.glb'
    case 'LH2_LARGE_SCALE_STORAGE_1250M3':
      return '/cad/LH2_LARGE_SCALE_STORAGE_1250M3/geometry.glb'
    default:
      return undefined
  }
}

export const CAD_ASSET_SHA256: Record<string, string> = {
  '/cad/HEAVY_DUTY_HYDROGEN_REFUELING/geometry.glb': '390120e618696d355ba4eb4aa56bfbc0ca22beb2d1bbb3ec2399cc66206f1eb9',
  '/cad/LH2_LARGE_SCALE_STORAGE_1250M3/geometry.glb': '780bfe480ff8ec975170c3ee164079cd23721551bd873b409aa1776e67ec80e3',
}
