#!/usr/bin/env python3
"""Train a 2-D NACA0012 baseline PINN from a declared SU2 VTU field.

This is a CFD-anchored baseline, not an independent validation: using the same
CFD field for training and comparison is explicitly recorded as data leakage.
"""
from __future__ import annotations
import argparse, hashlib, json, random
from datetime import datetime, timezone
from pathlib import Path
import numpy as np


def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024), b''): h.update(b)
    return h.hexdigest()


def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--config', type=Path, required=True)
    args=ap.parse_args()
    cfg=json.loads(args.config.read_text(encoding='utf-8'))
    required=('case_id','training_id','input','physics','model','optimization','outputs')
    missing=[x for x in required if x not in cfg]
    if missing: raise ValueError('config missing: '+', '.join(missing))
    if cfg['input']['coordinate_system']!='cartesian-2d-embedded-z0' or cfg['input']['length_unit']!='m':
        raise ValueError('unsupported coordinate contract')
    if cfg['model']['output_names']!=['rho','u','v','w','T'] or cfg['model']['input_names']!=['time','x','y','z']:
        raise ValueError('model contract must be [time,x,y,z] -> [rho,u,v,w,T]')
    root=args.config.parent
    input_key = 'flow_csv' if 'flow_csv' in cfg['input'] else 'flow_vtu'
    flow=(root / cfg['input'][input_key]).resolve()
    if not flow.is_file(): raise FileNotFoundError(f'CFD input not found: {flow}')
    try:
        import torch
        import torch.nn as nn
        from read_su2_restart_csv import read_restart_csv
    except ImportError as exc:
        raise RuntimeError(f'required dependency unavailable: {exc}') from exc
    seed=int(cfg['optimization']['seed'])
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)
    R=float(cfg['physics']['gas_constant_j_kg_k']); gamma=float(cfg['physics']['gamma'])
    if R<=0 or not np.isfinite(R): raise ValueError('gas constant must be finite and positive')
    if input_key == 'flow_csv':
        p, fields = read_restart_csv(flow, gamma, R)
        rho=np.asarray(fields['Density'],dtype=np.float32).reshape(-1)
        mom=np.asarray(fields['Momentum'],dtype=np.float32)
        pressure=np.asarray(fields['Pressure'],dtype=np.float32).reshape(-1)
        T=np.asarray(fields['Temperature'],dtype=np.float32).reshape(-1)
    else:
        raise ValueError('VTU training input is unsupported; use the coherent SU2 restart CSV')
    if mom.ndim!=2 or mom.shape[1]<2 or len(p)!=len(rho) or len(p)!=len(mom) or len(p)!=len(pressure) or len(p)!=len(T):
        raise ValueError('CFD field dimensions are incompatible')
    u=mom[:,0]/rho; v=mom[:,1]/rho; w=np.zeros_like(u)
    targets=np.column_stack([rho,u,v,w,T]).astype(np.float32)
    if not np.isfinite(p).all() or not np.isfinite(targets).all() or (rho<=0).any() or (T<=0).any():
        raise ValueError('non-finite or nonphysical CFD training target')
    device=torch.device(str(cfg['optimization']['device']))
    x=torch.tensor(p[:,0:1],device=device); y=torch.tensor(p[:,1:2],device=device); z=torch.tensor(p[:,2:3],device=device)
    t=torch.full_like(x,float(cfg['input']['time_value_s']))
    target=torch.tensor(targets,device=device)
    class Net(nn.Module):
        def __init__(self, layers):
            super().__init__(); modules=[]
            dims=[4]+[int(q) for q in layers]+[5]
            for i in range(len(dims)-2): modules += [nn.Linear(dims[i],dims[i+1]),nn.Tanh()]
            modules += [nn.Linear(dims[-2],dims[-1])]
            self.net=nn.Sequential(*modules)
        def forward(self, t, x, y, z): return self.net(torch.cat([t,x,y,z],dim=1))
    model=Net(cfg['model']['hidden_layers']).to(device)
    opt=torch.optim.Adam(model.parameters(),lr=float(cfg['optimization']['learning_rate']))
    gamma=float(cfg['physics']['gamma']); rho_ref=float(cfg['physics']['reference_density_kg_m3'])
    physics_weight=float(cfg['optimization']['physics_weight']); data_weight=float(cfg['optimization']['data_weight'])
    if not np.isfinite(gamma) or gamma <= 1 or not np.isfinite(rho_ref) or rho_ref <= 0:
        raise ValueError('gamma and reference_density must be finite and positive')
    u_ref=float(np.max(np.abs(targets[:,1:3])))
    p_ref=float(np.max(np.abs(pressure)))
    if not np.isfinite(u_ref) or u_ref <= 0 or not np.isfinite(p_ref) or p_ref <= 0:
        raise ValueError('observed CFD scales must be finite and positive')
    out_root=(root / cfg['outputs']['torchscript_checkpoint']).resolve().parent; out_root.mkdir(parents=True,exist_ok=True)
    history_path=(root / cfg['outputs']['history']).resolve(); history_path.parent.mkdir(parents=True,exist_ok=True)
    if (root / cfg['outputs']['torchscript_checkpoint']).exists(): raise FileExistsError('checkpoint output already exists')
    history=[]
    for epoch in range(int(cfg['optimization']['epochs'])):
        opt.zero_grad(set_to_none=True)
        tt=t.detach().clone().requires_grad_(True); xx=x.detach().clone().requires_grad_(True); yy=y.detach().clone().requires_grad_(True); zz=z.detach().clone().requires_grad_(True)
        pred=model(tt,xx,yy,zz); prho,pu,pv,pw,pT=[pred[:,i:i+1] for i in range(5)]
        data=((pred-target)**2).mean()
        def grad(q, var):
            g=torch.autograd.grad(q.sum(),var,create_graph=True,allow_unused=False)[0]
            return g
        rho_x=grad(prho,xx); rho_y=grad(prho,yy); u_x=grad(pu,xx); u_y=grad(pu,yy); v_x=grad(pv,xx); v_y=grad(pv,yy); pfield=prho*float(cfg['physics']['gas_constant_j_kg_k'])*pT
        p_x=grad(pfield,xx); p_y=grad(pfield,yy)
        continuity=(pu*rho_x+prho*u_x+pv*rho_y+prho*v_y)/(rho_ref*max(u_ref,1e-12))
        momx=(prho*(pu*u_x+pv*u_y)+p_x)/p_ref
        momy=(prho*(pu*v_x+pv*v_y)+p_y)/p_ref
        physics=(continuity**2+momx**2+momy**2).mean()
        loss=data_weight*data+physics_weight*physics
        if not torch.isfinite(loss): raise ValueError(f'non-finite training loss at epoch {epoch}')
        loss.backward(); opt.step()
        if epoch==0 or (epoch+1)%int(cfg['optimization']['log_every'])==0 or epoch+1==int(cfg['optimization']['epochs']):
            row={'epoch':epoch,'loss':float(loss.detach()),'data_loss':float(data.detach()),'physics_loss':float(physics.detach())}; history.append(row)
            print(json.dumps(row))
    model.eval(); scripted=torch.jit.script(model.cpu())
    ckpt=root / cfg['outputs']['torchscript_checkpoint']; scripted.save(str(ckpt))
    meta={'schema':'pinn-training-metadata.v1','case_id':cfg['case_id'],'training_id':cfg['training_id'],'status':'CFD_ANCHORED_BASELINE_NOT_INDEPENDENT','config_sha256':sha256(args.config),'source_cfd_vtu_sha256':sha256(flow),'checkpoint_sha256':sha256(ckpt),'checkpoint_bytes':ckpt.stat().st_size,'seed':seed,'point_count':len(p),'model_input_names':cfg['model']['input_names'],'model_output_names':cfg['model']['output_names'],'data_leakage_notice':cfg['independence_notice'],'created_at':datetime.now(timezone.utc).isoformat().replace('+00:00','Z')}
    meta_path=root / cfg['outputs']['metadata']; meta_path.parent.mkdir(parents=True,exist_ok=True); meta_path.write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    history_path.write_text('\n'.join(json.dumps(x) for x in history)+'\n',encoding='utf-8')
    print(json.dumps({'status':meta['status'],'checkpoint':str(ckpt),'checkpoint_sha256':meta['checkpoint_sha256'],'metadata':str(meta_path)}))
    return 0

if __name__=='__main__':
    try: raise SystemExit(main())
    except (OSError,ValueError,RuntimeError,ImportError) as exc:
        print(f'FAIL: {exc}'); raise SystemExit(2)
