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
  | "LH2_INFRASTRUCTURE_INTEGRITY";

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

export interface VisualizationMetadata {
  source?: "pinn" | "experimental" | "mixed" | "required_input";
  source_label?: string;
  geometry?: Record<string, unknown>;
  discontinuity?: Record<string, unknown>;
  mesh?: VisualizationMeshMetadata;
  fields?: Record<string, { unit?: string; source?: string }>;
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
  // Explicit LH2 infrastructure evidence has priority over generic storage labels.
  if (/(lh2[_ -]?infrastructure|dn50|cryogenic.*(leak|fuite)|discontinuit|trou de fuite|through[_ -]?hole)/i.test(text)) {
    return "LH2_INFRASTRUCTURE_INTEGRITY";
  }
  if (/(fpga|heatsink|dissipateur|thermal management)/i.test(text)) return "FPGA_HEATSINK";
  if (/(deep mining|bloc minier|mine profonde|lithostatic)/i.test(text)) return "DEEP_MINING_BLOCK";
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

export const buildVisualizationMetadata = (
  result: Record<string, any>,
  results: Record<string, any>,
  experimentalPoints: VisualizationPoint[],
  points: VisualizationPoint[],
): VisualizationMetadata => {
  const extracted = parseRecord(result.extracted_parameters ?? results.extracted_parameters ?? results.extractedData);
  const geometry = parseRecord(result.geometry ?? results.geometry ?? extracted.geometry);
  const discontinuity = parseRecord(
    result.discontinuity ?? results.discontinuity ?? extracted.discontinuity ?? extracted.leak,
  );
  const meshRaw = parseRecord(result.mesh ?? results.mesh ?? extracted.mesh);
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

  const explicitFields = parseRecord(result.fields ?? results.fields);
  const pressureUnit = explicitFields.pressure?.unit
    ?? extracted.pressure_unit
    ?? (Object.prototype.hasOwnProperty.call(extracted, "pressure_Pa") ? "Pa" : undefined);
  const fields = {
    temperature: { unit: explicitFields.temperature?.unit ?? (Object.prototype.hasOwnProperty.call(extracted, "temperature_K") ? "K" : "K"), source: explicitFields.temperature?.source },
    pressure: { unit: pressureUnit ?? "unit_required", source: explicitFields.pressure?.source },
    velocity_magnitude: { unit: explicitFields.velocity_magnitude?.unit ?? "m/s", source: explicitFields.velocity_magnitude?.source },
    stress: { unit: explicitFields.stress?.unit ?? "unit_required", source: explicitFields.stress?.source },
  };

  return {
    source: experimentalPoints.length && points.length ? "mixed" : experimentalPoints.length ? "experimental" : points.length ? "pinn" : "required_input",
    source_label: experimentalPoints.length && points.length ? "PINN + expérimental" : experimentalPoints.length ? "Données expérimentales" : points.length ? "Prédictions PINN persistées" : "Aucune donnée de champ persistée",
    geometry: Object.keys(geometry).length ? geometry : undefined,
    discontinuity: Object.keys(discontinuity).length ? discontinuity : undefined,
    mesh,
    fields,
  };
};

export const extractVisualizationPayload = (analysis: Record<string, any>, resultInput?: unknown) => {
  const results = parseRecord(analysis.results);
  const result = parseRecord(resultInput);
  const rawPoints = result.pinn_predictions ?? result.predictions3d ?? results.pinn_predictions ?? results.predictions3d ?? analysis.pinn_predictions;
  const rawExperimental = result.experimental_data ?? result.measurements ?? results.experimental_data ?? results.measurements;
  const points = normalizeVisualizationPoints(rawPoints);
  const experimentalPoints = normalizeVisualizationPoints(rawExperimental);
  return {
    results,
    result,
    points,
    experimentalPoints,
    metadata: buildVisualizationMetadata(result, results, experimentalPoints, points),
  };
};
