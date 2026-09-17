#!/usr/bin/env bash
set -euo pipefail
CASE=/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-001
OUT="$CASE/frames"
rm -rf "$OUT"; mkdir -p "$OUT"
for i in 5 10 15 20 25 30 35 40; do cp "$CASE/VTK/PCCV-TRANSIENT-RUN-001_${i}/internal.vtu" "$OUT/frame_$(printf '%04d' $((i/5-1))).vtu"; done
sha256sum "$OUT"/*.vtu > "$OUT/frames.sha256"
python3 - <<'PY'
import hashlib,json
from pathlib import Path
p=Path('/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-001')
frames=[]
for i,f in enumerate(sorted((p/'frames').glob('frame_*.vtu'))): frames.append({'frameId':f'PCCV-TRANSIENT-RUN-001-{i:04d}','time':(i+1)*0.001,'file':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
manifest={'runId':'PCCV-TRANSIENT-RUN-001','solver':'pimpleFoam','solverVersion':'OpenFOAM v2512','geometry':'lh2_reconstructed.stl','geometryStatus':'RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_OFFICIAL','physics':'incompressible Newtonian laminar Stokes','frameCount':len(frames),'frames':frames}
(p/'frames'/'frames_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
PY
