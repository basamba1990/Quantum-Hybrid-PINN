import { z } from "zod";

export const CFD_CONTRACT_VERSION = "cfd-volume.v1" as const;

const nonEmpty = z.string().trim().min(1);
const sha256 = z.string().regex(/^[a-fA-F0-9]{64}$/, "SHA-256 attendu");
const finiteNumber = z.number().finite();
const nullableFiniteNumber = finiteNumber.nullable().optional();

export const CfdFieldSchema = z.object({
  name: nonEmpty,
  association: z.enum(["point", "cell"]),
  components: z.number().int().min(1),
  values: z.array(finiteNumber).min(1),
  unit: nonEmpty,
  quantity: nonEmpty,
});

export const CfdBoundarySetSchema = z.object({
  name: nonEmpty,
  association: z.enum(["point", "cell"]),
  indices: z.array(z.number().int().nonnegative()).min(1),
});

export const CfdFrameSchema = z.object({
  frameId: nonEmpty,
  time: finiteNumber,
  points: z.array(finiteNumber).min(3),
  cells: z.array(z.number().int().nonnegative()).min(1),
  offsets: z.array(z.number().int().nonnegative()).min(2),
  cellTypes: z.array(z.number().int().min(0).max(255)).min(1),
  fields: z.array(CfdFieldSchema).min(1),
});

export const CfdProvenanceSchema = z.object({
  solver: nonEmpty,
  solverVersion: nonEmpty,
  sourceUri: nonEmpty,
  sourceHash: sha256,
  calculationId: nonEmpty,
  generatedAt: z.string().datetime({ offset: true }),
});

/**
 * Les résidus peuvent être absents pour un artefact de rendu structurel.
 * Une valeur nulle signifie explicitement « non calculé / non certifié » ;
 * elle n’est jamais convertie en zéro ni en métrique synthétique.
 */
export const CfdResidualSchema = z.object({
  mass: nullableFiniteNumber,
  momentum: nullableFiniteNumber,
  energy: nullableFiniteNumber,
  norm: z.enum(["L1", "L2", "Linf"]).nullable().optional(),
  computedBy: nonEmpty.nullable().optional(),
  computedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const CfdReferenceSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  uri: z.string().url(),
  variables: z.array(nonEmpty).min(1),
  comparisonHash: sha256,
});

/**
 * Les huit critères sont intentionnellement explicites. Aucun score n’est
 * calculé à partir du nombre de points et aucun champ absent n’est complété.
 */
export const CfdEvidenceSchema = z.object({
  meshGeometryAndTopology: z.boolean(),
  fieldsAndUnits: z.boolean(),
  namedBoundaries: z.boolean(),
  solverProvenance: z.boolean(),
  solverResiduals: z.boolean(),
  referenceComparison: z.boolean(),
  immutableHashes: z.boolean(),
  calculatedTransientStates: z.boolean(),
});

export const CfdVolumeDatasetSchema = z.object({
  contractVersion: z.literal(CFD_CONTRACT_VERSION),
  meshRevision: nonEmpty,
  coordinateSystem: nonEmpty,
  lengthUnit: nonEmpty,
  pointCount: z.number().int().positive(),
  cellCount: z.number().int().positive(),
  frames: z.array(CfdFrameSchema).min(1),
  boundarySets: z.array(CfdBoundarySetSchema).min(1),
  provenance: CfdProvenanceSchema,
  residuals: CfdResidualSchema.optional(),
  references: z.array(CfdReferenceSchema).min(1),
  evidence: CfdEvidenceSchema,
});

export type CfdField = z.infer<typeof CfdFieldSchema>;
export type CfdBoundarySet = z.infer<typeof CfdBoundarySetSchema>;
export type CfdFrame = z.infer<typeof CfdFrameSchema>;
export type CfdVolumeDataset = z.infer<typeof CfdVolumeDatasetSchema>;
export type CfdEvidence = z.infer<typeof CfdEvidenceSchema>;

export type CfdBufferField = {
  name: string;
  association: "point" | "cell";
  components: number;
  values: Float32Array;
  unit: string;
  quantity: string;
};

export type CfdBufferFrame = {
  frameId: string;
  time: number;
  points: Float32Array;
  cells: Uint32Array;
  offsets: Uint32Array;
  cellTypes: Uint8Array;
  pointData: Map<string, CfdBufferField>;
  cellData: Map<string, CfdBufferField>;
};

export type CfdBufferDataset = {
  contractVersion: typeof CFD_CONTRACT_VERSION;
  meshRevision: string;
  coordinateSystem: string;
  lengthUnit: string;
  pointCount: number;
  cellCount: number;
  frames: CfdBufferFrame[];
  boundarySets: Map<string, CfdBoundarySet>;
  provenance: CfdVolumeDataset["provenance"];
  residuals?: CfdVolumeDataset["residuals"];
  references: CfdVolumeDataset["references"];
  evidence: CfdEvidence;
};

export type CfdLoadSource = {
  /** Sidecar metadata is mandatory for a validated dataset. */
  metadata: unknown;
  /** SHA-256 of the exact mesh/result payload, supplied by the producer. */
  payloadHash?: string;
};

export function parseCfdMetadata(input: unknown): CfdVolumeDataset {
  return CfdVolumeDatasetSchema.parse(input);
}
