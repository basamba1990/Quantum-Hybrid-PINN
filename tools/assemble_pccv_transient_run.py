#!/usr/bin/env python3
"""Assemble a real OpenFOAM transient export into the repository sidecar contract."""
from __future__ import annotations
import argparse, csv, hashlib, json, re, shutil, subprocess, tarfile
from datetime import datetime, timezone
from pathlib import Path

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest()

def main() -> int:
    ap=argparse.ArgumentParser(); ap.add_argument('--case-dir',type=Path,required=True); ap.add_argument('--run-id',default='PCCV-TRANSIENT-RUN-001'); a=ap.parse_args()
    case=a.case_dir.resolve(); run=case/'run'; frames=run/'frames'; frames.mkdir(parents=True,exist_ok=True)
    for p in frames.glob('frame_*.vtu'): p.unlink()
    vtk=case/'VTK'
    # foamToVTK writes 0.000000 as suffix 1; omit the duplicate 0 output.
    source_dirs=['openfoam_reconstructed_1','openfoam_reconstructed_10','openfoam_reconstructed_20','openfoam_reconstructed_30','openfoam_reconstructed_40','openfoam_reconstructed_50','openfoam_reconstructed_60','openfoam_reconstructed_70']
    times=[0.0,0.01,0.02,0.03,0.04,0.05,0.06,0.07]
    frame_records=[]
    for i,(src,t) in enumerate(zip(source_dirs,times)):
        src_file=vtk/src/'internal.vtu'; dst=frames/f'frame_{i:04d}.vtu'
        if not src_file.is_file(): raise SystemExit(f'missing exported VTU: {src_file}')
        shutil.copyfile(src_file,dst)
        frame_records.append({'frameId':f'{a.run_id}-{i:04d}','time':t,'file':f'frames/{dst.name}','payloadHash':sha256(dst)})
    log=(run/'solver.log').read_text(errors='replace')
    current=None; rows=[]; last={}; cont=None
    for line in log.splitlines():
        m=re.match(r'Time = ([0-9.eE+-]+)',line)
        if m:
            current=float(m.group(1)); last={}; cont=None
        m=re.search(r'(?:smoothSolver|GAMG):\s+Solving for (Ux|Uy|Uz|p), .*Final residual = ([0-9.eE+-]+)',line)
        if m and current is not None: last[m.group(1)]=float(m.group(2))
        m=re.search(r'time step continuity errors : sum local = ([0-9.eE+-]+), global = ([0-9.eE+-]+), cumulative = ([0-9.eE+-]+)',line)
        if m and current is not None: cont=tuple(float(x) for x in m.groups())
        if 'ExecutionTime =' in line and current is not None:
            vals=list(last.values()); rows.append({'time':current,'final_residual_max':max(vals) if vals else '','continuity_sum_local':cont[0] if cont else '','continuity_global':cont[1] if cont else '','continuity_cumulative':cont[2] if cont else ''})
    with (run/'residual_history.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['time','final_residual_max']); w.writeheader(); [w.writerow({k:r[k] for k in w.fieldnames}) for r in rows]
    with (run/'balance_history.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['time','continuity_sum_local','continuity_global','continuity_cumulative']); w.writeheader(); [w.writerow({k:r[k] for k in w.fieldnames}) for r in rows]
    mesh_log=(run/'checkMesh.log').read_text(errors='replace')
    solver_version=re.search(r'OPENFOAM=([^\s]+)',log); final_cont=rows[-1]['continuity_cumulative'] if rows else None
    case_tar=run/'solver_case.tar.gz'
    with tarfile.open(case_tar,'w:gz') as tar:
        for rel in ['system','constant','0.000000']:
            tar.add(case/rel,arcname=rel)
        tar.add(case/'analytic_geometry' if (case/'analytic_geometry').exists() else case/'constant/triSurface',arcname='geometry_source')
    manifest={'schema':'pccv-transient-run.v1','runId':a.run_id,'solverCompleted':log.rstrip().endswith('End'),'timeStepSeconds':0.001,'frameTimesSeconds':times,'boundarySets':[{'name':n,'type':'patch'} for n in ['inlet','outlet','sideWalls','front','back','pccvWall']], 'provenance':{'solver':'OpenFOAM','solverVersion':solver_version.group(1) if solver_version else 'unknown','application':'pimpleFoam','sourceUri':'https://www.mdpi.com/2076-0825/13/3/110','calculationId':a.run_id,'generatedAt':datetime.now(timezone.utc).isoformat(),'geometryStatus':'RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_OFFICIAL'},'finalResiduals':{'norm':'L2','maxLinearResidual':max((r['final_residual_max'] for r in rows if r['final_residual_max']!=''),default=None),'finalContinuityCumulative':final_cont},'residualNorm':'L2','boundaryConditions':{'inletVelocity_m_per_s':[1,0,0],'outletPressure_Pa':0,'fluid':'incompressible Newtonian laminar'},'references':[{'uri':'https://www.mdpi.com/2076-0825/13/3/110','role':'descriptive source only; not exact CAD or numerical reproduction'}],'referenceComparisonAvailable':False,'independentReproductionCompleted':False}
    (run/'run_manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    (run/'export_manifest.json').write_text(json.dumps({'schema':'cfd-export.v1','frames':frame_records},indent=2)+'\n')
    print(json.dumps({'runDir':str(run),'frames':len(frame_records),'solverCompleted':manifest['solverCompleted'],'finalContinuityCumulative':final_cont},indent=2)); return 0
if __name__=='__main__': raise SystemExit(main())
