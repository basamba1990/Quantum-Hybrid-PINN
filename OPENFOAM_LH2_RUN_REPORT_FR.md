# Exécution OpenFOAM LH2 — géométrie publiée, maillage, Stefan, VOF et CHT

**Date : 23 septembre 2026**

## Conclusion

La géométrie publiée a été reconstruite sous forme de surface analytique paramétrée à partir de l’article de Jeong et al. La surface STL est fermée et contrôlée par `surfaceCheck`. Le maillage OpenFOAM 12 a ensuite été généré avec `blockMesh` puis `snappyHexMesh`.

Le maillage réel obtenu contient **106 764 cellules**, une surface `tankWall` fermée et un volume calculé de **0,0446307 m³**, soit **44,63 L**. L’article décrit un réservoir nominal de 50 L. La reconstruction actuelle présente donc un écart géométrique de **10,74 %** par rapport au volume nominal. Cette différence doit être résolue avec la CAO de l’auteur ou avec une cote complémentaire avant d’utiliser ce maillage pour une comparaison quantitative définitive.

Le solveur indépendant `pimpleFoam` a convergé sur la cuve fermée. Un cas VOF OpenFOAM 12 avec `incompressibleVoF` et le modèle de changement de phase `VoFCavitation` a également été exécuté sur le même maillage. Enfin, le solveur `foamMultiRun` CHT a été exécuté en série sur un tutoriel multi-région OpenFOAM 12 afin de vérifier l’environnement CHT sous la limite gratuite d’un seul slot CPU.

**Important : le cas VOF réalisé utilise une loi de transfert de masse pilotée par la pression de cavitation. Il ne s’agit pas encore du modèle thermo-énergétique LH2 de l’article. Le cas CHT exécuté est un smoke test multi-région du solveur, pas encore la cuve LH2 avec régions aluminium et polyuréthane.**

## 1. Environnement reproductible

L’environnement utilisé est :

```text
Ubuntu 24.04
OpenFOAM-12
GCC double precision, Int32
1 processus MPI ou exécution série
CoolProp 8.0.0
Python 3.12
```

Le paquet OpenFOAM 12 a été installé depuis le dépôt officiel OpenFOAM. Les solveurs disponibles et vérifiés sont `blockMesh`, `snappyHexMesh`, `pimpleFoam`, `foamRun`, `interPhaseChangeFoam` et `chtMultiRegionFoam`.

L’instance gratuite ne dispose que d’un nombre limité de slots CPU. Le tutoriel CHT a donc été exécuté avec `foamMultiRun` en série. Une exécution MPI à quatre processus échoue avec le message Open MPI « not enough slots available ».

## 2. Reconstruction géométrique

Les paramètres extraits de l’article sont :

| Paramètre | Valeur utilisée |
|---|---:|
| Diamètre interne | 0,386 m |
| Hauteur de la partie cylindrique utilisée dans la reconstruction | 0,450 m au total avec dômes dans le modèle paramétré |
| Hauteur dôme inférieur | 0,0991 m |
| Hauteur dôme supérieur | 0,10145 m |
| Épaisseur de paroi aluminium 2219 | 0,003 m |
| Isolation polyuréthane à étudier | 0,010, 0,020 et 0,030 m |
| Remplissage de référence dans l’article | 50 % |
| Température initiale indiquée dans l’article | environ 20,268 K |
| Pression initiale | pression atmosphérique |

La surface STL analytique contient 3 360 triangles. `surfaceCheck` confirme les propriétés suivantes :

```text
Surface fermée : oui
Triangles illégaux : 0
Parties disjointes : 1
Arêtes connectées à deux faces : oui
```

Le volume du maillage OpenFOAM est :

```text
cellCount = 106764
volume = 0.0446306886374 m3
volume = 44.6306886374 L
maxNonOrthogonality = 48.9601964748 deg
averageNonOrthogonality = 11.8312554642 deg
maxSkewness = 1.62878934922
maxAspectRatio = 6.22285092616
```

Le maillage passe `checkMesh`. La non-orthogonalité maximale reste acceptable pour ce prototype, mais elle est trop élevée pour considérer le cas comme une étude d’indépendance au maillage terminée. Il faut effectuer une étude avec au moins trois résolutions et vérifier la sensibilité de la pression, de la stratification et du taux de vaporisation.

## 3. Cas hydrodynamique OpenFOAM indépendant

Le cas fermé a été exécuté avec `pimpleFoam` pendant 0,08 s. Le champ initial est un écoulement faible dans la cavité, avec paroi `tankWall` sans glissement et pression de référence fixée dans `fvSolution`.

Résultats de convergence :

