import * as THREE from "three";
import type { CfdBufferFrame } from "@/lib/cfd/cfd-contract";

const tetraEdges: readonly [number, number][] = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]];
const cellTetrahedra = (type: number, ids: number[]): number[][] => {
  if (type === 10) return [ids];
  if (type === 11 || type === 12) return [[ids[0], ids[1], ids[3], ids[4]], [ids[1], ids[2], ids[3], ids[6]], [ids[1], ids[4], ids[5], ids[6]], [ids[3], ids[4], ids[6], ids[7]], [ids[1], ids[3], ids[4], ids[6]]];
  if (type === 13) return [[ids[0], ids[1], ids[2], ids[3]], [ids[1], ids[2], ids[4], ids[3]], [ids[2], ids[4], ids[5], ids[3]]];
  if (type === 14) return [[ids[0], ids[1], ids[2], ids[4]], [ids[0], ids[2], ids[3], ids[4]]];
  throw new Error(`CFD_CELL_TYPE_UNSUPPORTED:${type}`);
};

export function extractCfdIsoSurface(frame: CfdBufferFrame, fieldName: string, isoValue: number): THREE.Mesh {
  if (!Number.isFinite(isoValue)) throw new Error("CFD_ISO_VALUE_INVALID");
  const field = frame.pointData.get(fieldName);
  if (!field || field.components !== 1 || field.values.length !== frame.points.length / 3) throw new Error("CFD_ISO_POINT_SCALAR_REQUIRED");
  const positions: number[] = [];
  const colors: number[] = [];
  const intersect = (a: number, b: number) => {
    const va = field.values[a]; const vb = field.values[b];
    if ((va < isoValue) === (vb < isoValue) || va === vb) return null;
    const ratio = THREE.MathUtils.clamp((isoValue - va) / (vb - va), 0, 1);
    const pa = new THREE.Vector3(frame.points[a * 3], frame.points[a * 3 + 1], frame.points[a * 3 + 2]);
    const pb = new THREE.Vector3(frame.points[b * 3], frame.points[b * 3 + 1], frame.points[b * 3 + 2]);
    return pa.lerp(pb, ratio);
  };
  for (let cell = 0; cell < frame.cellTypes.length; cell += 1) {
    const ids = Array.from(frame.cells.slice(frame.offsets[cell], frame.offsets[cell + 1]));
    for (const tetra of cellTetrahedra(frame.cellTypes[cell], ids)) {
      const intersections: THREE.Vector3[] = [];
      for (const [a, b] of tetraEdges) {
        const point = intersect(tetra[a], tetra[b]);
        if (point) intersections.push(point);
      }
      if (intersections.length >= 3) {
        const triangleOrders = intersections.length === 4 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]];
        const c = new THREE.Color(0xff3b20);
        for (const order of triangleOrders) for (const index of order) {
          const point = intersections[index];
          positions.push(point.x, point.y, point.z);
          colors.push(c.r, c.g, c.b);
        }
      }
    }
  }
  if (!positions.length) throw new Error("CFD_ISO_SURFACE_EMPTY");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}
