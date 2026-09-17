#!/usr/bin/env python3
import meshio,numpy as np,json
from pathlib import Path
p1=Path('/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-001/frames'); p2=Path('/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-002')
rows=[]
for i in range(8):
 a=meshio.read(p1/f'frame_{i:04d}.vtu'); b=meshio.read(p2/f'frames_tmp_{i:04d}.vtu')
 same_points=np.array_equal(a.points,b.points); same_cells=[(x.type,np.array_equal(x.data,y.data)) for x,y in zip(a.cells,b.cells)]
 names=sorted(set(a.point_data)|set(b.point_data)|set(a.cell_data)|set(b.cell_data)); maxdiff=0.0
 for name in names:
  for src,dst in ((a,b),(b,a)):
   if name in src.point_data and name in dst.point_data: maxdiff=max(maxdiff,float(np.max(np.abs(src.point_data[name]-dst.point_data[name]))))
   if name in src.cell_data and name in dst.cell_data:
    for x,y in zip(src.cell_data[name],dst.cell_data[name]): maxdiff=max(maxdiff,float(np.max(np.abs(x-y))))
 rows.append({'frame':i,'same_points':same_points,'same_cells':same_cells,'max_abs_field_difference':maxdiff})
out={'frames':rows,'all_topology_equal':all(r['same_points'] and all(x[1] for x in r['same_cells']) for r in rows),'max_abs_field_difference':max(r['max_abs_field_difference'] for r in rows),'binary_hashes_equal':False,'note':'Binary VTU hashes differ because foamToVTK serialization embeds run-specific metadata; numerical content is compared separately.'}
Path('/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-002/reproducibility_comparison.json').write_text(json.dumps(out,indent=2)+'\n'); print(json.dumps(out,indent=2))