| Indicateur | Résultat |
|---|---:|
| Temps final | 0,08 s |
| Nombre de cellules | 106 764 |
| Nombre de régions | 1 |
| Nombre de Courant maximal | 0,0253 |
| Erreur globale de continuité maximale | environ `6,4 × 10⁻²²` |
| Non-orthogonalité maximale | 48,96° |
| Statut | `PASS — hydrodynamique seulement` |

Ce run prouve que la géométrie et le maillage sont lisibles par OpenFOAM et que la chaîne de résolution hydrodynamique fonctionne. Il ne contient pas encore l’énergie, la densité variable LH2, la gravité, la flottabilité, l’interface liquide-vapeur ou les transferts inter-régions.

## 4. Cas VOF avec changement de phase

Le cas VOF est généré par `tools/create_openfoam_vof_case.py`. Il utilise le solveur modulaire OpenFOAM 12 :

```text
foamRun
solver incompressibleVoF
VoFCavitation
Schnerr-Sauer pressure-driven phase change
```

Le cas a été exécuté jusqu’à 0,02 s sur le maillage réel. Les fractions initiales sont volontairement non dégénérées afin de vérifier le transport de l’interface : `alpha.water = 0,5` au départ.

Résultats finaux :

| Indicateur | Résultat |
|---|---:|
| Temps final | 0,02 s |
| Fraction volumique moyenne de la phase 1 | 0,472240 |
| Minimum de `alpha.water` | 0,144385 |
| Maximum de `alpha.water` | 0,998678 |
| Nombre de Courant maximal | 0,1139 |
| Erreur globale de continuité maximale | environ `3,8 × 10⁻¹⁹` |
| Résidu final alpha, ordre de grandeur | `9,57 × 10⁻¹⁰` |
| Statut | `PASS — VOF pression/changement de phase` |

Ce résultat démontre que le transport VOF et la source de changement de phase de type cavitation sont exécutables sur la géométrie. Il ne démontre pas le boil-off thermique LH2. Le modèle utilisé ne reçoit pas directement le champ d’enthalpie LH2, la chaleur latente CoolProp, la température de saturation dépendante de la pression ni le flux thermique à travers l’aluminium et le polyuréthane.

Pour obtenir le modèle demandé par l’article, il faut remplacer ou compléter cette source par une fermeture thermo-énergétique :

```text
m_dot_interface = f(T, p, T_sat(p), h_fg(p), A_interface, C_evap, C_cond)
S_energy = m_dot_interface * h_fg(p)
```

La calibration de `C_evap`, `C_cond`, du diamètre dispersé et de la densité d’aire interfaciale doit être documentée et confrontée à une référence indépendante.

## 5. Cas Stefan indépendant

Le script `tools/run_stefan_lh2_independent.py` réalise un benchmark enthalpique 1D indépendant du PINN. Il utilise les propriétés `ParaHydrogen` de CoolProp à 101 325 Pa et traite la transition liquide-vapeur par enthalpie avec une fraction de phase bornée entre 0 et 1.

Résultats :

| Indicateur | Résultat |
|---|---:|
| Domaine | 0,05 m |
| Cellules | 240 |
| Pas de temps | 0,104009 s |
| Temps final | 1 248,11 s |
| Interface numérique intégrée | 0,00179770 m |
| Interface Stefan analytique | 0,00199035 m |
| Erreur relative d’interface | 9,68 % |
| Fermeture énergétique maximale | `2,47 × 10⁻¹¹ W` |
| Résidu PDE final | `2,71 × 10⁻¹⁰` |
| Masse vapeur équivalente finale | 0,127328 kg |
| Statut | `PASS — benchmark Stefan indépendant, pas CFD` |

L’erreur d’interface est inférieure au seuil de 15 % utilisé pour ce premier benchmark. Elle doit être réduite par raffinement spatial, réduction de l’erreur de lissage de phase et traitement plus strict de la condition frontière avant d’être utilisée comme validation de référence.

## 6. Smoke test CHT multi-région

Le tutoriel OpenFOAM 12 `multiRegion/CHT/heatedDuct` a été copié dans l’espace utilisateur puis exécuté en série avec `foamMultiRun`. Il contient trois régions : fluide, métal et chauffage.

Résultats finaux du smoke test :

| Indicateur | Résultat |
|---|---:|
| Temps final | 20 s |
| Résidu final enthalpie fluide | `5,28 × 10⁻⁹` |
| Résidu final énergie métal | `6,43 × 10⁻⁸` |
| Résidu final énergie chauffage | `1,94 × 10⁻⁸` |
| Erreur globale de continuité finale | environ `2,01 × 10⁻¹³` |
| Statut | `PASS — solveur CHT OpenFOAM` |

