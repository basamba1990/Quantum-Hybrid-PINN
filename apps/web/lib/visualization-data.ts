export type VisualizationScenario =
  | "H2_PIPELINE"
  | "LH2_STORAGE"
  | "DEEP_MINING_BLOCK"
  | "ROCK_ELAST_STRESS"
  | "H2_PIPELINE_STRATEGIC"
  | "FPGA_HEATSINK"
  | "PORT_ENERGY_OPTIMIZATION"
  | "PIPELINE_SAFETY"
  | "CRYOGENIC_TRANSPORT"
  | "MINING_INDUSTRIAL_SIM"
  | "H2_COMPRESSION_STATION"
  | "H2_DISTRIBUTION_HIGH_PRESSURE"
  | "LH2_INFRASTRUCTURE_INTEGRITY"
  | "LH2_LARGE_SCALE_STORAGE_1250M3"
  | "HEAVY_DUTY_HYDROGEN_REFUELING"
  | "LH2_TANK_THERMO_MULTIPHASE_V1"
  | "PCCV_TRANSIENT_THERMO_V1";

export interface VisualizationPoint {
  x: number;
  y: number;
  z: number;
  time?: number;
  temperature?: number;
  pressure?: number;
  velocity_magnitude?: number;
  velocity_u?: number;
  velocity_v?: number;
  velocity_w?: number;
  density?: number;
  stress?: number;
  damage?: number;
  von_mises?: number;
  mesh_level?: number;
  [key: string]: number | string | undefined;
}

export interface RefinementZone {
  boundary_name?: string;
  center_m?: [number, number, number];
  radius_m?: number;
  refinement_factor?: number;
  points_added?: number;
}

export interface VisualizationMeshMetadata {
  points?: Array<[number, number, number]>;
  cells?: Array<number[]>;
  cell_types?: string[];
  mesh_revision_id?: string;
  points_count?: number;
  cells_count?: number;
  validated?: boolean;
  refinement_applied?: boolean;
  refinement_zones?: RefinementZone[];
  quality?: Record<string, number>;
}

export interface TransientBubble {
  x: number;
  y: number;
  z: number;
  radius: number;
  intensity: number;
  source?: string;
}

export interface TransientLayers {
  danger_mask?: number[] | null;
  vapor_bubbles?: TransientBubble[];
  status?: string;
}

export interface TransientFrame {
  frame: number;
  time: number;
  points: VisualizationPoint[];
  transient_layers?: TransientLayers;
}

export interface TransientSeries {
  scenario_type?: string;
  is_true_transient?: boolean;
  time_unit?: string;
  time_steps?: number[];
  total_frames?: number;
  points_per_frame?: number;
  time_series?: TransientFrame[];
  layer_contract?: Record<string, unknown>;
}

export interface VisualizationMetadata {
  source?: "pinn" | "experimental" | "mixed" | "required_input";
  source_label?: string;
  unit?: string;
  geometry?: Record<string, unknown>;
  discontinuity?: Record<string, unknown>;
  mesh?: VisualizationMeshMetadata;
  fields?: Record<string, { unit?: string; min?: number; max?: number; source?: string }>;
  transient?: TransientSeries;
}

const finite = (value: unknown): number | undefined => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

export const parseRecord = (value: unknown): Record<string, any> => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
};

export const normalizeVisualizationPoints = (value: unknown): VisualizationPoint[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const point = parseRecord(raw);
    const x = finite(point.x);
    const y = finite(point.y);
    const z = finite(point.z);
    if (x === undefined || y === undefined || z === undefined) return [];

    const normalized: VisualizationPoint = { x, y, z };
    const aliases: Record<string, string[]> = {
      time: ["time", "t"],
      temperature: ["temperature", "temp", "T"],
      pressure: ["pressure", "p", "P"],
      velocity_magnitude: ["velocity_magnitude", "velocity", "speed"],
      velocity_u: ["velocity_u", "u"],
      velocity_v: ["velocity_v", "v"],
      velocity_w: ["velocity_w", "w"],
      density: ["density", "rho"],
      stress: ["stress", "von_mises", "sigma_vm"],
      damage: ["damage"],
      von_mises: ["von_mises", "stress", "sigma_vm"],
      shear_stress: ["shear_stress", "tau"],
      mesh_level: ["mesh_level", "refinement_level"],
    };

    for (const [target, candidates] of Object.entries(aliases)) {
      const candidate = candidates.map((key) => finite(point[key])).find((item) => item !== undefined);
      if (candidate !== undefined) normalized[target] = candidate;
    }
    return [normalized];
  });
};

const evidenceText = (evidence: unknown[]): string =>
  evidence
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (value && typeof value === "object") return [JSON.stringify(value)];
      return [];
    })
    .join(" ")
    .toLowerCase();

