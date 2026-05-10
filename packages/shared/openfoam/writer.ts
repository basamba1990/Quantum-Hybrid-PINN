import { BlockMesh, Vertex, Block, Edge, BoundaryPatch } from './model';

/**
 * Sérialiseur blockMeshDict — convertit un modèle BlockMesh en texte OpenFOAM valide.
 */

function fmt(x: number | null): string {
  if (x === null) return '0';
  if (Number.isInteger(x)) return x.toString();
  return x.toFixed(10).replace(/\.?0+$/, '');
}

function xyz(pt: [number, number, number]): string {
  return `(${fmt(pt[0])} ${fmt(pt[1])} ${fmt(pt[2])})`;
}

function foamHeader(): string {
  const top = '/*' + '-'.repeat(32) + '*- C++ -*' + '-'.repeat(34) + '*\\';
  const bot = '\\*' + '-'.repeat(75) + '*/';
  const div = '// ' + '* '.repeat(37) + '//';
  return `${top}
${bot}
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    object      blockMeshDict;
}
${div}`;
}

function writeVertices(vertices: Vertex[]): string {
  let lines = ['vertices', '('];
  for (const v of vertices) {
    lines.push(`    (${fmt(v.x)} ${fmt(v.y)} ${fmt(v.z)})  // ${v.index}`);
  }
  lines.push(');');
  return lines.join('\n');
}

function writeBlocks(blocks: Block[]): string {
  let lines = ['blocks', '('];
  for (const block of blocks) {
    const vids = block.vertexIds.join(' ');
    const [nx, ny, nz] = block.cells;
    const grading = `${block.gradingType} (${block.grading.join(' ')})`;
    if (block.zoneName) {
      lines.push(`    hex (${vids}) ${block.zoneName} (${nx} ${ny} ${nz}) ${grading}`);
    } else {
      lines.push(`    hex (${vids}) (${nx} ${ny} ${nz}) ${grading}`);
    }
  }
  lines.push(');');
  return lines.join('\n');
}

export function writeBlockMesh(mesh: BlockMesh): string {
  const div = '// ' + '* '.repeat(37) + '//';
  const sections = [
    foamHeader(),
    '',
    `convertToMeters ${fmt(mesh.scale)};`,
    '',
    writeVertices(mesh.vertices),
    '',
    writeBlocks(mesh.blocks),
    '',
    'edges',
    '(',
    ');', // Simplifié pour l'instant
    '',
    'boundary',
    '(',
    ');', // Simplifié pour l'instant
    '',
    'mergePatchPairs',
    '(',
    ');',
    '',
    div
  ];
  return sections.join('\n');
}