Ce smoke test prouve que le solveur CHT peut fonctionner dans la limite CPU gratuite. Il ne constitue pas encore une simulation CHT du réservoir LH2. Le maillage de la cuve actuelle ne possède qu’une région fluide et aucune région aluminium ou polyuréthane.

## 7. Comparaison avec l’article et les données expérimentales

L’article indique que son modèle CFD 3D VOF a été comparé à des données antérieures et décrit notamment une erreur finale d’environ 2,1 % pour un modèle `k-epsilon` et 1,7 % pour le modèle `k-zeta-f` dans la comparaison expérimentale rapportée [1]. Il indique aussi qu’un flux thermique faible de 50 W/m² présente une erreur moyenne d’environ 1 % par rapport à une référence antérieure [1].

La comparaison actuelle est structurée comme suit :

| Quantité | Article | Run actuel | Comparabilité |
|---|---|---|---|
| Géométrie | Réservoir nominal 50 L | Maillage 44,63 L | Non comparable avant correction géométrique |
| VOF | VOF liquide-vapeur | VOF `incompressibleVoF` | Partielle |
| Changement de phase | Évaporation/condensation thermo-énergétique | Cavitation pilotée par pression | Non équivalent |
| Paroi et isolation | Aluminium 2219 + PU 10/20/30 mm | Non présentes dans la cuve | Non comparable |
| Boil-off | Oui | Non calculé thermiquement par OpenFOAM | Non comparable |
| Pressurisation | Oui | Non validée | Non comparable |
| Validation expérimentale | Données antérieures et expérimentation citée | Aucun point expérimental injecté | Non réalisée |
| Résidus CFD | Décrits dans la méthode de l’article | Produits par OpenFOAM | Partielle |

La seule comparaison quantitative actuellement défendable avec une référence analytique est le benchmark Stefan 1D. Il est incorrect de comparer directement la fraction VOF `0,472240` ou le run `pimpleFoam` aux courbes de pression et de masse liquide de l’article, car les équations et les régions physiques ne sont pas les mêmes.

## 8. Travaux nécessaires avant la comparaison expérimentale

La suite correcte est :

1. corriger la reconstruction géométrique pour obtenir le volume nominal ou obtenir la CAO auteur ;
2. construire trois régions concentriques : LH2, aluminium 2219 et polyuréthane ;
3. transférer les propriétés thermiques dépendantes de la température et de la pression ;
4. ajouter gravité, flottabilité, turbulence appropriée et conditions externes ;
5. coupler la fraction VOF avec une source d’évaporation/condensation dépendante de `T`, `p` et `h_fg` ;
6. tester 10, 20 et 30 mm d’isolation ;
7. produire les historiques de pression, masse liquide, température moyenne, stratification et flux aux interfaces ;
8. comparer les courbes numérisées de l’article ou les données expérimentales originales ;
9. réaliser une étude d’indépendance au maillage et au pas de temps ;
10. seulement ensuite connecter le PINN quantique aux champs CFD et réserver un cas indépendant pour l’évaluation finale.

Le statut scientifique à attribuer aujourd’hui est donc :

```text
GEOMETRY_RECONSTRUCTED_AND_MESHED
OPENFOAM_HYDRODYNAMIC_RUN_PASS
VOF_PRESSURE_PHASE_CHANGE_RUN_PASS
STEFAN_ANALYTIC_COMPARISON_PASS_WITH_9.68_PERCENT_ERROR
CHT_SOLVER_SMOKE_TEST_PASS
THERMAL_LH2_VOF_CHT_ARTICLE_REPRODUCTION_NOT_YET_VALIDATED
EXPERIMENTAL_COMPARISON_NOT_YET_COMPLETED
```

## Artefacts

- [Générateur de géométrie et cas OpenFOAM](/home/ubuntu/quantum-hybrid-pinn-audit/tools/create_lh2_tank_transient_case.py)
- [Générateur du cas VOF/changement de phase](/home/ubuntu/quantum-hybrid-pinn-audit/tools/create_openfoam_vof_case.py)
- [Solveur Stefan indépendant](/home/ubuntu/quantum-hybrid-pinn-audit/tools/run_stefan_lh2_independent.py)
- [Résultat Stefan JSON](/home/ubuntu/quantum-hybrid-pinn-audit/artifacts/stefan_lh2_independent/result.json)
- [Maillage et cas OpenFOAM empaquetés](/home/ubuntu/quantum-hybrid-pinn-audit/artifacts/lh2_openfoam_run_package.zip)

## Références

[1]: https://doi.org/10.3390/fluids8090239 "CFD Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank with Different Insulation Thickness in a Small-Scale Hydrogen Liquefier"
