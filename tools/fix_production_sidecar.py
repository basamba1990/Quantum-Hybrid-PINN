#!/usr/bin/env python3
import json
from pathlib import Path
p=Path('/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-001/sidecar.json')
s=json.loads(p.read_text())
s['fieldDescriptors']={
 'p': {'unit':'Pa','quantity':'pressure'},
 'U': {'unit':'m/s','quantity':'velocity'},
}
for i,f in enumerate(s['frames']): f['time']=(i+1)*0.001
p.write_text(json.dumps(s,indent=2,ensure_ascii=False)+'\n')
print(p)
