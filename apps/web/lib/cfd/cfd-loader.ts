import vtkXMLReader, { extend as extendXmlReader } from "@kitware/vtk.js/IO/XML/XMLReader";
import macro from "@kitware/vtk.js/macros";
import {
  CFD_CONTRACT_VERSION,
  CfdFrameSchema,
  CfdVolumeDatasetSchema,
  type CfdFrame,
  type CfdVolumeDataset,
} from "./cfd-contract";
import { normalizeCfdDataset } from "./cfd-normalize";
import { verifyPayloadHash } from "./cfd-validation";

export type VtuFieldDescriptor = {
  unit: string;
  quantity: string;
};

export type VtuFrameSource = {
  frameId: string;
  time: number;
  payload: ArrayBuffer;
  payloadHash: string;
};

export type VtuSidecar = {
  contractVersion: typeof CFD_CONTRACT_VERSION;
  meshRevision: string;
  coordinateSystem: string;
  lengthUnit: string;
  fieldDescriptors: Record<string, VtuFieldDescriptor>;
  boundarySets: CfdVolumeDataset["boundarySets"];
  provenance: CfdVolumeDataset["provenance"];
  residuals: CfdVolumeDataset["residuals"];
  references: CfdVolumeDataset["references"];
  evidence: CfdVolumeDataset["evidence"];
};

function toNumberArray(data: ArrayLike<number> | undefined): number[] {
  if (!data) throw new Error("CFD_VTK_ARRAY_MISSING");
  return Array.from(data, Number);
}

function readArrayAttributes(attributes: { getArrays?: () => unknown[] } | undefined): Array<{ name: string; components: number; values: number[] }> {
  const arrays = attributes?.getArrays?.();
  if (!Array.isArray(arrays)) return [];
  return arrays.map((entry) => {
    const array = entry as {
      getName?: () => string;
      getNumberOfComponents?: () => number;
      getData?: () => ArrayLike<number>;
    };
    const name = array.getName?.();
    const rawComponents = array.getNumberOfComponents?.();
    if (!name || rawComponents === undefined || !Number.isInteger(rawComponents) || rawComponents < 1) throw new Error("CFD_VTK_FIELD_METADATA_MISSING");
    return { name, components: rawComponents, values: toNumberArray(array.getData?.()) };
  });
}

function readVtkLegacyCells(rawCells: ArrayLike<number> | undefined, cellCount: number): { cells: number[]; offsets: number[] } {
  const raw = toNumberArray(rawCells);
  const cells: number[] = [];
  const offsets = [0];
  let cursor = 0;
  for (let cell = 0; cell < cellCount; cell += 1) {
    const vertexCount = raw[cursor];
    if (!Number.isInteger(vertexCount) || vertexCount < 1) throw new Error("CFD_VTK_CELL_CONNECTIVITY_INVALID");
    cursor += 1;
    const end = cursor + vertexCount;
    if (end > raw.length) throw new Error("CFD_VTK_CELL_CONNECTIVITY_TRUNCATED");
    for (; cursor < end; cursor += 1) cells.push(raw[cursor]);
    offsets.push(cells.length);
  }
  if (cursor !== raw.length) throw new Error("CFD_VTK_CELL_CONNECTIVITY_TRAILING_DATA");
  return { cells, offsets };
}

