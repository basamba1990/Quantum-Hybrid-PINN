import type { CfdBufferDataset, CfdBufferFrame } from "./cfd-contract";
import { validateCfdBufferDataset } from "./cfd-validation";

export type CfdWorkerRequest = {
  type: "validate-frame-topology";
  dataset: CfdBufferDataset;
};

export type CfdWorkerResponse =
  | { type: "validated"; valid: true; transferableBytes: number }
  | { type: "rejected"; valid: false; message: string };

export function collectCfdTransferables(dataset: CfdBufferDataset): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = [];
  const push = (value: ArrayBufferView) => {
    if (value.buffer instanceof ArrayBuffer) buffers.push(value.buffer);
  };
  for (const frame of dataset.frames) {
    push(frame.points);
    push(frame.cells);
    push(frame.offsets);
    push(frame.cellTypes);
    for (const field of [...frame.pointData.values(), ...frame.cellData.values()]) push(field.values);
  }
  return buffers;
}

export function validateWorkerDataset(dataset: CfdBufferDataset): CfdWorkerResponse {
  const report = validateCfdBufferDataset(dataset);
  if (!report.valid) {
    return { type: "rejected", valid: false, message: report.issues.map((issue) => issue.message).join(" | ") };
  }
  return { type: "validated", valid: true, transferableBytes: collectCfdTransferables(dataset).reduce((sum, buffer) => sum + buffer.byteLength, 0) };
}

export function sameTopology(a: CfdBufferFrame, b: CfdBufferFrame): boolean {
  if (a.points.length !== b.points.length || a.cells.length !== b.cells.length || a.offsets.length !== b.offsets.length || a.cellTypes.length !== b.cellTypes.length) return false;
  return a.cells.every((value, index) => value === b.cells[index])
    && a.offsets.every((value, index) => value === b.offsets[index])
    && a.cellTypes.every((value, index) => value === b.cellTypes[index]);
}
