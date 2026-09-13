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

L’image `infrastructure/gmsh-netgen/Dockerfile` compile Gmsh avec `ENABLE_NETGEN=ON` et expose le binaire dans `/opt/gmsh/bin/gmsh` :

```bash
docker build -f infrastructure/gmsh-netgen/Dockerfile -t quantum-gmsh-netgen infrastructure/gmsh-netgen
docker run --rm -v "$PWD:/work" quantum-gmsh-netgen \
  /work/volume_netgen.geo -3 -optimize_netgen -optimize_threshold 0.30 \
  -format msh4 -o /work/lh2_volume_netgen.msh
```

Après génération, le rapport de qualité doit être recalculé sur les cellules du maillage. `G2` ne doit passer que si les seuils du contrat sont satisfaits : zéro cellule de volume nul, zéro volume négatif, zéro face non-manifold, skewness sous le seuil et qualité orthogonale au-dessus du seuil.

Le solveur `apps/api/h2_sciml_engine.py` expose maintenant les fonctions de dérivation `liquid_fraction_from_temperature`, `specific_enthalpy_from_temperature` et `build_lh2_physics_contract`. Ces fonctions facilitent la production de champs cohérents, mais elles ne déclarent pas automatiquement une validation scientifique.
