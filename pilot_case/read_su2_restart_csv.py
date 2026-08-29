from __future__ import annotations
import csv
from pathlib import Path
import numpy as np

REQUIRED = ('x','y','Density','Momentum_x','Momentum_y','Energy')

def read_restart_csv(path: Path, gamma: float, gas_constant: float):
    if gamma <= 1 or gas_constant <= 0: raise ValueError('invalid gamma or gas constant')
    rows=[]
    with path.open(newline='', encoding='utf-8') as f:
        reader=csv.DictReader(f)
        if reader.fieldnames is None or any(k not in reader.fieldnames for k in REQUIRED):
            raise ValueError('restart CSV missing required columns')
        for row in reader: rows.append(row)
    if not rows: raise ValueError('restart CSV is empty')
    def arr(k):
        try: return np.asarray([float(r[k]) for r in rows], dtype=np.float32)
        except (KeyError,TypeError,ValueError) as exc: raise ValueError(f'invalid numeric column: {k}') from exc
    x,y,rho,mx,my,energy=[arr(k) for k in REQUIRED]
    u=mx/rho; v=my/rho
    cv=gas_constant/(gamma-1.0)
    temperature=(energy/rho-0.5*(u*u+v*v))/cv
    pressure=rho*gas_constant*temperature
    points=np.column_stack([x,y,np.zeros_like(x)]).astype(np.float32)
    fields={'Density':rho,'Momentum':np.column_stack([mx,my,np.zeros_like(mx)]).astype(np.float32),'Pressure':pressure,'Temperature':temperature}
    if not np.isfinite(points).all() or not all(np.isfinite(vv).all() for vv in fields.values()) or (rho<=0).any() or (temperature<=0).any():
        raise ValueError('restart CSV contains non-finite or nonphysical values')
    return points, fields