export const resolveVisualizationScenario = (evidence: unknown[]): VisualizationScenario => {
  const text = evidenceText(evidence);
  if (/lh2[_ -]?tank[_ -]?thermo[_ -]?multiphase|50\s*l.*(tank|reservoir)|vof.*(csf|ranz)/i.test(text)) return "LH2_TANK_THERMO_MULTIPHASE_V1";
  if (/pccv|five[_ -]?way|cinq[_ -]?voies|moving[_ -]?grid|grille[_ -]?mobile/i.test(text)) return "PCCV_TRANSIENT_THERMO_V1";
  if (/(lh2[_ -]?infrastructure|dn50|cryogenic.*(leak|fuite)|discontinuit|trou de fuite|through[_ -]?hole)/i.test(text)) return "LH2_INFRASTRUCTURE_INTEGRITY";
  if (/(heavy[_ -]?duty.*hydrogen.*refuel|heavy.*duty.*refuel|j2601-2|prhyde)/i.test(text)) return "HEAVY_DUTY_HYDROGEN_REFUELING";
  if (/(lh2[_ -]?large[_ -]?scale.*storage|large[_ -]?scale.*storage|1250\s*m3|1250\s*m³)/i.test(text)) return "LH2_LARGE_SCALE_STORAGE_1250M3";
  if (/(fpga|heatsink|dissipateur|thermal management)/i.test(text)) return "FPGA_HEATSINK";
  if (/(deep[_ -]?mining|bloc[_ -]?minier|mine[_ -]?profonde|lithostatic)/i.test(text)) return "DEEP_MINING_BLOCK";
  if (/(70\s*mpa|high.?pressure.*distribution|distribution.*high.?pressure)/i.test(text)) return "H2_DISTRIBUTION_HIGH_PRESSURE";
  if (/(strategic.*pipeline|pipeline.*strategique)/i.test(text)) return "H2_PIPELINE_STRATEGIC";
  if (/(pipeline safety|securite.*pipeline)/i.test(text)) return "PIPELINE_SAFETY";
  if (/(cryogenic transport|transport cryogenique)/i.test(text)) return "CRYOGENIC_TRANSPORT";
  if (/(compression station|station.*compression)/i.test(text)) return "H2_COMPRESSION_STATION";
  if (/(rock|roche|elastic stress|contrainte.*elast)/i.test(text)) return "ROCK_ELAST_STRESS";
  if (/(port energy|optimisation.*portuaire)/i.test(text)) return "PORT_ENERGY_OPTIMIZATION";
  if (/(mining industrial|simulation miniere)/i.test(text)) return "MINING_INDUSTRIAL_SIM";
  if (/(lh2 storage|reservoir.*lh2|stockage.*lh2)/i.test(text)) return "LH2_STORAGE";
  if (/(h2 pipeline|hydrogen pipeline|pipeline)/i.test(text)) return "H2_PIPELINE";
  return "H2_PIPELINE";
};

const validUnit = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const unit = value.trim();
  if (!unit || ["unit_required", "required_input", "unknown", "inconnue", "n/d", "nd"].includes(unit.toLowerCase())) return undefined;
  return unit;
};

const validSource = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const source = value.trim();
  return source.length > 0 ? source : undefined;
};

