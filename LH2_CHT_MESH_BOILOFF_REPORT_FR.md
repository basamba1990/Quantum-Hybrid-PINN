# LH2 — étude d’indépendance au maillage, boil-off thermo-énergétique et CHT

**Date : 24 septembre 2026**

## Résumé exécutif

La capacité géométrique a été corrigée en tenant compte de la géométrie réellement générée : les deux dômes sont des demi-ellipsoïdes et non des calottes sphériques. La hauteur cylindrique a été résolue pour atteindre une capacité nominale de 50 L.

Le nouveau maillage OpenFOAM contient **450 704 cellules**, passe `checkMesh` et possède un volume de **0,0497868 m³**, soit **49,787 L**. L’écart au volume cible est donc de **0,426 %**.

Un modèle thermo-énergétique CHT réduit a été exécuté avec :

- propriétés LH2 `ParaHydrogen` obtenues par CoolProp ;
- `T_sat(p)` ;
- `h_fg(p)` ;
- enthalpie interne liquide/vapeur ;
- équilibre liquide-vapeur dans un volume rigide ;
- évaporation/condensation par fermeture énergétique ;
- conduction implicite à travers aluminium 2219 et polyuréthane ;
- convection interne et externe ;
- épaisseurs de polyuréthane de 10, 20 et 30 mm ;
- études de sensibilité au maillage radial et au pas de temps.

Ce modèle réduit valide la logique thermo-énergétique et la hiérarchie des effets. Il **n’est pas encore un calcul `chtMultiRegionFoam` complet du réservoir** : les régions solides n’ont pas encore été créées dans un cas OpenFOAM multi-région avec interfaces conformes. Cette distinction est importante pour ne pas appeler prématurément le résultat une validation CFD industrielle.

## 1. Correction de capacité géométrique

Le premier modèle utilisait directement une hauteur totale de 450 mm, mais les coordonnées du STL produisaient des dômes ellipsoïdaux :

```text
r(theta) = r sin(theta)
z(theta) = h cos(theta)
```

Le volume d’un demi-ellipsoïde est :

```text
V_dôme = (2/3) π r² h
```

Avec `r = 0,193 m`, `h_bas = 0,0991 m` et `h_haut = 0,10145 m`, la hauteur cylindrique corrigée est :

```text
h_cylindrique = 0,2935730626 m
hauteur totale = 0,4941230626 m
```

Le maillage corrigé donne :

| Grandeur | Valeur |
|---|---:|
| Cellules | 450 704 |
| Volume maillé | 0,0497867967 m³ |
| Capacité | 49,7868 L |
| Écart à 50 L | 0,4264 % |
| Non-orthogonalité maximale | 46,35° |
| Non-orthogonalité moyenne | 11,53° |
| Skewness maximale | 1,23 |
| Statut `checkMesh` | `PASS` |

La géométrie est maintenant suffisamment proche de la capacité nominale pour poursuivre l’étude. Une CAO auteur resterait préférable pour une validation finale.

## 2. Modèle thermo-énergétique LH2

Le modèle utilise `ParaHydrogen` de CoolProp. Pour une pression donnée, les propriétés de saturation sont interpolées à partir d’une table pré-calculée couvrant `30 kPa` à `1,2 MPa`, sous la pression critique du para-hydrogène.

Les propriétés utilisées sont :

```text
T_sat(p)
rho_l(p), rho_v(p)
u_l(p), u_v(p)
h_fg(p) = h_v(p) - h_l(p)
cp_l(p)
k_l(p)
```

L’état du réservoir est fermé par les équations de volume et d’énergie :

```text
V = m [(1-x)/rho_l(p) + x/rho_v(p)]
E = m [(1-x)u_l(p) + x u_v(p)]
```

où `x` est la qualité vapeur. La résolution de ces équations fournit simultanément :

```text
p(t)
T_sat(p(t))
x(t)
m_liquide(t)
m_vapeur(t)
```

Le transfert de chaleur à la phase liquide est calculé par :

```text
q_inner = h_inner A [T_wall,inner - T_sat(p)]
```

Le transfert externe est :

```text
q_outer = h_outer A [T_ambient - T_wall,outer]
```

