#!/usr/bin/env python3
import hashlib,json,shutil
from pathlib import Path
root=Path('/tmp/Quantum-Hybrid-PINN'); src=root/'runs/PCCV-TRANSIENT-RUN-001'; dst=root/'artifacts/PCCV-TRANSIENT-RUN-001-real'; shutil.rmtree(dst,ignore_errors=True); (dst/'frames').mkdir(parents=True)
for f in sorted((src/'frames').glob('frame_*.vtu')): shutil.copy2(f,dst/'frames'/f.name)
for name in ['sidecar.json','residual_history.csv','balance_history.csv','README_RUN.md'] : shutil.copy2(src/name,dst/name)
for f in ['22_pimpleFoam_run001.log','18_checkMesh_final.log','06_surfaceCheck_fixed.log','17_snappyHexMesh_final.log','16_blockMesh_final.log'] : shutil.copy2(src/'logs'/f,dst/('logs_'+f))
shutil.copy2(src/'constant/triSurface/lh2_reconstructed.stl',dst/'geometry_reconstructed.stl')
files=[]
for f in sorted(dst.rglob('*')):
 if f.is_file(): files.append({'file':str(f.relative_to(dst)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size})
manifest={'kitId':'PCCV-TRANSIENT-RUN-001','status':'REPRODUCIBLE_REAL_OPENFOAM_RUN_NOT_LH2_VALIDATED','solver':{'name':'pimpleFoam','version':'OpenFOAM v2512'},'physics':'incompressible Newtonian laminar Stokes','geometryStatus':'RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_OFFICIAL','frames':8,'times_s':[0.001,0.002,0.003,0.004,0.005,0.006,0.007,0.008],'independentRun':'PCCV-TRANSIENT-RUN-002','independentComparison':'runs/PCCV-TRANSIENT-RUN-002/reproducibility_comparison.json','files':files}
(dst/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
(dst/'PUBLISHING_STATUS_FR.md').write_text('''# PCCV-TRANSIENT-RUN-001 — statut de publication\n\nCette série contient huit sorties VTU exportées par `foamToVTK` depuis un calcul transitoire réel `pimpleFoam` v2512, maillé par `snappyHexMesh` sur une géométrie reconstruite fermée. Une seconde exécution indépendante a produit la même topologie, les mêmes coordonnées et des champs identiques à différence absolue maximale nulle.\n\nLe kit n’est **pas** une validation LH₂, diphasique, thermique ou industrielle de la CAO de l’article. La géométrie est explicitement reconstruite et paramétrique; elle n’est pas la CAO officielle des auteurs. Le modèle exécuté est monophasique, incompressible, newtonien et laminaire.\n\nLes gates G3–G5 restent non validés tant qu’un contrat physique LH₂ approuvé, un rapport de qualité volumique formalisé et une comparaison indépendante de référence n’ont pas été fournis.\n''')
print(dst)
