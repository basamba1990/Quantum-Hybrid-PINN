import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, test } from "vitest";
import { parseCfdMetadata } from "@/lib/cfd/cfd-contract";
import { normalizeCfdDataset, interpolateFrame } from "@/lib/cfd/cfd-normalize";
import { validateCfdDataset, validateCfdBufferDataset } from "@/lib/cfd/cfd-validation";
import { loadCertifiedCfdDataset } from "@/lib/cfd/cfd-repository";
import { buildCfdSurfaceMesh } from "@/components/cfd/CFDMeshRenderer";
import { extractCfdIsoSurface } from "@/components/cfd/CFDIsoSurface";
import CFDViewer from "@/components/cfd/CFDViewer";

const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function makeDataset() {
  const points0 = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
  const points1 = [0, 0, 0, 1, 0, 0, 0, 1.1, 0, 0, 0, 1];
  const fields = (temperature: number[]) => [
    { name: "temperature", association: "point" as const, components: 1, values: temperature, unit: "K", quantity: "temperature" },
    { name: "pressure", association: "point" as const, components: 1, values: [100000, 101000, 102000, 103000], unit: "Pa", quantity: "pressure" },
  ];
  return {
    contractVersion: "cfd-volume.v1" as const,
    meshRevision: "mesh-test-revision-1",
    coordinateSystem: "cartesian",
    lengthUnit: "m",
    pointCount: 4,
    cellCount: 1,
    frames: [
      { frameId: "t0", time: 0, points: points0, cells: [0, 1, 2, 3], offsets: [0, 4], cellTypes: [10], fields: fields([20, 21, 22, 23]) },
      { frameId: "t1", time: 1, points: points1, cells: [0, 1, 2, 3], offsets: [0, 4], cellTypes: [10], fields: fields([21, 22, 23, 24]) },
    ],
    boundarySets: [{ name: "wall", association: "point" as const, indices: [0, 1, 2, 3] }],
    provenance: { solver: "test-solver", solverVersion: "1.0.0", sourceUri: "https://example.invalid/cfd.vtu", sourceHash: HASH, calculationId: "calculation-test-1", generatedAt: "2026-08-23T00:00:00.000Z" },
    residuals: { mass: 1e-8, momentum: 2e-8, energy: 3e-8, norm: "L2" as const, computedBy: "test-solver", computedAt: "2026-08-23T00:00:00.000Z" },
    references: [{ id: "reference-1", title: "Reference CFD case", uri: "https://example.invalid/reference", variables: ["temperature", "pressure"], comparisonHash: HASH }],
    transientProof: { solverCaseHash: HASH, runManifestHash: HASH, residualHistoryHash: HASH, balanceHistoryHash: HASH, exportManifestHash: HASH, runLogHash: HASH, timeStepSeconds: 1, frameTimesSeconds: [0, 1], residualNorm: "L2" as const, solverCompleted: true as const, calculatedBy: "test-solver" },
    evidence: { meshGeometryAndTopology: true, fieldsAndUnits: true, namedBoundaries: true, solverProvenance: true, solverResiduals: true, referenceComparison: true, immutableHashes: true, calculatedTransientStates: true },
  };
}

