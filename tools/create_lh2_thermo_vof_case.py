#!/usr/bin/env python3
from pathlib import Path
import shutil, json, sys

src=Path('/usr/lib/openfoam/openfoam2512/tutorials/multiphase/interCondensatingEvaporatingFoam/condensatingVessel')
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path('pilot_case/LH2-TANK-THERMO-VOF-RUN-001')
if out.exists(): shutil.rmtree(out)
shutil.copytree(src,out)
# Preserve tutorial field templates and replace the rectangular vessel with the published inner envelope.
# The v2512 phase-change model requires explicit mDotSmear solver entries.
fv=out/"system"/"fvSolution"; fvs=fv.read_text(); fvs=fvs.replace("    p_rgh\n", "    mDotSmear { solver PCG; preconditioner DIC; tolerance 1e-6; relTol 0; }\n    mDotSmearFinal { $mDotSmear; tolerance 1e-6; relTol 0; }\n\n    p_rgh\n", 1); fv.write_text(fvs)
(out/'system'/'blockMeshDict').write_text('''FoamFile\n{ version 2.0; format ascii; class dictionary; object blockMeshDict; }\nscale 1;\nvertices\n(\n (0 0 0) (0.193 0 0) (0.193 0.450 0) (0 0.450 0)\n (0 0 0.001) (0.193 0 0.001) (0.193 0.450 0.001) (0 0.450 0.001)\n);\nblocks ( hex (0 1 2 3 4 5 6 7) (116 270 1) simpleGrading (1 1 1) );\nboundary\n(\n bottom { type wall; faces ((1 5 4 0)); }\n top { type patch; faces ((3 7 6 2)); }\n left { type wall; faces ((0 4 7 3)); }\n right { type wall; faces ((2 6 5 1)); }\n frontAndBack { type empty; faces ((4 5 6 7) (0 1 2 3)); }\n);\n''')
(out/'system'/'setFieldsDict').write_text('''FoamFile\n{ version 2.0; format ascii; class dictionary; object setFieldsDict; }\ndefaultFieldValues ( volScalarFieldValue alpha.liquid 0 );\nregions\n(\n boxToCell { box (0 0 0) (0.193 0.225 0.001); fieldValues ( volScalarFieldValue alpha.liquid 1 ); }\n);\n''')
# Initial 50% liquid and saturation temperature.
for name in ('T','alpha.liquid'):
 p=out/'0.orig'/name; s=p.read_text()
 if name=='T':
  s=s.replace('internalField       uniform 366;', 'internalField       uniform 20.268;').replace('value           uniform 360;', 'value           uniform 20.268;')
 p.write_text(s)
(out/'constant'/'thermophysicalProperties').write_text('''FoamFile\n{ version 2.0; format ascii; class dictionary; object thermophysicalProperties; }\n// Initial saturation reference from CoolProp ParaHydrogen at 101325 Pa.\nTSat 20.2712506609;\n''')
(out/'constant'/'transportProperties').write_text('''FoamFile\n{ version 2.0; format ascii; class dictionary; object transportProperties; }\n// Effective initial-state values from CoolProp ParaHydrogen at p=101325 Pa, T=20.268 K.\n// These are constant in this stock solver; they are NOT a validated T,p property law.\nphases (liquid vapour);\nsigma 0.00192969014;\nliquid { transportModel Newtonian; nu 1.9056e-7; rho 70.8319430; Cp 9726.97479; Cv 9726.97479; kappa 0.10064151; hf 0; }\nvapour { transportModel Newtonian; nu 1.0098e-5; rho 1.33860287; Cp 14300; Cv 10100; kappa 0.018; hf 446066.072; }\nPrt 0.7;\n''')
(out/'constant'/'phaseChangeProperties').write_text('''FoamFile\n{ version 2.0; format ascii; class dictionary; object phaseChangeProperties; }\n// Stock interCondensatingEvaporatingFoam closure. Article Ranz-Marshall coefficients are not published.\nphaseChangeTwoPhaseModel interfaceHeatResistance;\nR 1e6;\nmaxAlphaRate 0.1;\nspread 3;\ncoeffC 150;\ncoeffE 150;\n''')
(out/'system'/'controlDict').write_text((out/'system'/'controlDict').read_text().replace('endTime         10;','endTime         0.5;').replace('deltaT          1e-5;','deltaT          1e-6;').replace('writeInterval    0.5;','writeInterval    0.05;'))
# Solid-region handoff: documented configuration, not consumed by this single-region solver.
sol=out/'solid_regions'; sol.mkdir()
(sol/'README.md').write_text('''# Solid regions for the next multi-region thermo run\n\nThe current interCondensatingEvaporatingFoam case is single-region. The aluminium wall and polyurethane insulation therefore cannot be solved as conduction regions in the same executable. This directory records the required regions for the subsequent chtMultiRegionTwoPhaseEulerFoam or custom VOF multi-region implementation.\n\nRequired regions: aluminium_62219 (3 mm), polyurethane (10/20/30 mm). External boundary: convection to 283.15 K, wind speed 2 m/s.\n''')
manifest={'runId':'LH2-TANK-THERMO-VOF-RUN-001','status':'CONFIGURED_NOT_EXECUTED','solver':'interCondensatingEvaporatingFoam','solverVersion':'OpenFOAM v2512','geometry':'LH2-TANK-REFERENCE-CAD reconstructed inner envelope','initialPressure_Pa':101325.0,'initialTemperature_K':20.268,'initialLiquidFillFraction':0.5,'ambientTemperature_K':283.15,'phaseChange':'stock interfaceHeatResistance closure; Ranz-Marshall not implemented/validated in stock solver','thermoProperties':'CoolProp ParaHydrogen initial-state constants; T,p-dependent law not yet implemented','solidRegions':'documented handoff only; not consumed by current single-region solver'}
(out/'thermo_vof_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(out)
