import type { CfdBufferDataset, CfdFrame, CfdVolumeDataset } from "./cfd-contract";

export type CfdValidationCode =
  | "CONTRACT_INVALID"
  | "POINT_BUFFER_INVALID"
  | "CELL_TOPOLOGY_INVALID"
  | "FIELD_ASSOCIATION_INVALID"
  | "BOUNDARY_INVALID"
  | "TIME_SERIES_INVALID"
  | "PROVENANCE_INVALID"
  | "RESIDUALS_INVALID"
  | "REFERENCE_INVALID"
  | "HASH_INVALID";

export type CfdValidationIssue = {
  code: CfdValidationCode;
  message: string;
  path?: string;
};

export type CfdValidationReport = {
  valid: boolean;
  issues: CfdValidationIssue[];
  hasRealTransientStates: boolean;
  /** Les buffers sont sûrs à préparer pour le rendu, même si la certification est bloquée. */
  canRender: boolean;
  canClaimValidated: boolean;
};

function issue(code: CfdValidationCode, message: string, path?: string): CfdValidationIssue {
  return { code, message, path };
}

function isFiniteArray(values: readonly number[]): boolean {
  return values.length > 0 && values.every(Number.isFinite);
}

function validateFrame(frame: CfdFrame, frameIndex: number, pointCount: number, cellCount: number): CfdValidationIssue[] {
  const issues: CfdValidationIssue[] = [];
  const path = `frames[${frameIndex}]`;

  if (frame.points.length !== pointCount * 3 || !isFiniteArray(frame.points)) {
    issues.push(issue("POINT_BUFFER_INVALID", "Le buffer de sommets ne correspond pas à pointCount ou contient des valeurs non finies.", `${path}.points`));
  }
  if (frame.offsets.length !== cellCount + 1 || frame.offsets[0] !== 0) {
    issues.push(issue("CELL_TOPOLOGY_INVALID", "Les offsets ne décrivent pas exactement cellCount cellules.", `${path}.offsets`));
  }
  if (frame.cellTypes.length !== cellCount) {
    issues.push(issue("CELL_TOPOLOGY_INVALID", "Le nombre de types de cellules est différent de cellCount.", `${path}.cellTypes`));
  }
  const lastOffset = frame.offsets[frame.offsets.length - 1];
  if (lastOffset !== frame.cells.length || frame.offsets.some((value, i) => i > 0 && value < frame.offsets[i - 1])) {
    issues.push(issue("CELL_TOPOLOGY_INVALID", "Les offsets ne couvrent pas exactement la connectivité ou ne sont pas monotones.", `${path}.offsets`));
  }
  if (frame.cells.some((index) => index >= pointCount)) {
    issues.push(issue("CELL_TOPOLOGY_INVALID", "La connectivité référence un sommet hors limites.", `${path}.cells`));
  }

  for (const [fieldIndex, field] of frame.fields.entries()) {
    const expected = field.association === "point" ? pointCount : cellCount;
    if (field.values.length !== expected * field.components || !isFiniteArray(field.values)) {
      issues.push(issue("FIELD_ASSOCIATION_INVALID", `Le champ ${field.name} n’a pas la taille attendue pour son association ${field.association}.`, `${path}.fields[${fieldIndex}]`));
    }
    if (!field.unit.trim()) {
      issues.push(issue("FIELD_ASSOCIATION_INVALID", `Le champ ${field.name} ne possède pas d’unité explicite.`, `${path}.fields[${fieldIndex}].unit`));
    }
  }
  return issues;
}

function hasMeasuredTransientDifference(frames: readonly CfdFrame[]): boolean {
  if (frames.length < 2) return false;
  const first = frames[0];
  return frames.slice(1).some((frame) => {
    const firstFields = new Map(first.fields.map((field) => [`${field.association}:${field.name}`, field]));
    return frame.fields.some((field) => {
      const baseline = firstFields.get(`${field.association}:${field.name}`);
      if (!baseline || baseline.components !== field.components || baseline.values.length !== field.values.length) return false;
      return field.values.some((value, index) => Math.abs(value - baseline.values[index]) > 1e-12);
    });
  });
}

function validateTransient(frames: readonly CfdFrame[]): CfdValidationIssue[] {
  const issues: CfdValidationIssue[] = [];
  if (frames.length < 2) {
    issues.push(issue("TIME_SERIES_INVALID", "Au moins deux états calculés sont requis pour une animation PINN-T."));
    return issues;
  }
  for (let i = 1; i < frames.length; i += 1) {
    if (!(frames[i].time > frames[i - 1].time)) {
      issues.push(issue("TIME_SERIES_INVALID", "Les temps des frames doivent être strictement croissants.", `frames[${i}].time`));
    }
    if (frames[i].cells.length !== frames[0].cells.length || frames[i].offsets.length !== frames[0].offsets.length || frames[i].cellTypes.length !== frames[0].cellTypes.length) {
      issues.push(issue("TIME_SERIES_INVALID", "La topologie doit rester identique entre les états transitoires.", `frames[${i}]`));
    }
  }
  if (!hasMeasuredTransientDifference(frames)) {
    issues.push(issue("TIME_SERIES_INVALID", "Les frames existent mais aucune différence spatiale mesurable n’est présente."));
  }
  return issues;
}

