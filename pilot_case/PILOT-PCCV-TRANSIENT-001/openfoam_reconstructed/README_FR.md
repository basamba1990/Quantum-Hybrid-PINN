# PCCV transitoire OpenFOAM — procédure réelle

Ce dossier fournit une **voie de calcul**, pas des résultats préfabriqués. Il faut disposer d’OpenFOAM  v2312/2512, de `blockMesh`, `checkMesh`, `pimpleFoam` et `foamToVTK`. Le STL PCCV autorisé doit être placé dans `constant/triSurface/pccv.stl`; le STL reconstruit du dépôt ne constitue pas une validation industrielle.

## Choix du solveur

Pour un premier benchmark monophasique, utiliser `pimpleFoam` avec air incompressible, isotherme, Newtonien. Ce choix évite LH₂, VOF, ébullition et propriétés cryogéniques. Le cas doit rester borné et reproductible avant toute extension PCCV thermo-hydraulique.

La première exécution peut utiliser `system/blockMeshDict` comme canal 2D de smoke test. Pour le PCCV réel, remplacer le domaine par une géométrie fermée et un maillage `snappyHexMesh` avec frontières nommées `inlet`, `outlet`, `walls` et `symmetry`; ne jamais appeler une sortie de canal « PCCV validé ».

## Exécution

```bash
source /opt/openfoam*/etc/bashrc
mkdir -p constant/triSurface
cp /chemin/pccv.stl constant/triSurface/pccv.stl
blockMesh
# pour la géométrie PCCV: surfaceFeatureExtract && snappyHexMesh -overwrite
checkMesh | tee run/checkMesh.log
pimpleFoam | tee run/solver.log
foamToVTK -ascii -time '0:0.07' -fields '(p U T rho)'
```

Le solveur doit avoir `writeControl adjustableRunTime`, `writeInterval 0.01`, `startTime 0`, `endTime 0.07` et `deltaT 0.001` ou une valeur documentée. Le dossier `run/` doit conserver le cas exact, les logs, les résidus et les bilans. Les VTU doivent être normalisés en `frame_0000.vtu`, etc., puis référencés par `export_manifest.json`.

## Preuve exigée avant le sidecar

Créer dans `run/` les fichiers suivants : `solver_case.tar.gz`, `run_manifest.json`, `residual_history.csv`, `balance_history.csv`, `export_manifest.json` et `solver.log`. Le script `tools/build_transient_sidecar.py` refuse de produire un sidecar si l’un manque, si le solveur n’a pas déclaré `solverCompleted: true`, si les temps ne sont pas croissants ou si un hash de frame est incorrect.

```bash
python3 tools/build_transient_sidecar.py \
  --run-dir pilot_case/openfoam_pccv_transient/run \
  --out pilot_case/openfoam_pccv_transient/sidecar.json
```

Le frontend pourra rendre les frames sans preuve complète, mais il refusera désormais le statut validé tant que `transientProof` et les huit indicateurs d’évidence ne sont pas présents. Une seconde exécution dans un environnement propre reste obligatoire pour publier le benchmark.
