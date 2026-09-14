# Pipeline LH2 : champs dérivés, contrat G3 et maillage Gmsh-Netgen

Le dépôt fournit trois étapes distinctes. L’enrichissement des VTU ajoute `alpha_liquid` et `enthalpy` à partir de paramètres explicitement fournis. Cette étape est traçable, mais elle marque le contrat comme non validé, car des champs dérivés ne constituent pas une sortie de solveur CFD.

```bash
python3 tools/enrich_lh2_frames.py \
  /cases/PILOT-LH2-TANK-THERMO-001 \
  /artifacts/PILOT-LH2-TANK-THERMO-001-enriched \
  --saturation-temperature-k 20.3 \
  --transition-width-k 0.25 \
  --cp-liquid-j-kg-k 9700 \
  --cp-vapor-j-kg-k 14300 \
  --latent-heat-j-kg 445000 \
  --reference-temperature-k 0 \
  --property-source 'NIST/CoolProp reviewed property table, revision required'
```

Les paramètres doivent être remplacés par ceux du contrat de cas réellement revu. Le script écrit `derivedFieldProvenance` et ne force jamais `physicsContract.validated` à `true`.

La validation G3 s’exécute ainsi :

```bash
python3 tools/validate_physics_contract_g3.py \
  /artifacts/PILOT-LH2-TANK-THERMO-001-enriched/sidecar.json \
  --report /artifacts/PILOT-LH2-TANK-THERMO-001-enriched/g3-report.json
```

La validation exige les descripteurs `rho`, `velocity`, `pressure`, `temperature`, `alpha_liquid` et `enthalpy`, une provenance du solveur, au moins deux frames et un `physicsContract.validated` explicitement vrai. Un kit enrichi à partir d’une formule ne doit donc normalement pas passer G3 avant revue physique.

Pour persister une sortie G3, le répertoire `--solver-output` doit contenir des `frame_*.vtu` écrits par le solveur réel. Le script ne fabrique ni `rho` ni un contrat validé : il vérifie la topologie identique des frames, la présence de tous les champs dans `point_data`, leur finitude, `rho > 0`, `0 <= alpha_liquid <= 1`, puis recopie les payloads avec leurs hashes.

```bash
python3 tools/persist_solver_g3.py \
  /cases/PILOT-LH2-TANK-THERMO-001 \
  /artifacts/PILOT-LH2-TANK-THERMO-001-g3 \
  --solver-output /solver/run-2026-09-13/frames \
  --physics-contract /solver/run-2026-09-13/physics-contract.json \
  --run-log /solver/run-2026-09-13/solver.log \
  --solver LH2-ThermoHydraulic-Solver \
  --solver-version 1.0.0 \
  --calculation-id LH2-2026-09-13-001 \
  --mass-residual 1.2e-7 \
  --momentum-residual 4.8e-6 \
  --energy-residual 3.1e-5
```

Le contrat doit avoir été revu indépendamment et contenir `validated: true`, les équations gouvernantes, le modèle de phase, les propriétés matériaux et les conditions initiales/limites persistées. Des valeurs estimées ou injectées à partir d’une corrélation ne permettent pas de débloquer G3.

L’image `infrastructure/gmsh-netgen/Dockerfile` compile Gmsh avec `ENABLE_NETGEN=ON` et `ENABLE_OCC=ON`. Le build et la couche runtime exécutent un smoke test OpenCASCADE réel ; l’image échoue au build si `SetFactory("OpenCASCADE")` ne peut pas créer et mailler un volume.

```bash
docker build -f infrastructure/gmsh-netgen/Dockerfile -t quantum-gmsh-netgen infrastructure/gmsh-netgen
docker run --rm -v "$PWD:/work" quantum-gmsh-netgen \
  /work/volume_netgen.geo -3 -optimize_netgen -optimize_threshold 0.30 \
  -format msh4 -o /work/lh2_volume_netgen.msh
```

Après génération, le rapport de qualité doit être recalculé sur les cellules du maillage. `G2` ne doit passer que si les seuils du contrat sont satisfaits : zéro cellule de volume nul, zéro volume négatif, zéro face non-manifold, skewness sous le seuil et qualité orthogonale au-dessus du seuil.

Le solveur `apps/api/h2_sciml_engine.py` expose maintenant les fonctions de dérivation `liquid_fraction_from_temperature`, `specific_enthalpy_from_temperature` et `build_lh2_physics_contract`. Ces fonctions facilitent la production de champs cohérents, mais elles ne déclarent pas automatiquement une validation scientifique.
