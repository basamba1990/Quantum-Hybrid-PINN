#!/usr/bin/env python3
import json,subprocess,sys,hashlib
from pathlib import Path
case=Path('/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-001'); frames=sorted((case/'frames').glob('frame_*.vtu'))
out=case/'sidecar.json'
cmd=[sys.executable,str(case.parent.parent/'tools/build_cfd_sidecar.py')]
for f in frames: cmd += ['--frame',str(f)]
cmd += ['--output',str(out),'--solver','pimpleFoam','--solver-version','OpenFOAM-2512','--calculation-id','PCCV-TRANSIENT-RUN-001','--classification','REAL_OPENFOAM_MONOPHASIC_RECONSTRUCTED_GEOMETRY_NOT_LH2_VALIDATION']
subprocess.run(cmd,check=True)
s=json.loads(out.read_text())
s['meshRevision']='PCCV-TRANSIENT-RUN-001-snappyHexMesh-v1'
s['boundarySets']=[{'name':x,'type':t} for x,t in [('inlet','patch'),('outlet','patch'),('sides','patch'),('tank','wall')]]
s['physicsContract']={'version':'physics-contract.v1','validated':False,'status':'BOUNDED_MONOPHASIC_RUN_NOT_LH2_THERMO_VALIDATION','model':'incompressible Newtonian laminar Stokes','note':'Real OpenFOAM transient solution on reconstructed closed geometry; not a diphasic LH2 validation.'}
s['executionEvidence']={'runLog':'logs/22_pimpleFoam_run001.log','runLogHash':hashlib.sha256((case/'logs/22_pimpleFoam_run001.log').read_bytes()).hexdigest(),'meshCheckLog':'logs/18_checkMesh_final.log','meshCheckLogHash':hashlib.sha256((case/'logs/18_checkMesh_final.log').read_bytes()).hexdigest(),'status':'COMPLETED'}
s['residuals']={'mass':max(abs(float(r['mass_imbalance'])) for r in __import__('csv').DictReader((case/'balance_history.csv').open())),'momentum':'SEE residual_history.csv','energy':None,'norm':'OPENFOAM_FINAL_RESIDUALS','computedBy':'build_transient_histories.py'}
s['references']=[{'id':'geometry-manifest','file':'../../deliverables/PILOT-LH2-TANK-THERMO-001/geometry_manifest.json','status':'reconstructed-not-official'}]
out.write_text(json.dumps(s,indent=2,ensure_ascii=False)+'\n')
print(out)