La conduction dans l’aluminium et le polyuréthane est résolue par un schéma volumes finis radial **implicite**, afin d’éviter l’instabilité du schéma explicite imposée par la forte diffusivité de l’aluminium.

La chaleur reçue par le fluide augmente son énergie totale :

```text
E(t + Δt) = E(t) + q_inner Δt
```

L’évaporation n’est donc pas imposée par un taux arbitraire : elle résulte de l’augmentation de l’énergie et de la fermeture d’équilibre liquide-vapeur. La condensation apparaît naturellement si l’énergie diminue.

## 3. Étude d’indépendance au maillage

Le cas de référence est une isolation de 20 mm, un pas de temps de 1 s et une durée de 600 s. Le nombre de cellules désigne les volumes radiaux dans l’ensemble aluminium + isolation.

| Cellules radiales | Pas radial approximatif | Pression finale | Masse vapeur finale |
|---:|---:|---:|---:|
| 24 | 0,958 mm | 123 230,6 Pa | 0,0396495 kg |
| 48 | 0,479 mm | 122 619,1 Pa | 0,0394787 kg |
| 96 | 0,240 mm | 121 588,0 Pa | 0,0391904 kg |

Les variations relatives par rapport au maillage 96 sont :

| Comparaison | Pression | Masse vapeur |
|---|---:|---:|
| 24 → 96 | 1,35 % | 1,17 % |
| 48 → 96 | 0,85 % | 0,74 % |

Le maillage 48 est donc acceptable pour une étude paramétrique préliminaire avec une erreur inférieure à 1 % sur les indicateurs principaux par rapport à 96. Le maillage 96 doit être conservé pour la référence finale jusqu’à une confirmation sur le modèle OpenFOAM multi-région.

Le résultat n’est pas encore une preuve d’indépendance CFD 3D : il s’agit d’une étude de convergence du modèle radial thermo-CHT. La future étude OpenFOAM devra refaire cette vérification sur au moins trois maillages 3D.

## 4. Étude d’indépendance au pas de temps

Le maillage est fixé à 48 cellules radiales, l’isolation à 20 mm et le temps final à 600 s.

| Pas de temps | Pression finale | Température finale | Masse vapeur finale |
|---:|---:|---:|---:|
| 1 s | 122 619,1 Pa | 20,9325 K | 0,0394787 kg |
| 2 s | 122 672,1 Pa | — | — |
| 5 s | 122 830,4 Pa | — | — |

Les écarts de pression par rapport à `Δt = 1 s` sont :

```text
Δt = 2 s : 0,0432 %
Δt = 5 s : 0,1725 %
```

Le pas de temps de 1 s est retenu pour les comparaisons. Le schéma implicite reste stable pour 5 s, mais la précision temporelle est moins conservatrice.

## 5. Cas d’isolation 10, 20 et 30 mm

Les trois cas utilisent 48 cellules radiales, `Δt = 1 s` et 600 s de simulation.

| Isolation PU | Pression finale | Température LH2 finale | Masse vapeur finale | Masse liquide finale |
|---:|---:|---:|---:|---:|
| 10 mm | 174 336 Pa | 22,2504 K | 0,0536489 kg | 1,75052 kg |
| 20 mm | 122 619 Pa | 20,9325 K | 0,0394787 kg | 1,76469 kg |
| 30 mm | 107 333 Pa | 20,4671 K | 0,0351754 kg | 1,76899 kg |

Les tendances sont physiquement cohérentes :

- une isolation plus mince augmente le flux thermique externe ;
- la température du LH2 augmente davantage ;
- la pression d’auto-pressurisation augmente ;
- la masse évaporée augmente ;
- l’isolation de 30 mm retarde et réduit le boil-off.

Ces tendances sont cohérentes avec l’article, qui indique qu’une isolation plus faible augmente la pénétration thermique, l’évaporation et la vitesse de pressurisation. Les valeurs absolues ne doivent toutefois pas encore être comparées aux courbes de l’article, car le modèle réduit ne contient pas encore la turbulence VOF 3D, la stratification résolue, les interfaces conformes et les conditions limites exactes de l’étude publiée.

## 6. Régions physiques préparées

La décomposition physique cible est maintenant :

