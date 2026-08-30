from pathlib import Path
import re, sys


def read_list(path: Path):
    text = path.read_text(encoding='utf-8', errors='ignore')
    body = text[text.find('('):]
    return body


def parse_points(path: Path):
    body = read_list(path)
    pts = []
    for x, y, z in re.findall(r'\(\s*([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s*\)', body):
        pts.append((float(x), float(y), float(z)))
    return pts


def parse_faces(path: Path):
    body = read_list(path)
    faces = []
    for n, indices in re.findall(r'(\d+)\s*\(([^()]*)\)', body):
        vals = [int(v) for v in re.findall(r'-?\d+', indices)]
        if len(vals) == int(n):
            faces.append(vals)
    return faces


def normal(a, b, c):
    ux, uy, uz = (b[i] - a[i] for i in range(3))
    vx, vy, vz = (c[i] - a[i] for i in range(3))
    nx, ny, nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
    mag = (nx*nx+ny*ny+nz*nz) ** 0.5 or 1.0
    return nx/mag, ny/mag, nz/mag


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: export_openfoam_patch_stl.py <case> <output.stl>')
    case = Path(sys.argv[1])
    out = Path(sys.argv[2])
    poly = case / 'constant/polyMesh'
    points, faces = parse_points(poly/'points'), parse_faces(poly/'faces')
    boundary = (poly/'boundary').read_text(encoding='utf-8', errors='ignore')
    m = re.search(r'\bcylinder\s*\{.*?nFaces\s+(\d+)\s*;\s*startFace\s+(\d+)\s*;', boundary, re.S)
    if not m:
        raise SystemExit('cylinder patch not found')
    nfaces, start = int(m.group(1)), int(m.group(2))
    selected = faces[start:start+nfaces]
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open('w', encoding='ascii') as f:
        f.write('solid cylinder_patch\n')
        triangles = 0
        for face in selected:
            if len(face) < 3:
                continue
            for i in range(1, len(face)-1):
                tri = [points[face[0]], points[face[i]], points[face[i+1]]]
                nx, ny, nz = normal(*tri)
                f.write(f' facet normal {nx:.9g} {ny:.9g} {nz:.9g}\n  outer loop\n')
                for p in tri:
                    f.write(f'   vertex {p[0]:.9g} {p[1]:.9g} {p[2]:.9g}\n')
                f.write('  endloop\n endfacet\n')
                triangles += 1
        f.write('endsolid cylinder_patch\n')
    print(f'points={len(points)} faces_total={len(faces)} patch_faces={nfaces} triangles={triangles} output={out}')


if __name__ == '__main__':
    main()
