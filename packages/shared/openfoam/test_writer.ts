import { writeBlockMesh } from './writer';
import { BlockMesh } from './model';

const testMesh: BlockMesh = {
  scale: 1.0,
  vertices: [
    { x: 0, y: 0, z: 0, index: 0 },
    { x: 1, y: 0, z: 0, index: 1 },
    { x: 1, y: 1, z: 0, index: 2 },
    { x: 0, y: 1, z: 0, index: 3 },
    { x: 0, y: 0, z: 1, index: 4 },
    { x: 1, y: 0, z: 1, index: 5 },
    { x: 1, y: 1, z: 1, index: 6 },
    { x: 0, y: 1, z: 1, index: 7 },
  ],
  blocks: [
    {
      vertexIds: [0, 1, 2, 3, 4, 5, 6, 7],
      cells: [10, 10, 10],
      gradingType: 'simpleGrading',
      grading: [1, 1, 1],
    }
  ],
  edges: [],
  patches: []
};

console.log(writeBlockMesh(testMesh));