```text
region fluid : LH2 + vapeur LH2
region solid : aluminium 2219, 3 mm
region solid : polyuréthane 10 mm
region solid : polyuréthane 20 mm
region solid : polyuréthane 30 mm
```

Le modèle réduit résout déjà la conduction dans deux régions successives :

```text
aluminium 2219 → polyuréthane
```

Les trois épaisseurs sont exécutées séparément. En revanche, le cas OpenFOAM `chtMultiRegionFoam` conformal n’est pas encore produit, car il nécessite une nouvelle géométrie multi-région avec interfaces internes conformes et `splitMeshRegions`. Le maillage précédent était une région fluide unique ; le réutiliser comme CHT aurait été physiquement faux.

## 7. Ce qui est démontré et ce qui reste à faire

### Démontré dans cette phase

- capacité géométrique corrigée à moins de 0,5 % de 50 L ;
- maillage OpenFOAM réel valide ;
- `T_sat(p)` et `h_fg(p)` issus de CoolProp ;
- enthalpie interne liquide/vapeur ;
- fermeture pression–volume–énergie ;
- boil-off piloté par l’énergie reçue ;
- conduction aluminium–PU ;
- étude de maillage du modèle thermo-CHT réduit ;
- étude de pas de temps ;
- comparaison des isolations 10/20/30 mm ;
- archive JSON et CSV des résultats.

### Non encore démontré

- `chtMultiRegionFoam` sur la cuve LH2 avec régions conformes ;
- VOF thermo-énergétique 3D couplé à la chaleur latente ;
- transfert de masse interfacial local dépendant de la température ;
- conservation simultanée locale de masse, énergie et enthalpie dans OpenFOAM ;
- comparaison point à point aux données expérimentales de l’article ;
- validation industrielle ou certification ;
- connexion du PINN quantique aux champs CFD.

## 8. Prochaine étape correcte

La prochaine implémentation doit construire une géométrie multi-région concentrique conforme :

1. surface interne LH2 ;
2. surface externe aluminium ;
3. surface externe PU ;
4. `snappyHexMesh` avec `cellZone` distinctes ;
5. `splitMeshRegions -cellZones` ;
6. `foamMultiRun` avec un solveur fluide et un solveur solide ;
7. conditions `compressible` ou `thermo` compatibles avec LH2 ;
8. champ de phase dans la région fluide ;
9. source interfaciale `m_dot h_fg` ;
10. bilans de masse et d’énergie par région ;
11. étude de maillage 3D et comparaison avec le modèle réduit.

Le PINN quantique doit rester déconnecté jusqu’à ce que ce CHT 3D indépendant soit accepté.

## Artefacts

- [Rapport CHT et convergence](/home/ubuntu/quantum-hybrid-pinn-audit/LH2_CHT_MESH_BOILOFF_REPORT_FR.md)
- [Résultats JSON du modèle thermo-CHT](/home/ubuntu/quantum-hybrid-pinn-audit/artifacts/lh2_cht_reduced/results.json)
- [Résumé CSV des études](/home/ubuntu/quantum-hybrid-pinn-audit/artifacts/lh2_cht_reduced/summary.csv)
- [Générateur de géométrie 50 L corrigée](/home/ubuntu/quantum-hybrid-pinn-audit/tools/create_lh2_tank_transient_case.py)
- [Modèle thermo-CHT réduit](/home/ubuntu/quantum-hybrid-pinn-audit/tools/run_lh2_cht_reduced_model.py)

## Statut

```text
GEOMETRY_CAPACITY_CORRECTED_50L_WITHIN_0.43_PERCENT
OPENFOAM_MESH_V2_CHECKMESH_PASS
THERMO_PROPERTIES_TSAT_HFG_ENTHALPY_IMPLEMENTED
REDUCED_CHT_ALUMINIUM_PU_IMPLEMENTED
MESH_INDEPENDENCE_REDUCED_MODEL_COMPLETED
TIME_STEP_INDEPENDENCE_REDUCED_MODEL_COMPLETED
INSULATION_10_20_30MM_COMPLETED
OPENFOAM_CONFORMAL_MULTI_REGION_TANK_PENDING
THERMAL_VOF_OPENFOAM_COUPLING_PENDING
QUANTUM_PINN_CONNECTION_BLOCKED_UNTIL_CFD_ACCEPTANCE
```
