#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, re
from pathlib import Path

def normalized(p: Path) -> str:
    s=p.read_text(errors='replace')
    s=re.sub(r'^(Date|Time|Host|PID|ExecutionTime).*$', '', s, flags=re.M)
    s=re.sub(r'^Case\s+:.*$', 'Case   : CASE_PATH', s, flags=re.M)
    s=re.sub(r'\s+',' ',s)
    return s.strip()
def sha(p):
    h=hashlib.sha256(); h.update(p.read_bytes()); return h.hexdigest()
root=Path('/home/ubuntu/Quantum-Hybrid-PINN/pilot_case/PILOT-PCCV-TRANSIENT-001/openfoam_reconstructed')
ind=Path('/tmp/PCCV-TRANSIENT-RUN-001-independent')
mainlog=root/'run/solver.log'; indlog=ind/'run/solver.log'
if not indlog.is_file() or not indlog.read_text(errors='replace').rstrip().endswith('End'): raise SystemExit('independent solver log is incomplete')
match=normalized(mainlog)==normalized(indlog)
report={'runId':'PCCV-TRANSIENT-RUN-001','independentRunDirectory':str(ind),'independentSolverCompleted':True,'mainSolverLogSha256':sha(mainlog),'independentSolverLogSha256':sha(indlog),'normalizedSolverTraceMatch':match,'independentOpenFOAMVersion':'2512','note':'Independent clean-directory rerun from the same committed case and geometry; runtime-only log metadata is excluded from normalized comparison.'}
(root/'run/independent_reproduction.json').write_text(json.dumps(report,indent=2)+'\n')
manifest=json.loads((root/'run/run_manifest.json').read_text()); manifest['independentReproductionCompleted']=True; manifest['independentReproduction']=report; (root/'run/run_manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(report,indent=2));
if not match: raise SystemExit('normalized solver traces differ')
