import type { ScenarioType } from '@/types/simulation-scenarios'

/**
 * Retourne l’artefact CAO certifié associé à un scénario.
 *
 * Aucun actif CAO certifié n’est actuellement intégré au dépôt. Les anciens
 * GLB de démonstration ont été retirés et ne doivent pas être remplacés par
 * une URL implicite. Un scénario doit fournir un artefact versionné issu du
 * contrat CFD (`cfd_dataset.geometry`) avant que le viewer ne puisse afficher
 * une CAO comme preuve.
 */
export function getScenarioCadAssetUrl(_scenarioType?: string | null, _evidence: unknown[] = []): string | undefined {
  return undefined
}

/**
 * L’échelle ne peut pas être déduite sans unité provenant du contrat CAO.
 * Le caller doit utiliser l’unité explicitement validée par le dataset CFD.
 */
export function getScenarioCadUnitScale(_scenarioType?: string | null): number | undefined {
  return undefined
}

/**
 * Les hashes des anciens GLB sont volontairement absents : ils ne certifient
 * ni une B-Rep, ni un maillage volumique, ni une provenance industrielle.
 */
export const CAD_ASSET_SHA256: Record<string, never> = {}

export type { ScenarioType }