describe("CFD contract and validation", () => {
  test("accepts a complete versioned dataset and exposes all eight evidence criteria", () => {
    const dataset = parseCfdMetadata(makeDataset());
    const report = validateCfdDataset(dataset);
    expect(report.valid).toBe(true);
    expect(report.canRender).toBe(true);
    expect(report.canClaimValidated).toBe(true);
    expect(Object.keys(dataset.evidence)).toHaveLength(8);
  });

  test("rejects legacy evidence when canonical criteria are missing", () => {
    const legacy = makeDataset();
    legacy.evidence = { geometry: true, mesh: true, solver: false, residuals: false, comparison: false } as never;
    expect(() => parseCfdMetadata(legacy)).toThrow(/missing canonical evidence/);
  });

  test("rejects ambiguous boundary_face associations instead of translating them", () => {
    const legacy = makeDataset();
    legacy.boundarySets = [{ name: "wall", association: "boundary_face", indices: [0, 1] }] as never;
    expect(() => parseCfdMetadata(legacy)).toThrow(/boundary_face association is ambiguous/);
  });

  test("renders a structurally valid dataset without claiming G0-G5 validation", () => {
    const structuralOnly = makeDataset();
    structuralOnly.evidence = {
      meshGeometryAndTopology: false,
      fieldsAndUnits: false,
      namedBoundaries: false,
      solverProvenance: false,
      solverResiduals: false,
      referenceComparison: false,
      immutableHashes: false,
      calculatedTransientStates: false,
    };
    const loaded = loadCertifiedCfdDataset({ results: { cfd_dataset: structuralOnly } });
    expect(loaded.report?.canRender).toBe(true);
    expect(loaded.report?.canClaimValidated).toBe(false);
    expect(loaded.buffers?.frames[0].points).toBeInstanceOf(Float32Array);
    expect(loaded.buffers?.frames[0].cells).toBeInstanceOf(Uint32Array);
  });

  test("keeps null residuals as N/D while allowing structural rendering", () => {
    const structuralOnly = {
      ...makeDataset(),
      residuals: {
        mass: null,
        momentum: null,
        energy: null,
        norm: null,
        computedBy: "not-a-physical-solver",
        computedAt: null,
      },
    };
    const parsed = parseCfdMetadata(structuralOnly);
    const report = validateCfdDataset(parsed);
    expect(report.canRender).toBe(true);
    expect(report.canClaimValidated).toBe(false);
    expect(report.issues.some((item) => item.code === "RESIDUALS_INVALID")).toBe(true);
    const loaded = loadCertifiedCfdDataset({ results: { cfd_dataset: structuralOnly } });
    expect(loaded.buffers?.frames[0].cells).toBeInstanceOf(Uint32Array);
    expect(loaded.report?.canClaimValidated).toBe(false);
  });

  test("rejects a real-transient claim when solver proof is missing", () => {
    const incomplete = makeDataset();
    delete (incomplete as { transientProof?: unknown }).transientProof;
    const report = validateCfdDataset(parseCfdMetadata(incomplete));
    expect(report.canRender).toBe(true);
    expect(report.canClaimValidated).toBe(false);
    expect(report.issues.some((item) => item.code === "TRANSIENT_PROOF_INVALID")).toBe(true);
  });

  test("rejects a dataset with missing units and invalid topology", () => {
    const invalid = makeDataset();
    invalid.frames[0].fields[0].unit = "";
    invalid.frames[0].cells = [0, 1, 2, 9];
    expect(() => parseCfdMetadata(invalid)).toThrow();
  });

  test("enables buffer playback when fields change on a fixed mesh", () => {
    const fixedMeshDataset = makeDataset();
    fixedMeshDataset.frames[1].points = [...fixedMeshDataset.frames[0].points];
    const buffers = normalizeCfdDataset(parseCfdMetadata(fixedMeshDataset));
    const report = validateCfdBufferDataset(buffers);
    expect(report.hasRealTransientStates).toBe(true);
    expect(report.canRender).toBe(true);
  });

  test("rejects identical transient frames instead of enabling animation", () => {
    const staticDataset = makeDataset();
    staticDataset.frames[1].points = [...staticDataset.frames[0].points];
    staticDataset.frames[1].fields = staticDataset.frames[0].fields.map((field) => ({ ...field, values: [...field.values] }));
    const report = validateCfdDataset(parseCfdMetadata(staticDataset));
    expect(report.valid).toBe(false);
    expect(report.hasRealTransientStates).toBe(false);
    expect(report.issues.some((item) => item.code === "TIME_SERIES_INVALID")).toBe(true);
  });
});

