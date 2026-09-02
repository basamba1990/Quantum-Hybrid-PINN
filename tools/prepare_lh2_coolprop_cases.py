from pathlib import Path
import shutil

ROOT=Path('/home/ubuntu/quantum-hybrid-pinn')
src=ROOT/'pilot_case/PILOT-LH2-001/openfoam_wallBoiling_base'
out=ROOT/'pilot_case/PILOT-LH2-001/cases'
for name, heat_flux, p0 in [('CFD-BASELINE', 100.0, 125310.0), ('CFD-INDEPENDENT', 160.0, 135000.0)]:
    dst=out/name
    if dst.exists(): shutil.rmtree(dst)
    shutil.copytree(src,dst)
    for phase,mu,Pr in [('gas','1.25e-6','0.70'),('liquid','1.27e-5','1.00')]:
        f=dst/'constant'/f'thermophysicalProperties.{phase}'
        s=f.read_text()
        s=s.replace('transport tabulated;', 'transport const;')
        s=s.replace('thermo hTabulated;', 'thermo coolPropThermo;')
        # Keep icoTabulated rho data because the current custom thermo derives from it;
        # its overridden rho/H/Cp methods call CoolProp at runtime.
        a=s.index('    transport\n    {')
        b=s.index('    }\n}', a)+5
        s=s[:a]+f'    transport\n    {{\n        mu              {mu};\n        Pr              {Pr};\n    }}\n}}\n'
        f.write_text(s)
    c=dst/'system/controlDict'
    s=c.read_text()
    s=s.replace('application     reactingTwoPhaseEulerFoam;', 'application     reactingTwoPhaseEulerFoam;\n\nlibs            ("liblh2CoolPropThermo.so");')
    s=s.replace('endTime         2;', 'endTime         0.02;')
    s=s.replace('endTime         4;', 'endTime         0.02;')
    c.write_text(s)
    # Make the run script single-pass and avoid the invalid second-phase path 2/T.liquid.
    (dst/'Allrun').write_text('''#!/bin/sh\ncd "${0%/*}" || exit 1\n. ${WM_PROJECT_DIR:?}/bin/tools/RunFunctions\nrestore0Dir\nrunApplication blockMesh\nrunApplication $(getApplication)\n''')
    (dst/'Allrun').chmod(0o755)
    # Distinct declared perturbation for independent condition.
    for field in ['p','p_rgh']:
        p=dst/'0.orig'/field
        t=p.read_text().replace('uniform 125310;', f'uniform {p0:g};')
        p.write_text(t)
    p=dst/'0.orig/T.liquid'
    p.write_text(p.read_text().replace('uniform 21.01;', 'uniform 21.01;').replace('uniform 100;', f'uniform {heat_flux:g};'))
print(out)
