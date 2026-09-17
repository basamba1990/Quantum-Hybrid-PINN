#!/usr/bin/env python3
from math import cos, sin, pi
from pathlib import Path

out = Path('/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-001/constant/triSurface/lh2_reconstructed.stl')
R=0.193; z0=-0.10145; z1=0.5491; n=96
# Closed, parameterized surface: short conical ends + cylindrical wall; no degenerate pole triangles.
rings=[(0.0,z0),(0.72*R,z0+0.28*0.10145),(0.95*R,z0+0.70*0.10145),(R,0.0),(R,0.5491),(0.95*R,0.5491+0.30*0.0991),(0.72*R,0.5491+0.72*0.0991),(0.0,z1)]
tri=[]
def p(r,z,a): return (r*cos(a), r*sin(a), z)
for j in range(len(rings)-1):
    r0,za=rings[j]; r1,zb=rings[j+1]
    if r0==0.0:
        c=(0.0,0.0,za)
        for i in range(n): tri.append((c,p(r1,zb,2*pi*(i+1)/n),p(r1,zb,2*pi*i/n)))
    elif r1==0.0:
        c=(0.0,0.0,zb)
        for i in range(n): tri.append((c,p(r0,za,2*pi*i/n),p(r0,za,2*pi*(i+1)/n)))
    else:
        for i in range(n):
            a=2*pi*i/n; b=2*pi*(i+1)/n
            tri += [(p(r0,za,a),p(r1,zb,a),p(r1,zb,b)),(p(r0,za,a),p(r1,zb,b),p(r0,za,b))]
def facet(t):
    a,b,c=t; u=[b[i]-a[i] for i in range(3)]; v=[c[i]-a[i] for i in range(3)]
    q=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
    return ' facet normal %.9g %.9g %.9g\n  outer loop\n   vertex %.12g %.12g %.12g\n   vertex %.12g %.12g %.12g\n   vertex %.12g %.12g %.12g\n  endloop\n endfacet\n' % (*q,*a,*b,*c)
out.write_text('solid lh2_reconstructed\n'+''.join(facet(t) for t in tri)+'endsolid lh2_reconstructed\n')
print(out, len(tri))
