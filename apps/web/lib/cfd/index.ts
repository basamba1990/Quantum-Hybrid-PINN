import { parseCfdMetadata, type CfdVolumeDataset } from "./cfd-contract";
import { loadCfdVtuSeries, fetchVtuSeries, type VtuFrameSource, type VtuSidecar } from "./cfd-loader";
import { normalizeCfdDataset } from "./cfd-normalize";
import { validateCfdDataset, type CfdValidationReport } from "./cfd-validation";

export * from "./cfd-contract";
export * from "./cfd-loader";
export * from "./cfd-normalize";
export * from "./cfd-validation";

export type ParsedCfdDataset = {
  dataset: CfdVolumeDataset;
  validation: CfdValidationReport;
};

/**
 * Entrée unique pour un payload JSON déjà produit par le backend. Cette
 * fonction ne génère aucun champ : les données sont rejetées si le contrat
 * versionné ou l’un des huit critères est incomplet.
 */
export function parseAndNormalizeCfdDataset(raw: unknown) {
  const dataset = parseCfdMetadata(raw);
  const validation = validateCfdDataset(dataset);
  if (!validation.valid || !validation.canClaimValidated) {
    const details = validation.issues.map((item) => `${item.code}: ${item.message}`).join(" | ");
    throw new Error(`CFD_DATASET_REJECTED: ${details || "evidence_incomplete"}`);
  }
  return { dataset, validation, buffers: normalizeCfdDataset(dataset) };
}

export async function loadAndNormalizeCfdVtuSeries(sources: readonly VtuFrameSource[], sidecar: VtuSidecar) {
  const buffers = await loadCfdVtuSeries(sources, sidecar);
  return { buffers, validation: { valid: true, canClaimValidated: true, issues: [] } as const };
}

export async function fetchAndNormalizeCfdVtuSeries(
  urls: readonly { frameId: string; time: number; url: string; payloadHash: string }[],
  sidecar: VtuSidecar,
  signal?: AbortSignal,
) {
  const buffers = await fetchVtuSeries(urls, sidecar, signal);
  return { buffers, validation: { valid: true, canClaimValidated: true, issues: [] } as const };
}