function readVtuFrame(source: VtuFrameSource, sidecar: VtuSidecar): CfdFrame {
  const reader = macro.newInstance(extendXmlReader, "vtkXMLReader")();
  reader.parseAsArrayBuffer(source.payload);
  const output = reader.getOutputData();
  if (!output) throw new Error("CFD_VTK_OUTPUT_MISSING");

  const pointsArray = output.getPoints()?.getData?.();
  const points = toNumberArray(pointsArray);
  if (points.length % 3 !== 0) throw new Error("CFD_VTK_POINT_BUFFER_INVALID");
  const pointCount = points.length / 3;
  const cellArray = output.getCells?.();
  const cellTypes = toNumberArray(output.getCellTypes?.()?.getData?.());
  if (!cellTypes.length) throw new Error("CFD_VTK_CELL_TYPES_MISSING");
  const { cells, offsets } = readVtkLegacyCells(cellArray?.getData?.(), cellTypes.length);

  const fields: CfdFrame["fields"] = [];
  for (const association of ["point", "cell"] as const) {
    const attributes = association === "point" ? output.getPointData?.() : output.getCellData?.();
    for (const array of readArrayAttributes(attributes)) {
      const descriptor = sidecar.fieldDescriptors[array.name];
      if (!descriptor?.unit || !descriptor.quantity) {
        throw new Error(`CFD_FIELD_DESCRIPTOR_MISSING: ${array.name}`);
      }
      fields.push({
        name: array.name,
        association,
        components: array.components,
        values: array.values,
        unit: descriptor.unit,
        quantity: descriptor.quantity,
      });
    }
  }
  if (!fields.length) throw new Error("CFD_VTK_FIELDS_MISSING");

  return CfdFrameSchema.parse({
    frameId: source.frameId,
    time: source.time,
    points,
    cells,
    offsets,
    cellTypes,
    fields,
  });
}

function ensureSameMesh(frames: readonly CfdFrame[]): void {
  const first = frames[0];
  for (const frame of frames.slice(1)) {
    if (frame.points.length !== first.points.length || frame.cells.length !== first.cells.length || frame.offsets.length !== first.offsets.length || frame.cellTypes.length !== first.cellTypes.length) {
      throw new Error("CFD_MESH_TOPOLOGY_CHANGED");
    }
    for (let i = 0; i < first.cells.length; i += 1) if (frame.cells[i] !== first.cells[i]) throw new Error("CFD_MESH_CONNECTIVITY_CHANGED");
    for (let i = 0; i < first.offsets.length; i += 1) if (frame.offsets[i] !== first.offsets[i]) throw new Error("CFD_MESH_OFFSETS_CHANGED");
    for (let i = 0; i < first.cellTypes.length; i += 1) if (frame.cellTypes[i] !== first.cellTypes[i]) throw new Error("CFD_MESH_CELL_TYPES_CHANGED");
  }
}

/**
 * Charge une série de VTU fournie par le solveur. Le sidecar ne peut pas
 * inventer les données : il ne contient que les métadonnées, unités,
 * frontières et preuves produites par le pipeline de calcul.
 */
export async function loadCfdVtuSeries(sources: readonly VtuFrameSource[], sidecar: VtuSidecar) {
  if (sources.length === 0) throw new Error("CFD_NO_VTU_FRAMES");
  if (sidecar.contractVersion !== CFD_CONTRACT_VERSION) throw new Error("CFD_CONTRACT_VERSION_UNSUPPORTED");
  const frames: CfdFrame[] = [];
  for (const source of sources) {
    if (!(await verifyPayloadHash(source.payload, source.payloadHash))) {
      throw new Error(`CFD_PAYLOAD_HASH_MISMATCH: ${source.frameId}`);
    }
    frames.push(readVtuFrame(source, sidecar));
  }
  ensureSameMesh(frames);
  const first = frames[0];
  const dataset = CfdVolumeDatasetSchema.parse({
    ...sidecar,
    pointCount: first.points.length / 3,
    cellCount: first.cellTypes.length,
    frames,
  });
  return normalizeCfdDataset(dataset);
}

export async function fetchVtuSeries(
  urls: readonly { frameId: string; time: number; url: string; payloadHash: string }[],
  sidecar: VtuSidecar,
  signal?: AbortSignal,
) {
  const sources: VtuFrameSource[] = [];
  for (const item of urls) {
    const response = await fetch(item.url, { signal, credentials: "include" });
    if (!response.ok) throw new Error(`CFD_VTU_FETCH_FAILED: ${response.status} ${item.url}`);
    sources.push({ frameId: item.frameId, time: item.time, payload: await response.arrayBuffer(), payloadHash: item.payloadHash });
  }
  return loadCfdVtuSeries(sources, sidecar);
}
