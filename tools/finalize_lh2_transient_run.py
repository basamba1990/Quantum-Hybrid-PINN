#!/usr/bin/env python3
from pathlib import Path
import csv, hashlib, json, re, shutil, subprocess
repo=Path(__file__).resolve().parents[1]; root=repo/'pilot_case/LH2-TANK-TRANSIENT-RUN-001'; run=root/'run'; ind=root/'independent_case'; log= root/'logs'/'05_pimpleFoam_independent.log'

def parse(p):
 rows=[]; bal=[]; t=None
 sol=re.compile(r'(smoothSolver|GAMG):\s+Solving for (\w+), Initial residual = ([^,]+), Final residual = ([^,]+)')
 con=re.compile(r'time step continuity errors : sum local = ([^,]+), global = ([^,]+), cumulative = ([^\s]+)')
 for line in p.read_text().splitlines():
  m=re.match(r'^Time = ([0-9.]+)',line)
  if m:t=float(m.group(1))
  m=sol.search(line)
  if m and t is not None: rows.append((t,m.group(2),float(m.group(3)),float(m.group(4))))
  m=con.search(line)
  if m and t is not None: bal.append((t,float(m.group(1)),float(m.group(2)),float(m.group(3))))
 return rows,bal
main,mb=parse(run/'solver.log'); other,ob=parse(log)
assert len(main)==len(other)==112,(len(main),len(other)); assert len(mb)==len(ob)==32
maxdiff=max(abs(a[3]-b[3]) for a,b in zip(main,other)); baldiff=max(abs(a[3]-b[3]) for a,b in zip(mb,ob))
comparison={'runId':'LH2-TANK-TRANSIENT-RUN-001','mainSolverLogSha256':hashlib.sha256((run/'solver.log').read_bytes()).hexdigest(),'independentSolverLogSha256':hashlib.sha256(log.read_bytes()).hexdigest(),'mainResidualRows':len(main),'independentResidualRows':len(other),'mainBalanceRows':len(mb),'independentBalanceRows':len(ob),'maxAbsFinalResidualDifference':maxdiff,'maxAbsCumulativeContinuityDifference':baldiff,'normalizedSolverTraceMatch':maxdiff==0.0 and baldiff==0.0,'independentOpenFOAMVersion':'2512','note':'Independent clean-directory rerun from the same committed case and geometry; wall-clock metadata is excluded.'}
(run/'independent_reproduction.json').write_text(json.dumps(comparison,indent=2)+'\n')
manifest=json.loads((run/'run_manifest.json').read_text()); manifest['independentReproductionCompleted']=True; manifest['independentReproduction']=comparison
(run/'run_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(comparison,indent=2))
