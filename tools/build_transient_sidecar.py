#!/usr/bin/env python3
"""Build a production-compatible cfd-volume.v1 sidecar after a real run."""
from __future__ import annotations
import argparse, hashlib, json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

def sha256(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(); p.add_argument('--run-id',required=True); p.add_argument('--run-dir',required=True,type=Path); p.add_argument('--output',required=True,type=Path); p.add_argument('--source-artifact',required=True,type=Path); p.add_argument('--topology-evidence',type=Path); p.add_argument('--mesh-quality',type=Path); p.add_argument('--physics-contract',type=Path); p.add_argument('--evidence-report',type=Path); p.add_argument('--reference',action='append',type=Path,default=[]); p.add_argument('--solver',default='pimpleFoam'); p.add_argument('--solver-version',default='unknown'); p.add_argument('--calculation-id',required=True); p.add_argument('--classification',default='REAL_OPENFOAM_LH2_VOF_REQUIRES_EXPERIMENTAL_VALIDATION'); p.add_argument('--mesh-revision',required=True); p.add_argument('--coordinate-system',default='cartesian-right-handed'); p.add_argument('--length-unit',default='m'); p.add_argument('--time-step',type=float,default=None)
    a=p.parse_args(); frames=sorted(a.run_dir.rglob('*.vtu'))
    if not frames: raise SystemExit('no .vtu frames found')
    if not a.source_artifact.is_file(): raise SystemExit(f'missing source artifact: {a.source_artifact}')
    # Delegate strict VTU parsing/topology validation to the canonical builder.
    builder=Path(__file__).with_name('build_cfd_sidecar.py'); tmp=a.output.with_suffix('.base.json')
    cmd=[sys.executable,str(builder)]
    for f in frames: cmd += ['--frame',str(f)]
    cmd += ['--output',str(tmp),'--solver',a.solver,'--solver-version',a.solver_version,'--calculation-id',a.calculation_id,'--classification',a.classification]
    if a.mesh_quality: cmd += ['--mesh-quality',str(a.mesh_quality)]
    if a.physics_contract: cmd += ['--physics-contract',str(a.physics_contract)]
    subprocess.run(cmd,check=True)
    side=json.loads(tmp.read_text(encoding='utf-8')); tmp.unlink(missing_ok=True)
    times=[float(i if a.time_step is None else i*a.time_step) for i in range(len(frames))]
    if any(b<=a0 for a0,b in zip(times,times[1:])): raise SystemExit('frame times are not strictly increasing')
    side.update({'contractVersion':'cfd-volume.v1','meshRevision':a.mesh_revision,'coordinateSystem':a.coordinate_system,'lengthUnit':a.length_unit,'provenance':{**side.get('provenance',{}),'sourceHash':sha256(a.source_artifact),'solver':a.solver,'solverVersion':a.solver_version,'calculationId':a.calculation_id,'generatedAt':datetime.now(timezone.utc).isoformat()},'frames':[{'frameId':f'{a.run_id}-{i:04d}','time':t,'file':f.name,'payloadHash':sha256(f)} for i,(f,t) in enumerate(zip(frames,times))]})
    side.setdefault('boundarySets',[]); side.setdefault('references',[]); side.setdefault('fieldDescriptors',{}); side.setdefault('physicsContract',{'version':'physics-contract.v1','validated':False,'status':'NOT_VALIDATED'}); side.setdefault('meshQuality',{'validated':False,'reason':'No reviewed report supplied'}); side.setdefault('topologyEvidence',{'closedDomain':False,'tool':'UNSPECIFIED','toolVersion':'UNSPECIFIED','proofType':'UNSPECIFIED','meshSha256':sha256(a.source_artifact),'reportSha256':'','limitations':'Topology evidence must be supplied by an independent report.'})
    if a.topology_evidence:
        side['topologyEvidence']=json.loads(a.topology_evidence.read_text(encoding='utf-8'))
        side['topologyEvidence'].setdefault('meshSha256',sha256(a.source_artifact)); side['topologyEvidence']['reportSha256']=sha256(a.topology_evidence)
        side['references'].append({'id':'topology-evidence','title':'Independent topology evidence','uri':f'urn:artifact:{a.topology_evidence.name}','comparisonHash':sha256(a.topology_evidence)})
    for ref in a.reference:
        side['references'].append({'id':ref.stem,'title':ref.name,'uri':f'urn:artifact:{ref.name}','comparisonHash':sha256(ref)})
    report=json.loads(a.evidence_report.read_text()) if a.evidence_report else {}
    side['residuals']=report.get('residuals',{'mass':None,'momentum':None,'energy':None,'norm':'OPENFOAM_FINAL_RESIDUALS','computedBy':None})
    side['executionEvidence']=report.get('evidence',{'solverLogHash':None,'residualsParsed':False,'balanceParsed':False,'noSyntheticValues':True})
    side['evidence']={**side.get('evidence',{}),'solverResiduals':all(side['residuals'].get(k) is not None for k in ('mass','momentum','energy')),'immutableHashes':True,'calculatedTransientStates':len(frames)>=2}
    a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(side,indent=2,ensure_ascii=False)+'\n',encoding='utf-8'); print(a.output)
if __name__=='__main__': main()