export const buildVisualizationMetadata = (
  result: Record<string, any>,
  results: Record<string, any>,
  _experimentalPoints: VisualizationPoint[] = [],
  _points: VisualizationPoint[] = [],
): VisualizationMetadata => {
  const extracted = parseRecord(result.extracted_parameters ?? results.extracted_parameters ?? results.extractedData);
  const rawMetadata = parseRecord(result.metadata ?? results.metadata);
  const geometry = parseRecord(result.geometry ?? results.geometry ?? extracted.geometry ?? rawMetadata.geometry);
  const discontinuity = parseRecord(result.discontinuity ?? results.discontinuity ?? extracted.discontinuity ?? extracted.leak ?? rawMetadata.discontinuity);
  const meshRaw = parseRecord(result.mesh ?? results.mesh ?? extracted.mesh ?? rawMetadata.mesh);
  const mesh: VisualizationMeshMetadata | undefined = Object.keys(meshRaw).length
    ? {
        points: Array.isArray(meshRaw.points) ? meshRaw.points : undefined,
        cells: Array.isArray(meshRaw.cells) ? meshRaw.cells : undefined,
        cell_types: Array.isArray(meshRaw.cell_types) ? meshRaw.cell_types : undefined,
        mesh_revision_id: typeof meshRaw.mesh_revision_id === "string" ? meshRaw.mesh_revision_id : undefined,
        points_count: finite(meshRaw.points_count),
        cells_count: finite(meshRaw.cells_count),
        validated: typeof meshRaw.validated === "boolean" ? meshRaw.validated : undefined,
        refinement_applied: typeof meshRaw.refinement_applied === "boolean" ? meshRaw.refinement_applied : undefined,
        refinement_zones: Array.isArray(meshRaw.refinement_zones) ? meshRaw.refinement_zones : undefined,
        quality: meshRaw.quality && typeof meshRaw.quality === "object" ? meshRaw.quality : undefined,
      }
    : undefined;

  const explicitFields = parseRecord(
    result.fields ?? results.fields ?? rawMetadata.fields,
  );
  const scenarioType = resolveVisualizationScenario([result.scenario_type, results.scenario_type]);
  const scenarioDefaults: Record<string, Record<string, string>> = {
    LH2_LARGE_SCALE_STORAGE_1250M3: { temperature: "K", pressure: "MPa", velocity_magnitude: "m/s", stress: "MPa" },
    HEAVY_DUTY_HYDROGEN_REFUELING: { temperature: "K", pressure: "MPa", velocity_magnitude: "m/s", stress: "MPa" },
    FPGA_HEATSINK: { temperature: "K", pressure: "Pa", velocity_magnitude: "m/s", stress: "MPa" },
    DEEP_MINING_BLOCK: { temperature: "K", pressure: "MPa", velocity_magnitude: "m/s", stress: "MPa", shear_stress: "MPa" },
  };

  const fields: NonNullable<VisualizationMetadata["fields"]> = {};
  for (const key of ["temperature", "pressure", "velocity_magnitude", "stress", "shear_stress"]) {
    const rawField = parseRecord(explicitFields[key]);
    const field = {
      unit: validUnit(rawField.unit) || scenarioDefaults[scenarioType]?.[key],
      min: finite(rawField.min),
      max: finite(rawField.max),
      source: validSource(rawField.source),
    };
    if (Object.values(field).some((value) => value !== undefined)) fields[key] = field;
  }

  const sourceCandidate = rawMetadata.source ?? result.source ?? results.source;
  const source = ["pinn", "experimental", "mixed", "required_input"].includes(sourceCandidate)
    ? sourceCandidate as VisualizationMetadata["source"]
    : undefined;
  const sourceLabel = validSource(rawMetadata.source_label ?? result.source_label ?? results.source_label);

  return {
    source,
    source_label: sourceLabel,
    geometry: Object.keys(geometry).length ? geometry : undefined,
    discontinuity: Object.keys(discontinuity).length ? discontinuity : undefined,
    mesh,
    fields: Object.keys(fields).length ? fields : undefined,
    transient: rawMetadata.transient ?? result.transient ?? results.transient,
  };
};

export const extractVisualizationPayload = (analysis: Record<string, any>, resultInput?: unknown) => {
  const results = parseRecord(analysis.results);
  const result = parseRecord(resultInput);
  const resultMetadata = parseRecord(result.metadata);
  const resultsMetadata = parseRecord(results.metadata);
  const transientCandidate = results.transient_series
    ?? result.transient_series
    ?? resultMetadata.transient
    ?? resultsMetadata.transient;
  const transientRecord = transientCandidate === undefined || transientCandidate === null
    ? {}
    : parseRecord(transientCandidate);
  const transientSeries = Object.keys(transientRecord).length ? transientRecord : undefined;
  const rawPoints = result.pinn_predictions ?? result.predictions3d ?? result.predictions ?? result.points ?? results.pinn_predictions ?? results.predictions3d ?? results.predictions ?? results.points ?? analysis.pinn_predictions ?? transientSeries?.time_series?.[0]?.points;
  const rawExperimental = result.experimental_data ?? result.measurements ?? results.experimental_data ?? results.measurements;
  const points = normalizeVisualizationPoints(rawPoints);
  const experimentalPoints = normalizeVisualizationPoints(rawExperimental);
  const metadata = buildVisualizationMetadata(result, results);
  if (transientSeries && typeof transientSeries === "object") metadata.transient = transientSeries as TransientSeries;

  return {
    results,
    result,
    points,
    experimentalPoints,
    transientSeries,
    metadata,
  };
};

export type VisualizationPayload = ReturnType<typeof extractVisualizationPayload>;
export type VisualizationMetadataType = VisualizationMetadata;
export type VisualizationPointType = VisualizationPoint;
export type TransientSeriesType = TransientSeries;
export type TransientBubbleType = TransientBubble;
export type TransientFrameType = TransientFrame;
export type VisualizationMeshMetadataType = VisualizationMeshMetadata;
export type RefinementZoneType = RefinementZone;
export type VisualizationScenarioType = VisualizationScenario;
export type { VisualizationMetadata as VisualizationMetadataExport };
export type { TransientBubble as TransientBubbleExport };
export type { TransientSeries as TransientSeriesExport };
export type { VisualizationPoint as VisualizationPointExport };
export type { VisualizationScenario as VisualizationScenarioExport };
export type { VisualizationMeshMetadata as VisualizationMeshMetadataExport };
export type { RefinementZone as RefinementZoneExport };
export type { TransientFrame as TransientFrameExport };