export function validateCfdDataset(dataset: CfdVolumeDataset): CfdValidationReport {
  const issues: CfdValidationIssue[] = [];
  if (!dataset.meshRevision.trim() || !dataset.coordinateSystem.trim() || !dataset.lengthUnit.trim()) {
    issues.push(issue("CONTRACT_INVALID", "La révision du maillage, le repère et l’unité de longueur sont obligatoires."));
  }
  if (dataset.frames.length === 0 || dataset.frames.some((frame, i) => validateFrame(frame, i, dataset.pointCount, dataset.cellCount).length > 0)) {
    dataset.frames.forEach((frame, i) => issues.push(...validateFrame(frame, i, dataset.pointCount, dataset.cellCount)));
  }
  if (dataset.boundarySets.length === 0 || dataset.boundarySets.some((boundary) => boundary.indices.length === 0)) {
    issues.push(issue("BOUNDARY_INVALID", "Au moins une frontière nommée avec des indices valides est obligatoire."));
  }
  if (!dataset.provenance.solver || !dataset.provenance.solverVersion || !dataset.provenance.sourceUri || !dataset.provenance.calculationId) {
    issues.push(issue("PROVENANCE_INVALID", "La provenance du calcul est incomplète."));
  }
  if (!Number.isFinite(dataset.residuals.mass) || !Number.isFinite(dataset.residuals.momentum) || !Number.isFinite(dataset.residuals.energy)) {
    issues.push(issue("RESIDUALS_INVALID", "Les résidus mass, momentum et energy doivent être calculés et finis."));
  }
  if (dataset.references.length === 0 || dataset.references.some((reference) => !reference.uri || !reference.comparisonHash)) {
    issues.push(issue("REFERENCE_INVALID", "Une comparaison de référence avec hash doit être persistée."));
  }
  issues.push(...validateTransient(dataset.frames));

  const hasStructuralRenderingIssue = issues.some((item) => [
    "CONTRACT_INVALID",
    "POINT_BUFFER_INVALID",
    "CELL_TOPOLOGY_INVALID",
    "FIELD_ASSOCIATION_INVALID",
    "BOUNDARY_INVALID",
  ].includes(item.code));
  const hasRealTransientStates = !issues.some((item) => item.code === "TIME_SERIES_INVALID");
  return {
    valid: issues.length === 0,
    issues,
    hasRealTransientStates,
    canRender: !hasStructuralRenderingIssue,
    canClaimValidated: issues.length === 0 && Object.values(dataset.evidence).every(Boolean),
  };
}

export function validateCfdBufferDataset(dataset: CfdBufferDataset): CfdValidationReport {
  const issues: CfdValidationIssue[] = [];
  if (!dataset.meshRevision.trim() || !dataset.coordinateSystem.trim() || !dataset.lengthUnit.trim()) issues.push(issue("CONTRACT_INVALID", "Le contrat de buffers ne possède pas de révision, repère ou unité de longueur."));
  if (dataset.frames.length === 0) issues.push(issue("POINT_BUFFER_INVALID", "Aucune frame CFD normalisée n’est disponible."));
  for (const [index, frame] of dataset.frames.entries()) {
    if (frame.points.length !== dataset.pointCount * 3 || frame.points.some((value) => !Number.isFinite(value))) issues.push(issue("POINT_BUFFER_INVALID", "Le buffer de sommets est invalide.", `frames[${index}].points`));
    if (frame.offsets.length !== dataset.cellCount + 1 || frame.offsets[0] !== 0 || frame.offsets[frame.offsets.length - 1] !== frame.cells.length) issues.push(issue("CELL_TOPOLOGY_INVALID", "Les offsets ne couvrent pas la connectivité des cellules.", `frames[${index}].offsets`));
    if (frame.cellTypes.length !== dataset.cellCount || frame.cells.some((value) => value >= dataset.pointCount)) issues.push(issue("CELL_TOPOLOGY_INVALID", "La connectivité ou les types de cellules sont invalides.", `frames[${index}]`));
    for (const field of [...frame.pointData.values(), ...frame.cellData.values()]) if (!field.unit.trim() || field.values.some((value) => !Number.isFinite(value))) issues.push(issue("FIELD_ASSOCIATION_INVALID", `Le champ ${field.name} possède des valeurs ou une unité invalides.`));
  }
  const hasRealTransientStates = dataset.frames.length > 1 && dataset.frames.slice(1).every((frame, index) => frame.time > dataset.frames[index].time) && dataset.frames.slice(1).some((frame) => frame.points.some((value, index) => Math.abs(value - dataset.frames[0].points[index]) > 1e-12));
  if (!hasRealTransientStates) issues.push(issue("TIME_SERIES_INVALID", "Aucun état transitoire spatialement différent n’est disponible."));
  const hasStructuralRenderingIssue = issues.some((item) => [
    "CONTRACT_INVALID",
    "POINT_BUFFER_INVALID",
    "CELL_TOPOLOGY_INVALID",
    "FIELD_ASSOCIATION_INVALID",
    "BOUNDARY_INVALID",
  ].includes(item.code));
  return {
    valid: issues.length === 0,
    issues,
    hasRealTransientStates,
    canRender: !hasStructuralRenderingIssue,
    canClaimValidated: issues.length === 0 && Object.values(dataset.evidence).every(Boolean),
  };
}

export async function sha256Hex(payload: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function verifyPayloadHash(payload: ArrayBuffer, expectedHash: string): Promise<boolean> {
  if (!/^[a-fA-F0-9]{64}$/.test(expectedHash)) return false;
  const actual = await sha256Hex(payload);
  return actual.toLowerCase() === expectedHash.toLowerCase();
}
