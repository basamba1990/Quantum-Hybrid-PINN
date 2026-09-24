# Plan d’exécution OpenFOAM CHT pour le réservoir LH₂

## Correspondance avec l’article joint

L’article fourni, Jeong, Lee et Moon, *Fluids* 2023, 8, 239, décrit un modèle VOF thermo-hydraulique avec échange interfacial Ranz–Marshall. Les éléments à reproduire sont plus précis que le simple bilan concentré : conservation de la masse avec sources d’évaporation et de condensation, quantité de mouvement avec gravité et force de tension de surface CSF, énergie avec sources de chaleur de changement de phase, et transport de la fraction volumique.

Les équations publiées imposent notamment :

```text
∂ρ/∂t + ∇·(ρu) = S_m,c − S_m,e
∂(ρE)/∂t + ∇·[u(ρE+p)] = ∇·(k_eff∇T) + S_q,e − S_q,c
∂α_q/∂t + ∇·(α_q u_q) = −S_m,e + S_m,c
ρ = α_g ρ_g + (1−α_g)ρ_l
E = (α_gρ_gE_g + α_lρ_lE_l)/(α_gρ_g + α_lρ_l)
```

Le modèle interfacial choisi dans l’article utilise :

```text
Nu = 2 + 0.6 Re^(1/2) Pr^(1/3)
A'''_i = 6 α_d / D_d
S_m,e = C_evap C_A (k_l/D_d) A'''_i Nu (T_l−T_sat)/h_fg, si T_l ≥ T_sat
S_m,c = C_cond C_A (k_l/D_d) A'''_i Nu (T_v−T_sat)/h_fg, si T_v ≥ T_sat
C_A = 1 − sqrt((α_d+α_min)/(α_pack+α_min))
```

Les propriétés LH₂ sont prises comme fonctions de la température et de la pression, avec liquide incompressible et vapeur compressible idéale dans les hypothèses de l’article. La géométrie publiée est un réservoir de 50 L, diamètre 386 mm, section cylindrique de 450 mm, dômes de 99,1 mm et 101,45 mm, aluminium 2219 de 3 mm. Le modèle publié utilise une formulation axisymétrique pour économiser le coût, environ 40 000 cellules après étude de dépendance au maillage, un vent extérieur de 2 m/s et une température ambiante de 283,15 K. Les propriétés rapportées sont `rho_Al=2840 kg/m³`, `cp_Al=864 J/(kg K)`, `k_Al=143 W/(m K)`, `rho_PU=35 kg/m³`, `cp_PU=1674 J/(kg K)` et `k_PU=0,02 W/(m K)`.

Ces éléments sont maintenant la référence pour l’implémentation. Le modèle réduit déjà présent dans le dépôt ne résout pas l’interface VOF Ranz–Marshall et ne doit donc pas être déclaré comme reproduction de l’article.

## Conclusion technique

Le cas demandé comporte deux physiques qui doivent être séparées dans l’implémentation :

1. la conduction conjugée à travers l’aluminium 2219 et le polyuréthane ;
2. l’écoulement multiphasique LH₂/vapeur avec évaporation et condensation.

`chtMultiRegionFoam` est adapté au couplage fluide-solide et à l’équation d’énergie des régions. Il ne fournit pas, à lui seul, une fermeture thermo-énergétique complète pour l’interface liquide-vapeur LH₂. Le projet doit donc utiliser `foamMultiRun` avec des solveurs par région pour la partie CHT, plus un solveur multiphasique ou une extension dédiée pour la phase LH₂/vapeur.

Le statut à conserver jusqu’à l’exécution complète est `THERMAL_LH2_VOF_CHT_NOT_VALIDATED`.

## Régions attendues

La configuration cible est :

```text
LH2
aluminium2219
polyurethane10mm
polyurethane20mm
polyurethane30mm
```

Les trois épaisseurs d’isolation sont des **cas alternatifs**, pas trois régions PU simultanées dans un même réservoir physique. Pour chaque cas, le maillage doit contenir une seule région d’isolation :

```text
LH2 + aluminium2219 + polyurethane10mm
LH2 + aluminium2219 + polyurethane20mm
LH2 + aluminium2219 + polyurethane30mm
```

Conserver les trois noms dans `regionProperties` est acceptable pour un banc de configuration, mais un run physique doit activer une seule épaisseur à la fois. Sinon, le flux thermique traverserait trois isolants en série et ne représenterait aucun des cas de l’article.

## Contrat thermo-énergétique minimal

Avant d’exécuter un cas article-comparable, le contrat doit fournir une loi documentée pour :

```text
h_lh2(p,T)          enthalpie liquide/vapeur LH₂
h_fg(p)             chaleur latente
T_sat(p)            température de saturation
rho_l(p,T)          masse volumique liquide
rho_v(p,T)          masse volumique vapeur
m_dot_evap          flux de masse d’évaporation
m_dot_cond          flux de masse de condensation
q_wall              flux à travers la paroi
```

Une fermeture enthalpique typique, à documenter et calibrer, est :

```text
m_dot_evap = C_evap * A_i * max(0, T_wall - T_sat(p)) * rho_ref * cp_ref / h_fg(p)
m_dot_cond = C_cond * A_i * max(0, T_sat(p) - T_wall) * rho_ref * cp_ref / h_fg(p)
S_h        = (m_dot_cond - m_dot_evap) * h_fg(p)
```

Cette forme est un modèle de travail. Elle ne doit pas être présentée comme le modèle de l’article sans vérifier les équations, les coefficients, la surface interfaciale et les données expérimentales de l’article.

## Construction du maillage

