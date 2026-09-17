import type {
  CfdBufferDataset,
  CfdBufferField,
  CfdBufferFrame,
  CfdField,
  CfdFrame,
  CfdVolumeDataset,
} from "./cfd-contract";
import { validateCfdDataset } from "./cfd-validation";

function toFloat32(values: readonly number[]): Float32Array {
  return Float32Array.from(values);
}

function toUint32(values: readonly number[]): Uint32Array {
  return Uint32Array.from(values);
}

function toUint8(values: readonly number[]): Uint8Array {
  return Uint8Array.from(values);
}

function normalizeField(field: CfdField): CfdBufferField {
  return {
    name: field.name,
    association: field.association,
    components: field.components,
    values: toFloat32(field.values),
    unit: field.unit,
    quantity: field.quantity,
  };
}

function normalizeFrame(frame: CfdFrame): CfdBufferFrame {
  const pointData = new Map<string, CfdBufferField>();
  const cellData = new Map<string, CfdBufferField>();
  frame.fields.forEach((field) => {
    const normalized = normalizeField(field);
    (field.association === "point" ? pointData : cellData).set(field.name, normalized);
  });
  return {
    frameId: frame.frameId,
    time: frame.time,
    points: toFloat32(frame.points),
    cells: toUint32(frame.cells),
    offsets: toUint32(frame.offsets),
    cellTypes: toUint8(frame.cellTypes),
    pointData,
    cellData,
  };
}

/**
 * Valide d'abord le contrat complet, puis crée des buffers indépendants du
 * JSON. Le client ne complète jamais un champ absent et ne modifie jamais la
 * topologie reçue.
 */
export function normalizeCfdDataset(dataset: CfdVolumeDataset): CfdBufferDataset {
  const report = validateCfdDataset(dataset);
  if (!report.canRender) {
    const details = report.issues.map((item) => `${item.code}: ${item.message}`).join(" | ");
    throw new Error(`CFD_DATASET_REJECTED_FOR_RENDER: ${details}`);
  }
  return {
    contractVersion: dataset.contractVersion,
    meshRevision: dataset.meshRevision,
    coordinateSystem: dataset.coordinateSystem,
    lengthUnit: dataset.lengthUnit,
    pointCount: dataset.pointCount,
    cellCount: dataset.cellCount,
    frames: dataset.frames.map(normalizeFrame),
    boundarySets: new Map(dataset.boundarySets.map((boundary) => [boundary.name, boundary])),
    provenance: dataset.provenance,
    residuals: dataset.residuals,
    references: dataset.references,
    transientProof: dataset.transientProof,
    evidence: dataset.evidence,
  };
}

export function getField(frame: CfdBufferFrame, name: string): CfdBufferField {
  const field = frame.pointData.get(name) ?? frame.cellData.get(name);
  if (!field) throw new Error(`CFD_FIELD_NOT_FOUND: ${name}`);
  return field;
}

export function getScalarField(frame: CfdBufferFrame, name: string): CfdBufferField {
  const field = getField(frame, name);
  if (field.components !== 1) throw new Error(`CFD_SCALAR_FIELD_REQUIRED: ${name}`);
  return field;
}

export function interpolateFrame(
  frameA: CfdBufferFrame,
  frameB: CfdBufferFrame,
  alpha: number,
): CfdBufferFrame {
  if (frameA.points.length !== frameB.points.length || frameA.cells.length !== frameB.cells.length) {
    throw new Error("CFD_TOPOLOGY_CHANGED_BETWEEN_FRAMES");
  }
  const t = Math.max(0, Math.min(1, alpha));
  const points = new Float32Array(frameA.points.length);
  for (let i = 0; i < points.length; i += 1) points[i] = frameA.points[i] * (1 - t) + frameB.points[i] * t;

  const interpolateFields = (a: Map<string, CfdBufferField>, b: Map<string, CfdBufferField>) => {
    const result = new Map<string, CfdBufferField>();
    for (const [name, fieldA] of a) {
      const fieldB = b.get(name);
      if (!fieldB || fieldA.values.length !== fieldB.values.length || fieldA.components !== fieldB.components) {
        throw new Error(`CFD_FIELD_SCHEMA_CHANGED_BETWEEN_FRAMES: ${name}`);
      }
      const values = new Float32Array(fieldA.values.length);
      for (let i = 0; i < values.length; i += 1) values[i] = fieldA.values[i] * (1 - t) + fieldB.values[i] * t;
      result.set(name, { ...fieldA, values });
    }
    return result;
  };

  return {
    frameId: `${frameA.frameId}:${frameB.frameId}:${t}`,
    time: frameA.time * (1 - t) + frameB.time * t,
    points,
    cells: frameA.cells,
    offsets: frameA.offsets,
    cellTypes: frameA.cellTypes,
    pointData: interpolateFields(frameA.pointData, frameB.pointData),
    cellData: interpolateFields(frameA.cellData, frameB.cellData),
  };
}
