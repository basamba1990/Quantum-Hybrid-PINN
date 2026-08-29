#!/usr/bin/env python3
"""Run a declared TorchScript PINN and compare it directly with SU2 VTU fields.

Fail-closed: no checkpoint, no compatible contract, missing CFD fields, non-finite
values, or ambiguous units results in an error. This script never fabricates data.
"""
from __future__ import annotations
import argparse, hashlib, json, math
from pathlib import Path
import numpy as np


def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()


def metrics(pred: np.ndarray, ref: np.ndarray) -> dict:
    delta=pred-ref
    denom=float(np.linalg.norm(ref))
    return {
      'count': int(pred.size),
      'l1_mean': float(np.mean(np.abs(delta))),
      'l2_rmse': float(np.sqrt(np.mean(delta**2))),
      'max_abs': float(np.max(np.abs(delta))),
      'relative_l2': None if denom == 0 else float(np.linalg.norm(delta)/denom),
    }


def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--checkpoint', type=Path, required=True)
    ap.add_argument('--flow-vtu', type=Path, required=True)
    ap.add_argument('--contract', type=Path, required=True)
    ap.add_argument('--time', type=float, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--seed', type=int, required=True)
    args=ap.parse_args()
    contract=json.loads(args.contract.read_text(encoding='utf-8'))
    required_contract=['case_id','coordinate_system','length_unit','time_unit','model_type','model_output_names','reference_field_mapping']
    missing=[x for x in required_contract if x not in contract]
    if missing: raise ValueError('contract missing: '+', '.join(missing))
    if contract['model_type'] != 'torchscript':
        raise ValueError('only explicitly declared torchscript checkpoints are supported')
    names=contract['model_output_names']
    if names != ['rho','u','v','w','T']:
        raise ValueError('model_output_names must be exactly [rho,u,v,w,T]')
    if contract['coordinate_system'] != 'cartesian-2d-embedded-z0' or contract['length_unit'] != 'm':
        raise ValueError('unsupported or undeclared coordinate contract')
    if not args.checkpoint.is_file() or not args.flow_vtu.is_file():
        raise FileNotFoundError('checkpoint or CFD VTU is missing')
    try:
        import meshio
        import torch
    except ImportError as exc:
        raise RuntimeError(f'required dependency unavailable: {exc}') from exc
    mesh=meshio.read(args.flow_vtu)
    pts=np.asarray(mesh.points, dtype=np.float32)
    if pts.ndim != 2 or pts.shape[1] < 2 or not np.isfinite(pts[:,:3]).all():
        raise ValueError('invalid CFD coordinates')
    pd=mesh.point_data
    mapping=contract['reference_field_mapping']
    for field in ('Density','Momentum'):
        if field not in pd: raise ValueError(f'CFD field missing: {field}')
    rho_ref=np.asarray(pd['Density']).reshape(-1)
    mom=np.asarray(pd['Momentum'])
    if mom.ndim != 2 or mom.shape[1] < 2 or len(rho_ref)!=len(pts) or len(mom)!=len(pts):
        raise ValueError('incompatible CFD density/momentum arrays')
    if not np.isfinite(rho_ref).all() or not np.isfinite(mom).all() or np.any(rho_ref <= 0):
        raise ValueError('CFD density/momentum contains invalid values')
    ref_u=mom[:,0]/rho_ref
    ref_v=mom[:,1]/rho_ref
    if not np.isfinite(ref_u).all() or not np.isfinite(ref_v).all(): raise ValueError('derived CFD velocity is non-finite')
    torch.manual_seed(args.seed)
    model=torch.jit.load(str(args.checkpoint), map_location='cpu')
    model.eval()
    t=torch.full((len(pts),1), float(args.time), dtype=torch.float32)
    xyz=torch.from_numpy(pts[:,:3])
    with torch.no_grad():
        out=model(t, xyz[:,0:1], xyz[:,1:2], xyz[:,2:3])
    if isinstance(out,(tuple,list)):
        out=torch.cat([x if x.ndim==2 else x.reshape(-1,1) for x in out], dim=1)
    if not hasattr(out,'shape') or tuple(out.shape) != (len(pts),5):
        raise ValueError(f'PINN output must have shape ({len(pts)},5)')
    pred=out.detach().cpu().numpy()
    if not np.isfinite(pred).all(): raise ValueError('PINN output contains non-finite values')
    result={
      'schema':'pinn-cfd-direct-comparison.v1',
      'status':'COMPARISON_COMPLETED',
      'case_id':contract['case_id'],
      'checkpoint':{'path':args.checkpoint.name,'sha256':sha256(args.checkpoint),'bytes':args.checkpoint.stat().st_size},
      'reference':{'path':args.flow_vtu.name,'sha256':sha256(args.flow_vtu),'bytes':args.flow_vtu.stat().st_size,'field_mapping':mapping,'velocity_derivation':'Momentum / Density'},
      'contract_sha256':sha256(args.contract),
      'seed':args.seed,'time':args.time,'point_count':len(pts),
      'metrics':{'u':metrics(pred[:,1],ref_u),'v':metrics(pred[:,2],ref_v)},
      'pinn_fields':names,
      'comparison_scope':'u,v only; pressure, temperature and density comparison unavailable unless declared CFD fields and mapping are added',
      'decision':'INCONCLUSIVE_NO_ACCEPTANCE_CRITERIA',
    }
    if args.output.exists(): raise FileExistsError(f'output exists: {args.output}')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps(result))
    return 0

if __name__=='__main__':
    try: raise SystemExit(main())
    except (OSError,ValueError,RuntimeError,KeyError,ImportError) as exc:
        print(f'FAIL: {exc}')
        raise SystemExit(2)
