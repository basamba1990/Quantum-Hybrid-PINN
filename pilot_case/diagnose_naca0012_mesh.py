#!/usr/bin/env python3
"""Diagnose the generated NACA0012 annular VTU mesh without changing it."""
from __future__ import annotations
import argparse, json, math, re
from pathlib import Path

def read_vtu(path: Path):
    text = path.read_text(encoding='utf-8')
    pm = re.search(r'<Points>\s*<DataArray[^>]*>(.*?)</DataArray>\s*</Points>', text, re.S)
    cm = re.search(r'<DataArray[^>]*Name="connectivity"[^>]*>(.*?)</DataArray>', text, re.S)
    om = re.search(r'<DataArray[^>]*Name="offsets"[^>]*>(.*?)</DataArray>', text, re.S)
    tm = re.search(r'<DataArray[^>]*Name="types"[^>]*>(.*?)</DataArray>', text, re.S)
    if not all((pm, cm, om, tm)):
        raise ValueError('required VTU arrays are missing')
    p = [float(x) for x in pm.group(1).split()]
    c = [int(x) for x in cm.group(1).split()]
    t = [int(x) for x in tm.group(1).split()]
    if len(p) % 3 or any(x != 5 for x in t) or len(c) != 3 * len(t):
        raise ValueError('mesh is not a triangular 3D-embedded VTU')
    pts = [(p[i], p[i+1], p[i+2]) for i in range(0, len(p), 3)]
    cells = [tuple(c[i:i+3]) for i in range(0, len(c), 3)]
    return pts, cells

def signed_area(a,b,c):
    return 0.5*((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--vtu', type=Path, required=True)
    ap.add_argument('--sidecar', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    args=ap.parse_args()
    pts,cells=read_vtu(args.vtu)
    side=json.loads(args.sidecar.read_text(encoding='utf-8'))
    markers={x['name']:x['indices'] for x in side['boundary_sets']}
    areas=[signed_area(pts[a],pts[b],pts[c]) for a,b,c in cells]
    lengths=[]
    for a,b,c in cells:
        q=[]
        for i,j in ((a,b),(b,c),(c,a)):
            q.append(math.dist(pts[i],pts[j]))
        lengths.append(q)
    nonpositive=sum(x<=0 for x in areas)
    zero=sum(abs(x)<=1e-14 for x in areas)
    wall=markers.get('wall',[]); far=markers.get('farfield',[])
    # Boundary polygon orientation in the input order, signed area by shoelace.
    def polygon_area(indices):
        return 0.5*sum(pts[indices[i]][0]*pts[indices[(i+1)%len(indices)]][1]-pts[indices[(i+1)%len(indices)]][0]*pts[indices[i]][1] for i in range(len(indices)))
    result={
      'status':'PASS' if nonpositive==0 and zero==0 and len(wall)>2 and len(far)>2 else 'FAIL',
      'points':len(pts),'cells':len(cells),
      'cell_signed_area':{'min':min(areas),'max':max(areas),'nonpositive':nonpositive,'zero':zero},
      'edge_lengths':{'min':min(min(x) for x in lengths),'max':max(max(x) for x in lengths)},
      'boundary_sets':{k:{'points':len(v),'polygon_signed_area':polygon_area(v)} for k,v in markers.items()},
      'checks':{
        'all_triangles_positive_orientation':nonpositive==0,
        'no_zero_area_cells':zero==0,
        'wall_declared':len(wall)>2,
        'farfield_declared':len(far)>2,
        'all_points_planar_z0':all(abs(x[2])<=1e-15 for x in pts),
      },
      'interpretation':'structural_mesh_diagnostic_only_not_cfd_convergence'
    }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result))
    return 0 if result['status']=='PASS' else 2
if __name__=='__main__':
    raise SystemExit(main())
