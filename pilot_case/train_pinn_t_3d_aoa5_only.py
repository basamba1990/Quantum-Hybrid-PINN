#!/usr/bin/env python3
"""PINN-T 3D strict: train data must be an AoA=5-only NPZ; AoA17 is never opened."""
import argparse, hashlib, json, re
from pathlib import Path
import numpy as np
import torch
from torch import nn


def sha256(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1<<20),b''): h.update(b)
    return h.hexdigest()


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--train-npz', required=True)
    ap.add_argument('--config', required=True)
    ap.add_argument('--output-dir', required=True)
    args=ap.parse_args()
    train=Path(args.train_npz).resolve(); cfgp=Path(args.config).resolve(); out=Path(args.output_dir).resolve()
    if not train.is_file(): raise FileNotFoundError(train)
    if not cfgp.is_file(): raise FileNotFoundError(cfgp)
    if re.search(r'aoa\s*17|aoa17|17deg', str(train).lower()): raise ValueError('AoA17 path is forbidden during training')
    cfg=json.loads(cfgp.read_text())
    if float(cfg.get('train_aoa_deg')) != 5.0 or cfg.get('evaluation_access_during_training') is not False:
        raise ValueError('training config must declare train_aoa_deg=5 and evaluation_access_during_training=false')
    d=np.load(train, allow_pickle=False)
    required={'xyz','target'}
    if not required.issubset(d.files): raise ValueError('NPZ must contain xyz and target')
    xyz=np.asarray(d['xyz'],dtype=np.float32); target=np.asarray(d['target'],dtype=np.float32)
    if xyz.ndim!=2 or xyz.shape[1]!=3 or target.ndim!=2 or target.shape[0]!=xyz.shape[0] or target.shape[1]<4: raise ValueError('expected xyz[N,3], target[N,>=4]')
    if not np.isfinite(xyz).all() or not np.isfinite(target).all(): raise ValueError('non-finite AoA5 data')
    torch.manual_seed(int(cfg['seed'])); np.random.seed(int(cfg['seed']))
    class Net(nn.Module):
        def __init__(self):
            super().__init__(); self.net=nn.Sequential(nn.Linear(4,64),nn.Tanh(),nn.Linear(64,64),nn.Tanh(),nn.Linear(64,64),nn.Tanh(),nn.Linear(64,5))
        def forward(self,t,x,y,z): return self.net(torch.cat([t,x,y,z],1))
    model=Net(); opt=torch.optim.Adam(model.parameters(),lr=float(cfg['learning_rate']))
    x=torch.tensor(xyz); y=torch.tensor(target[:,:5] if target.shape[1]>=5 else np.pad(target,((0,0),(0,5-target.shape[1])))); t=torch.zeros((len(x),1))
    # Supervised AoA5 anchors plus a differentiable steady continuity residual.
    hist=[]
    for epoch in range(int(cfg['epochs'])):
        opt.zero_grad(); pred=model(t,x[:,0:1],x[:,1:2],x[:,2:3]); data=((pred-y)**2).mean()
        xx=x[:,0:1].detach().requires_grad_(True); yy=x[:,1:2].detach().requires_grad_(True); zz=x[:,2:3].detach().requires_grad_(True)
        q=model(t,xx,yy,zz); rho=torch.clamp(q[:,0:1],min=1e-4); u,v,w=q[:,1:2],q[:,2:3],q[:,3:4]
        drx=torch.autograd.grad(rho,xx,torch.ones_like(rho),create_graph=True)[0]; dry=torch.autograd.grad(rho,yy,torch.ones_like(rho),create_graph=True)[0]; drz=torch.autograd.grad(rho,zz,torch.ones_like(rho),create_graph=True)[0]
        dux=torch.autograd.grad(u,xx,torch.ones_like(u),create_graph=True)[0]; duy=torch.autograd.grad(u,yy,torch.ones_like(u),create_graph=True)[0]; duz=torch.autograd.grad(u,zz,torch.ones_like(u),create_graph=True)[0]
        dvx=torch.autograd.grad(v,xx,torch.ones_like(v),create_graph=True)[0]; dvy=torch.autograd.grad(v,yy,torch.ones_like(v),create_graph=True)[0]; dvz=torch.autograd.grad(v,zz,torch.ones_like(v),create_graph=True)[0]
        dwx=torch.autograd.grad(w,xx,torch.ones_like(w),create_graph=True)[0]; dwy=torch.autograd.grad(w,yy,torch.ones_like(w),create_graph=True)[0]; dwz=torch.autograd.grad(w,zz,torch.ones_like(w),create_graph=True)[0]
        cont=(rho*dux+rho*dvy+rho*dwz+u*drx+v*dry+w*drz).pow(2).mean()
        loss=data+float(cfg['physics_weight'])*cont; loss.backward(); opt.step()
        if epoch==0 or (epoch+1)%int(cfg['log_every'])==0: hist.append({'epoch':epoch+1,'loss':float(loss.detach()),'data_loss':float(data.detach()),'continuity_loss':float(cont.detach())})
    out.mkdir(parents=True,exist_ok=True); ck=out/'pinn_t_3d_aoa5_only.pt'; torch.jit.script(model.eval()).save(str(ck))
    (out/'history.jsonl').write_text('\n'.join(json.dumps(r) for r in hist)+'\n')
    meta={'schema':'pinn-t-3d-training.v1','status':'TRAINED_AOA5_ONLY','train_aoa_deg':5.0,'evaluation_access_during_training':False,'train_npz_sha256':sha256(train),'config_sha256':sha256(cfgp),'checkpoint_sha256':sha256(ck),'point_count':len(x),'epochs':int(cfg['epochs'])}
    (out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n'); print(json.dumps(meta))

if __name__=='__main__': main()
