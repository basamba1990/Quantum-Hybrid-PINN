import { parseRecord } from "@/lib/visualization-data";
import { parseCfdMetadata } from "./cfd-contract";
import { normalizeCfdDataset } from "./cfd-normalize";
import { validateCfdDataset } from "./cfd-validation";

export function loadCertifiedCfdDataset(analysis: unknown, result?: unknown) {
  const analysisRecord = parseRecord(analysis);
  const resultRecord = parseRecord(result);
  const storedResults = parseRecord(analysisRecord.results);
  const raw = resultRecord.cfd_dataset ?? analysisRecord.cfd_dataset ?? storedResults.cfd_dataset;
  if (raw === undefined || raw === null) return { dataset: null, buffers: null, report: null } as const;
  try {
    const dataset = parseCfdMetadata(raw);
    const report = validateCfdDataset(dataset);
    if (!report.valid || !report.canClaimValidated) return { dataset, buffers: null, report } as const;
    return { dataset, buffers: normalizeCfdDataset(dataset), report } as const;
  } catch (error) {
    return { dataset: null, buffers: null, report: { valid: false, canClaimValidated: false, hasRealTransientStates: false, issues: [{ code: "CONTRACT_INVALID", message: error instanceof Error ? error.message : "Contrat CFD illisible" }] } } as const;
  }
}
