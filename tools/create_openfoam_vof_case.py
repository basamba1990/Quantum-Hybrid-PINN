#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def replace_boundary(text: str, boundary: str) -> str:
    start = text.index("boundaryField")
    prefix = text[:start]
    return prefix + f"boundaryField\n{{\n    tankWall\n    {{\n        type            {boundary};\n    }}\n}}\n"


def write_field(path: Path, obj: str, dimensions: str, internal: str, boundary: str) -> None:
    path.write_text(f'''FoamFile\n{{\n    format      ascii;\n    class       volScalarField;\n    location    "0";\n    object      {obj};\n}}\ndimensions      {dimensions};\ninternalField   uniform {internal};\nboundaryField\n{{\n    tankWall\n    {{\n        type            {boundary};\n    }}\n}}\n''', encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("pilot_case/LH2-TANK-TRANSIENT-RUN-001/vofPhaseChange"))
    parser.add_argument("--mesh", type=Path, default=Path("pilot_case/LH2-TANK-TRANSIENT-RUN-001/case/constant/polyMesh"))
    args = parser.parse_args()
    root = args.output.resolve()
    if root.exists():
        shutil.rmtree(root)
    (root / "0").mkdir(parents=True)
    (root / "constant").mkdir(parents=True)
    (root / "system").mkdir(parents=True)
    shutil.copytree(args.mesh, root / "constant/polyMesh")
    ref = Path("/opt/openfoam12/tutorials/incompressibleVoF/cavitatingBullet")
    for name in ["fvSchemes", "fvSolution", "decomposeParDict"]:
        shutil.copy2(ref / "system" / name, root / "system" / name)
    fv_solution = (root / "system/fvSolution").read_text()
    fv_solution = fv_solution.replace("    nNonOrthogonalCorrectors    0;\n}\n\nrelaxationFactors", "    nNonOrthogonalCorrectors    0;\n    pRefCell                    0;\n    pRefValue                   101325;\n}\n\nrelaxationFactors")
    (root / "system/fvSolution").write_text(fv_solution, encoding="utf-8")
    for name in ["g", "momentumTransport", "phaseProperties", "physicalProperties.water", "physicalProperties.vapour"]:
        shutil.copy2(ref / "constant" / name, root / "constant" / name)
    shutil.copy2(ref / "constant/fvModels", root / "constant/fvModels")
    write_field(root / "0/alpha.water", "alpha.water", "[]", "0.5", "zeroGradient")
    write_field(root / "0/alpha.vapour", "alpha.vapour", "[]", "0.5", "zeroGradient")
    (root / "0/U").write_text('''FoamFile { format ascii; class volVectorField; location "0"; object U; }\ndimensions [0 1 -1 0 0 0 0];\ninternalField uniform (0 0 0);\nboundaryField { tankWall { type noSlip; } }\n''', encoding="utf-8")
    (root / "0/p_rgh").write_text('''FoamFile { format ascii; class volScalarField; location "0"; object p_rgh; }\ndimensions [1 -1 -2 0 0 0 0];\ninternalField uniform 101325;\nboundaryField { tankWall { type fixedFluxPressure; } }\n''', encoding="utf-8")
    control = '''FoamFile { format ascii; class dictionary; location "system"; object controlDict; }\napplication foamRun;\nsolver incompressibleVoF;\nstartFrom startTime; startTime 0; stopAt endTime; endTime 0.02; deltaT 1e-5;\nwriteControl adjustableRunTime; writeInterval 0.005; purgeWrite 0; writeFormat ascii; writePrecision 10; writeCompression off;\nadjustTimeStep yes; maxCo 0.25; maxAlphaCo 0.25; runTimeModifiable true;\n'''
    (root / "system/controlDict").write_text(control, encoding="utf-8")
    phase = (root / "constant/phaseProperties").read_text()
    (root / "constant/phaseProperties").write_text(phase.replace("phases          (water vapour);", "phases          (water vapour);").replace("sigma           0.07;", "sigma           0.002;"), encoding="utf-8")
    for name in ["physicalProperties.water", "physicalProperties.vapour"]:
        p = root / "constant" / name
        s = p.read_text()
        if name.endswith("water"):
            s = s.replace("nu              9e-07;", "nu              1.42e-06;").replace("rho             1000;", "rho             70.83;")
        else:
            s = s.replace("nu              0.0004273;", "nu              1.0e-06;").replace("rho             0.02308;", "rho             1.25;")
        p.write_text(s, encoding="utf-8")
    models = (root / "constant/fvModels").read_text()
    models = models.replace("pSat    2300;", "pSat    101325;").replace("UInf    20.0;", "UInf    0.1;").replace("tInf    0.005;", "tInf    0.05;").replace("liquid  water;", "liquid  water;")
    (root / "constant/fvModels").write_text(models, encoding="utf-8")
    (root / "README.md").write_text('''# OpenFOAM VOF/phase-change LH2 geometry case\n\nThis case uses the article-derived 50 L tank mesh and OpenFOAM 12 `incompressibleVoF` with the `VoFCavitation` Schnerr-Sauer pressure-driven phase-change model. The available solver does not couple LH2 thermodynamic enthalpy or heat transfer through the wall; this is therefore a VOF/pressure-phase-change integration test, not a thermal boil-off or industrial validation.\n''', encoding="utf-8")
    print(root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
