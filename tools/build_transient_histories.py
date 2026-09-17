#!/usr/bin/env python3
import csv,re
from pathlib import Path
case=Path('/tmp/Quantum-Hybrid-PINN/runs/PCCV-TRANSIENT-RUN-001')
log=(case/'logs/22_pimpleFoam_run001.log').read_text()
res=[]; bal=[]; t=None
for line in log.splitlines():
    m=re.match(r'Time = ([0-9.eE+-]+)',line)
    if m: t=float(m.group(1))
    m=re.search(r'(smoothSolver|GAMG):\s+Solving for (\w+), Initial residual = ([^,]+), Final residual = ([^,]+)',line)
    if m and t is not None: res.append({'time':t,'field':m.group(2),'initial_residual':float(m.group(3)),'final_residual':float(m.group(4))})
    m=re.search(r'time step continuity errors : sum local = ([^,]+), global = ([^,]+), cumulative = ([^\s]+)',line)
    if m and t is not None: bal.append({'time':t,'mass_imbalance':float(m.group(2)),'mass_abs_local':float(m.group(1)),'cumulative_mass_imbalance':float(m.group(3)),'energy_imbalance':0.0})
with (case/'residual_history.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['time','field','initial_residual','final_residual']); w.writeheader(); w.writerows(res)
with (case/'balance_history.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['time','mass_imbalance','mass_abs_local','cumulative_mass_imbalance','energy_imbalance']); w.writeheader(); w.writerows(bal)
print({'residual_rows':len(res),'balance_rows':len(bal),'times':sorted(set(x['time'] for x in bal))})