La géométrie de référence actuelle est une reconstruction paramétrée de 50 L et non la CAO auteur. Le manifeste de géométrie indique un diamètre interne de 0,386 m, une hauteur totale de 0,494123 m et une paroi aluminium de 3 mm. Le volume corrigé doit être confirmé par `checkMesh` et `volumeMesh` avant tout run thermique.

La méthode recommandée est :

```text
1. surface fermée du volume intérieur LH₂ ;
2. surface extérieure aluminium ;
3. surface extérieure PU pour l’épaisseur sélectionnée ;
4. maillage de fond avec blockMesh ;
5. snappyHexMesh avec cellZone pour chaque volume ;
6. splitMeshRegions -cellZones ;
7. vérification des interfaces et des volumes par région.
```

Les interfaces doivent être conformes. Une simple superposition de trois maillages non conformes ne suffit pas pour `chtMultiRegionFoam` sans traitement d’interface approprié.

Commandes de principe :

```bash
source /opt/openfoam12/etc/bashrc
blockMesh
snappyHexMesh -overwrite
splitMeshRegions -cellZones -overwrite
checkMesh -allGeometry -allTopology
```

Les noms de zones et de régions doivent être vérifiés dans :

```bash
constant/polyMesh/cellZones
constant/regionProperties
```

## Configuration `foamMultiRun`

Un contrôle multi-région OpenFOAM 12 suit cette structure :

```foam
application     foamMultiRun;
regionSolvers
{
    // OpenFOAM 12 stock module; thermal LH2 phase change requires an extension.
    LH2             incompressibleMultiphaseVoF;
    aluminium2219   solid;
    polyurethane10mm solid;
}

startFrom       startTime;
startTime       0;
endTime         600;
deltaT          0.1;
writeControl    adjustableRunTime;
writeInterval   10;
maxCo           0.5;
```

Pour un cas purement CHT sans changement de phase, le fluide peut être remplacé par `fluid` ou le solveur thermo-compressible disponible dans l’installation. Pour le cas LH₂/vapeur, le module VOF stock `incompressibleMultiphaseVoF` ne suffit pas : il faut un module personnalisé qui possède les champs `alpha`, `T` et `h` ainsi que la fermeture d’évaporation/condensation. L’alternative OpenFOAM native est `multiphaseEuler` avec `thermalPhaseChangeMultiphaseSystem`, mais elle doit être déclarée comme modèle Euler multiphasique et non comme reproduction VOF de l’article.

## Propriétés des solides

Les propriétés doivent être documentées dans les dictionnaires de chaque région. Les valeurs initiales du modèle réduit sont :

```text
aluminium 2219 : rho = 2840 kg/m3, cp = 864 J/(kg K), k = 143 W/(m K)
polyuréthane  : rho = 35 kg/m3, cp = 1674 J/(kg K), k = 0.02 W/(m K)
```

Ces valeurs sont des hypothèses de travail. Elles doivent être remplacées ou référencées par des données dépendantes de la température si l’article les exige.

## Études à exécuter

Pour chaque épaisseur 10, 20 et 30 mm, exécuter au moins trois maillages :

```text
coarse   : résolution de base
medium   : environ 2× le nombre de cellules dans chaque direction pertinente
fine     : environ 4× le nombre de cellules dans chaque direction pertinente
```

Le raffinement doit être appliqué dans l’aluminium, l’isolant et la zone interfaciale. Une étude uniquement basée sur le nombre total de cellules est insuffisante.

Comparer à temps final identique :

```text
pression moyenne et maximale ;
m masse liquide ;
température liquide moyenne et maximale ;
température de paroi interne et externe ;
flux thermique à l’interface ;
taux de boil-off ;
fermeture de masse ;
fermeture d’énergie.
```

Pour l’étude de pas de temps, utiliser au minimum :

```text
Δt = 1 s, 0.5 s, 0.25 s
```

avec un contrôle `maxCo` documenté. L’acceptation doit être basée sur les différences entre les séries temporelles, pas seulement sur la dernière valeur.

## Contrôles avant connexion PINN

Le PINN ne doit être connecté qu’après la production de fichiers VTU avec :

```text
rho
velocity
pressure
temperature
alpha_liquid
enthalpy
```

Chaque frame doit avoir la même connectivité et un hash SHA-256 déclaré dans `sidecar.json`. Les champs dérivés doivent être distingués des champs produits directement par le solveur.

Le statut ne peut passer à une validation physique que si les preuves suivantes sont présentes :

```text
maillage et géométrie ;
unités et champs ;
provenance du solveur ;
résidus ;
historiques masse/énergie ;
comparaison indépendante ;
reproduction du run.
```

## Commandes de vérification

```bash
python3 tools/validate_lh2_cht_readiness.py \
  --case pilot_case/PILOT-LH2-001/cht_multiregion \
  --json artifacts/lh2_cht_readiness.json
```

La commande doit être lancée avant tout import VTU ou connexion PINN.

## Limitation actuelle

Le package `lh2_cht_v2_evidence.zip` contient le manifeste corrigé, les logs de maillage et les résultats du modèle thermo-CHT réduit. Il ne contient pas encore un run OpenFOAM multi-région conforme avec LH₂, aluminium et polyuréthane. Les résultats du modèle réduit sont utiles pour le contrôle de tendance et la préparation de l’étude, mais ils ne doivent pas être mélangés aux résultats d’un solveur CFD.

## Références

[1]: https://openfoam.org/download/12-ubuntu/ "OpenFOAM 12 installation for Ubuntu"
[2]: https://openfoam.org/user-guide/ "OpenFOAM User Guide"
[3]: https://doi.org/10.3390/fluids8090239 "CFD Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank with Different Insulation Thickness"
