"use client";

import * as THREE from "three";
import type { CfdBufferFrame } from "@/lib/cfd/cfd-contract";

export type CFDMeshRendererProps = { frame: CfdBufferFrame; fieldName?: string; wireframe?: boolean };
type Face = [number, number, number, number?];

const facesForCell = (type: number, ids: number[]): Face[] => {
  switch (type) {
    case 10: return [[ids[0], ids[1], ids[2]], [ids[0], ids[3], ids[1]], [ids[1], ids[3], ids[2]], [ids[0], ids[2], ids[3]]];
    case 11:
    case 12: return [[ids[0], ids[1], ids[2], ids[3]], [ids[4], ids[7], ids[6], ids[5]], [ids[0], ids[4], ids[5], ids[1]], [ids[1], ids[5], ids[6], ids[2]], [ids[2], ids[6], ids[7], ids[3]], [ids[4], ids[0], ids[3], ids[7]]];
    case 13: return [[ids[0], ids[2], ids[1]], [ids[3], ids[4], ids[5]], [ids[0], ids[1], ids[4], ids[3]], [ids[1], ids[2], ids[5], ids[4]], [ids[2], ids[0], ids[3], ids[5]]];
    case 14: return [[ids[0], ids[1], ids[2], ids[3]], [ids[0], ids[4], ids[1]], [ids[1], ids[4], ids[2]], [ids[2], ids[4], ids[3]], [ids[3], ids[4], ids[0]]];
    default: throw new Error(`CFD_CELL_TYPE_UNSUPPORTED:${type}`);
  }
};

export function buildCfdSurfaceMesh({ frame, fieldName, wireframe = false }: CFDMeshRendererProps): THREE.Mesh {
  const field = fieldName ? frame.pointData.get(fieldName) : undefined;
  if (field && (field.components !== 1 || field.values.length !== frame.points.length / 3)) throw new Error("CFD_SCALAR_POINT_FIELD_SIZE_MISMATCH");
  const faces = new Map<string, { face: Face; count: number }>();
  for (let cell = 0; cell < frame.cellTypes.length; cell += 1) {
    const ids = Array.from(frame.cells.slice(frame.offsets[cell], frame.offsets[cell + 1]));
    for (const face of facesForCell(frame.cellTypes[cell], ids)) {
      const key = face.filter((value): value is number => value !== undefined).sort((a, b) => a - b).join(":");
      const current = faces.get(key);
      if (current) current.count += 1; else faces.set(key, { face, count: 1 });
    }
  }
  const values = field ? Array.from(field.values) : [];
  const min = values.length ? Math.min(...values) : 0;
  const span = (values.length ? Math.max(...values) : 1) - min || 1;
  const positions: number[] = [];
  const colors: number[] = [];
  const push = (id: number) => {
    const p = id * 3;
    positions.push(frame.points[p], frame.points[p + 1], frame.points[p + 2]);
    const n = field ? THREE.MathUtils.clamp((field.values[id] - min) / span, 0, 1) : 0.5;
    const c = new THREE.Color().setHSL((1 - n) * 0.66, 1, 0.5);
    colors.push(c.r, c.g, c.b);
  };
  for (const entry of faces.values()) {
    if (entry.count !== 1) continue;
    const triangles = entry.face.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]];
    for (const triangle of triangles) triangle.forEach((index) => {
      const id = entry.face[index];
      if (id !== undefined) push(id);
    });
  }
  if (!positions.length) throw new Error("CFD_EXTERNAL_SURFACE_EMPTY");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, wireframe });
  return new THREE.Mesh(geometry, material);
}

export default buildCfdSurfaceMesh;
