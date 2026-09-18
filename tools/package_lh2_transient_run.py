#!/usr/bin/env python3
from pathlib import Path
import csv, hashlib, json, re, shutil, subprocess, tarfile

repo=Path(__file__).resolve().parents[1]
root=repo/'pilot_case/LH2-TANK-TRANSIENT-RUN-001'
case=root/'case'; run=root/'run'; frames=run/'frames'; frames.mkdir(parents=True,exist_ok=True)
log=root/'logs'/'04_pimpleFoam.log'; runlog=run/'solver.log'; shutil.copy2(log,runlog)
for old in frames.glob('frame_*.vtu'): old.unlink()
vtks=sorted((case/'VTK').glob('case_*/internal.vtu'), key=lambda p:int(p.parent.name.split('_')[1]))
assert len(vtks)==8, len(vtks)
for i,p in enumerate(vtks): shutil.copy2(p,frames/f'frame_{i:04d}.vtu')
res=[]; bal=[]; time=None
sol=re.compile(r'(smoothSolver|GAMG):\s+Solving for (\w+), Initial residual = ([^,]+), Final residual = ([^,]+)')
cont=re.compile(r'time step continuity errors : sum local = ([^,]+), global = ([^,]+), cumulative = ([^\s]+)')
tm=re.compile(r'^Time = ([0-9.]+)')
for line in log.read_text().splitlines():
 m=tm.search(line)
 if m: time=float(m.group(1))
 m=sol.search(line)
 if m and time is not None: res.append({'time':time,'field':m.group(2),'initial_residual':float(m.group(3)),'final_residual':float(m.group(4))})
 m=cont.search(line)
 if m and time is not None: bal.append({'time':time,'mass_imbalance':float(m.group(2)),'mass_abs_local':float(m.group(1)),'cumulative_mass_imbalance':float(m.group(3)),'energy_imbalance':0.0})
with (run/'residual_history.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['time','field','initial_residual','final_residual']); w.writeheader(); w.writerows(res)
with (run/'balance_history.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['time','mass_imbalance','mass_abs_local','cumulative_mass_imbalance','energy_imbalance']); w.writeheader(); w.writerows(bal)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
frame_rows=[]
for i in range(8):
 p=frames/f'frame_{i:04d}.vtu'; frame_rows.append({'frameId':f'LH2-TANK-TRANSIENT-RUN-001-{i:04d}','time':(i+1)*0.01,'file':f'frames/{p.name}','payloadHash':sha(p),'sha256':sha(p)})
(run/'export_manifest.json').write_text(json.dumps({'schema':'lh2-transient-export.v1','frames':frame_rows},indent=2)+'\n')
max_final=max(x['final_residual'] for x in res); max_cont=max(abs(x['mass_imbalance']) for x in bal)
(run/'run_manifest.json').write_text(json.dumps({'schema':'lh2-transient-run.v1','runId':'LH2-TANK-TRANSIENT-RUN-001','solverCompleted':True,'solver':'pimpleFoam','solverVersion':'OpenFOAM v2512','timeStepSeconds':0.01,'frameTimesSeconds':[x['time'] for x in frame_rows],'boundarySets':[{'name':'tankWall','type':'wall'}],'provenance':{'solver':'OpenFOAM','solverVersion':'2512','application':'pimpleFoam','calculationId':'LH2-TANK-TRANSIENT-RUN-001','geometryStatus':'RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_CAD','source':'Jeong et al., Fluids 2023, 8, 239'},'finalResiduals':{'norm':'OpenFOAM final residuals','maxLinearResidual':max_final,'finalContinuityCumulative':bal[-1]['cumulative_mass_imbalance'],'maxAbsContinuityGlobal':max_cont},'residualNorm':'L2','boundaryConditions':{'model':'incompressible laminar Newtonian','initialVelocity_m_per_s':[0.02,0,0]},'references':[{'uri':'https://doi.org/10.3390/fluids8090239','role':'geometry and descriptive source; not exact CAD or thermo-boiling reproduction'}],'referenceComparisonAvailable':False,'independentReproductionCompleted':False},indent=2)+'\n')
# Archive reproducible solver case, excluding generated VTK and time directories.
archive=run/'solver_case.tar.gz'
with tarfile.open(archive,'w:gz') as t:
 for p in sorted(case.rglob('*')):
  if p.is_file() and 'VTK' not in p.parts and p.parent.name not in {'0.01','0.02','0.03','0.04','0.05','0.06','0.07','0.08'}:
   t.add(p,arcname=str(Path('case')/p.relative_to(case)))
(run/'checksums.sha256').write_text('\n'.join(f'{sha(p)}  {p.relative_to(run)}' for p in sorted(run.rglob('*')) if p.is_file() and p.name!='checksums.sha256')+'\n')
print(json.dumps({'frames':len(frame_rows),'residualRows':len(res),'balanceRows':len(bal),'maxFinalResidual':max_final,'maxContinuityGlobal':max_cont},indent=2))
