#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, json
from pathlib import Path
import matplotlib.pyplot as plt


def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',type=Path,default=Path('pilot_case'))
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args(); root=args.root.resolve(); out=args.out.resolve(); out.mkdir(parents=True,exist_ok=True)
    hist=root/'runs/CFD-REFERENCE-002/history.csv'; train=root/'runs/PINN-TRAIN-001/training_history.jsonl'; comp=root/'runs/PINN-COMPARISON-001/comparison.json'
    rows=[]
    with hist.open(newline='',encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            if r.get('Time_Iter','').strip(): rows.append(r)
    rows=[{k.strip().strip('"'):v.strip() for k,v in r.items()} for r in rows]
    it=[int(float(r['Inner_Iter'])) for r in rows]
    residuals={k:[10**float(r[k]) for r in rows] for k in ('rms[Rho]','rms[RhoU]','rms[RhoV]','rms[RhoE]')}
    plt.figure(figsize=(10,6));
    for k,v in residuals.items(): plt.semilogy(it,v,label=k.strip())
    plt.xlabel('SU2 inner iteration'); plt.ylabel('Residual (linearized from log10 history)'); plt.title('PILOT-001 — SU2 residual history'); plt.grid(True,which='both',alpha=.25); plt.legend(); plt.tight_layout(); plt.savefig(out/'su2_residual_history.png',dpi=180); plt.close()
    cd=[float(r['CD']) for r in rows]; cl=[float(r['CL']) for r in rows]
    plt.figure(figsize=(10,6)); plt.plot(it,cd,label='CD'); plt.plot(it,cl,label='CL'); plt.axhline(0,color='black',lw=.7); plt.xlabel('SU2 inner iteration'); plt.ylabel('Coefficient'); plt.title('PILOT-001 — SU2 force coefficients'); plt.grid(True,alpha=.25); plt.legend(); plt.tight_layout(); plt.savefig(out/'su2_force_coefficients.png',dpi=180); plt.close()
    train_rows=[json.loads(x) for x in train.read_text().splitlines() if x.strip()]
    epochs=[x['epoch'] for x in train_rows]; loss=[x['loss'] for x in train_rows]; physics=[x['physics_loss'] for x in train_rows]
    plt.figure(figsize=(10,6)); plt.semilogy(epochs,loss,label='total loss'); plt.semilogy(epochs,physics,label='physics loss'); plt.xlabel('Epoch'); plt.ylabel('Loss'); plt.title('PILOT-001 — PINN training history'); plt.grid(True,which='both',alpha=.25); plt.legend(); plt.tight_layout(); plt.savefig(out/'pinn_training_history.png',dpi=180); plt.close()
    c=json.loads(comp.read_text()); labels=['u relative L2','v relative L2']; vals=[c['metrics']['u']['relative_l2'],c['metrics']['v']['relative_l2']]
    plt.figure(figsize=(7,5)); plt.bar(labels,vals); plt.ylabel('Relative L2 error'); plt.title('PILOT-001 — same-CFD anchored comparison'); plt.grid(axis='y',alpha=.25); plt.tight_layout(); plt.savefig(out/'pinn_cfd_relative_errors.png',dpi=180); plt.close()
    summary={'source_files':[str(hist),str(train),str(comp)],'figures':['su2_residual_history.png','su2_force_coefficients.png','pinn_training_history.png','pinn_cfd_relative_errors.png'],'status':'VISUALIZATIONS_FROM_OBSERVED_ARTIFACTS_NOT_VALIDATION'}
    (out/'visualization_manifest.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary)); return 0
if __name__=='__main__': raise SystemExit(main())
