/**
 * Modèle de données pour blockMeshDict (inspiré de blockSketch)
 */

export interface Vertex {
  x: number;
  y: number;
  z: number;
  index: number;
}

export interface Block {
  vertexIds: number[];          // 8 indices de sommets (hex)
  cells: [number, number, number]; // (nx, ny, nz)
  gradingType: 'simpleGrading' | 'edgeGrading';
  grading: any[];               // données de grading brutes
  zoneName?: string;            // zone de cellules optionnelle
}

export interface ArcEdge {
  type: 'arc';
  vStart: number;
  vEnd: number;
  point: [number, number, number];
  isOrigin: boolean;
}

export interface SplineEdge {
  type: 'spline' | 'polyLine' | 'BSpline' | 'polySpline';
  vStart: number;
  vEnd: number;
  points: [number, number, number][];
}

export type Edge = ArcEdge | SplineEdge;

export interface BoundaryPatch {
  name: string;
  type: string;
  faces: number[][];
}

export interface BlockMesh {
  scale: number;
  vertices: Vertex[];
  blocks: Block[];
  edges: Edge[];
  patches: BoundaryPatch[];
}
