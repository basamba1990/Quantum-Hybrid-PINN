# PCCV-TRANSIENT-RUN-001 — kit OpenFOAM réel

## Statut

Ce kit contient huit états transitoires réellement calculés avec **OpenFOAM v2512 / `pimpleFoam`** sur un maillage 3D généré par `snappyHexMesh`. La géométrie est une **reconstruction analytique fermée**, construite à partir des éléments descriptifs de l’article fourni [Actuators 2024, 13, 110](https://www.mdpi.com/2076-0825/13/3/110). Elle n’est pas le fichier CAD du partenaire industriel et ne constitue pas une reproduction exacte de la géométrie publiée.

La classification correcte est donc :

```text
REAL_TRANSIENT_SOLVER_OUTPUT_REPRODUCED_ANALYTIC_GEOMETRY_NOT_AUTHOR_CAD
```

La publication comme benchmark industriel reste bloquée tant que le CAD autorisé, ses dimensions de référence et ses conditions de licence ne sont pas obtenus.

## Calcul exécuté

| Élément | Valeur |
|---|---|
| Solveur | OpenFOAM v2512, `pimpleFoam` |
| Modèle | incompressible, Newtonien, laminaire |
| Domaine | 3D, surface analytique fermée et maillée par `snappyHexMesh` |
| Cellules | 104 950 |
| Patches | `inlet`, `outlet`, `sideWalls`, `front`, `back`, `pccvWall` |
| Pas temporel | 0,001 s |
| Temps exportés | 0,00 à 0,07 s, huit frames |
| Champs | pression `p`, vitesse `U` |
| Validation maillage | `checkMesh: Mesh OK` |
| Reproduction indépendante | Oui, répertoire propre, trace normalisée identique |

Les preuves sont dans `openfoam_reconstructed/run/` : logs, manifeste, historiques, hashes, archive du cas et sidecar.

## Géométrie analytique

L’article décrit cinq ports, quatre conduites d’entrée, une sortie, une bille rotative et un rapport de longueur de conduite `L/D = 15`. Le PDF ne fournit pas le CAD partenaire ni un diamètre absolu exploitable. Le pilote documente donc ses hypothèses : `D = 0,020 m`, `R_body = 0,040 m`. Elles sont des paramètres de test, pas des valeurs attribuées à l’auteur.

Le fichier `analytic_geometry/geometry_manifest.json` contient le hash SHA-256, la provenance, les hypothèses et le verrou de publication. Le STL est fermé et vérifié par `surfaceCheck` et par `checkMesh` après maillage.

## Reproduction

```bash
source /usr/lib/openfoam/openfoam2512/etc/bashrc
cd pilot_case/PILOT-PCCV-TRANSIENT-001/openfoam_reconstructed
blockMesh
surfaceCheck constant/triSurface/pccv_analytic_reconstructed.stl
snappyHexMesh -overwrite
checkMesh
pimpleFoam | tee run/solver.log
foamToVTK -ascii -time '0:0.07' -fields '(p U)' | tee run/foamToVTK.log
```

La construction des preuves est ensuite effectuée avec :

```bash
python3 tools/assemble_pccv_transient_run.py \
  --case-dir pilot_case/PILOT-PCCV-TRANSIENT-001/openfoam_reconstructed \
  --run-id PCCV-TRANSIENT-RUN-001

python3 tools/build_transient_sidecar.py \
  --run-dir pilot_case/PILOT-PCCV-TRANSIENT-001/openfoam_reconstructed/run \
  --out pilot_case/PILOT-PCCV-TRANSIENT-001/openfoam_reconstructed/run/sidecar.json \
  --case-id PCCV-TRANSIENT-RUN-001 \
  --mesh-revision pccv-analytic-openfoam2512-v1
```

## Visualiseur

Le visualiseur PCCV utilise désormais `apps/web/public/cfd-demo/pccv-valve-preview/`. Les anciens VTU de démonstration ont été remplacés par les huit `internal.vtu` produits par OpenFOAM et renommés `frame_0000.vtu` à `frame_0007.vtu`. Le sidecar public conserve les hashes et les temps réels, avec des chemins relatifs adaptés au serveur statique.

Le statut ne doit pas être présenté comme validation industrielle ou comparaison à l’article : `referenceComparison` reste volontairement `false`, car l’article fourni ne contient pas une série numérique de référence exploitable.
