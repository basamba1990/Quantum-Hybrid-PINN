from pathlib import Path
import re

def read_cp(path):
    text=Path(path).read_text()
    block=text.split('Cp',1)[1]
    rows=re.findall(r'\(\s*([0-9.]+)\s+([0-9.eE+-]+)\s*\)', block)
    return [(float(t),float(cp)) for t,cp in rows]

def extrapolated_integral(rows, T):
    # OpenFOAM integratedNonUniformTable: piecewise-linear Cp, linearly extrapolated
    # from the last segment above the table range.
    total=0.0
    for (t0,c0),(t1,c1) in zip(rows,rows[1:]):
        if T <= t0: break
        hi=min(T,t1)
        if hi>t0:
            a=(c1-c0)/(t1-t0)
            total += c0*(hi-t0)+0.5*a*(hi-t0)**2
        if T <= t1: break
    if T > rows[-1][0]:
        t0,c0=rows[-2]; t1,c1=rows[-1]
        a=(c1-c0)/(t1-t0); dt=T-t1
        total += c1*dt+0.5*a*dt**2
    return total

for phase in ('liquid','gas'):
    path=Path('/home/ubuntu/quantum-hybrid-pinn/pilot_case/PILOT-LH2-001/openfoam_wallBoiling_base/constant/thermophysicalProperties.'+phase)
    rows=read_cp(path)
    a=extrapolated_integral(rows,21.01)
    b=extrapolated_integral(rows,298.15)
    print(phase, 'Cp_minmax=', rows[0][1], rows[-1][1], 'integral_21=',a, 'integral_298=',b, 'anchored_h_21=',a-b, 'extrap_tail=',b-extrapolated_integral(rows,rows[-1][0]))