describe("CFD repository and buffers", () => {
  test("loads only cfd_dataset and normalizes typed buffers", () => {
    const loaded = loadCertifiedCfdDataset({ results: { cfd_dataset: makeDataset() } });
    expect(loaded.report?.canClaimValidated).toBe(true);
    expect(loaded.buffers?.frames[0].points).toBeInstanceOf(Float32Array);
    expect(loaded.buffers?.frames[0].cells).toBeInstanceOf(Uint32Array);
    expect(validateCfdBufferDataset(loaded.buffers!).valid).toBe(true);
  });

  test("does not accept legacy points or pinn_predictions as CFD data", () => {
    const loaded = loadCertifiedCfdDataset({ results: { points: [{ x: 0, y: 0, z: 0 }], pinn_predictions: [] } });
    expect(loaded.dataset).toBeNull();
    expect(loaded.buffers).toBeNull();
  });

  test("interpolates only frames with unchanged topology", () => {
    const buffers = normalizeCfdDataset(parseCfdMetadata(makeDataset()));
    const interpolated = interpolateFrame(buffers.frames[0], buffers.frames[1], 0.5);
    expect(interpolated.time).toBe(0.5);
    expect(interpolated.points[7]).toBeCloseTo(1.05);
    expect(interpolated.cells).toBe(buffers.frames[0].cells);
  });
});

describe("Connected mesh and iso-surface", () => {
  test("triangulates the external face of a persisted tetrahedral cell", () => {
    const buffers = normalizeCfdDataset(parseCfdMetadata(makeDataset()));
    const mesh = buildCfdSurfaceMesh({ frame: buffers.frames[0] });
    const position = mesh.geometry.getAttribute("position");
    expect(position.count).toBe(12);
    mesh.geometry.dispose();
    (mesh.material as import("three").Material).dispose();
  });

  test("renders persisted VTK triangle cells used by imported surface VTU kits", () => {
    const surfaceDataset = makeDataset();
    surfaceDataset.pointCount = 4;
    surfaceDataset.cellCount = 1;
    surfaceDataset.frames = surfaceDataset.frames.map((frame) => ({
      ...frame,
      cells: [0, 1, 2],
      offsets: [0, 3],
      cellTypes: [5],
    }));
    const buffers = normalizeCfdDataset(parseCfdMetadata(surfaceDataset));
    const mesh = buildCfdSurfaceMesh({ frame: buffers.frames[0] });
    expect(mesh.geometry.getAttribute("position").count).toBe(3);
    mesh.geometry.dispose();
    (mesh.material as import("three").Material).dispose();
  });

  test("extracts an iso-surface from the scalar field and cell connectivity", () => {
    const buffers = normalizeCfdDataset(parseCfdMetadata(makeDataset()));
    const surface = extractCfdIsoSurface(buffers.frames[0], "temperature", 21.5);
    const positions = surface.geometry.getAttribute("position");
    expect(positions.count).toBeGreaterThan(0);
    expect(positions.count % 3).toBe(0);
    surface.geometry.dispose();
    (surface.material as import("three").Material).dispose();
  });

  test("rejects an unavailable scalar field instead of generating geometry", () => {
    const buffers = normalizeCfdDataset(parseCfdMetadata(makeDataset()));
    expect(() => extractCfdIsoSurface(buffers.frames[0], "density", 1)).toThrow("CFD_ISO_POINT_SCALAR_REQUIRED");
  });
});

describe("CFD viewer states", () => {
  test("shows an explicit missing-data state", () => {
    render(<CFDViewer dataset={null} />);
    expect(document.querySelector('[data-cfd-state="missing"]')).toBeInTheDocument();
  });

  test("shows an explicit rejected-data state", () => {
    const buffers = normalizeCfdDataset(parseCfdMetadata(makeDataset()));
    const invalid = { ...buffers, pointCount: 99 };
    render(<CFDViewer dataset={invalid} />);
    expect(document.querySelector('[data-cfd-state="rejected"]')).toBeInTheDocument();
  });
});
