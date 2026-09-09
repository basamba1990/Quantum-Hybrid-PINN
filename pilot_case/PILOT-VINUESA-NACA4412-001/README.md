# PILOT-VINUESA-NACA4412-001 — Pré-validation PINN-RANS classique/hybride

## Statut

`INCONCLUSIVE — PREPARATION ONLY`

Ce dossier définit un cas unique et une chaîne de preuve. Il ne contient pas encore une autorisation de données, un artefact VinuesaLAB téléchargé, une référence solver acceptée, un run PINN, une variante quantique exécutée ou une seconde reproduction. Aucune valeur `PASS` ou `VALIDATED` n’est autorisée.

## Cas retenu

| Élément | Déclaration contrôlée |
|---|---|
| Géométrie | Profil aérodynamique **NACA4412** |
| Configuration | Écoulement externe turbulent incompressible, stationnaire ou moyenne temporelle selon la source finalement autorisée |
| Reynolds de référence | `Re_c = 200000`, confirmé dans le README du dépôt PINN-RANS ; l’autorisation d’usage reste à confirmer |
| Longueur de référence | Corde `c`, valeur numérique à enregistrer dans les unités du fichier source |
| Repère | `x` tangent à la corde, `y` normal au profil dans le plan 2D ; origine et orientation à confirmer dans le sidecar |
| Variables comparées | `u`, `v`, pression si disponible, contraintes de Reynolds et quantités intégrales si disponibles |
| Référence | Données LES/RANS autorisées et indépendante, avec provenance, configuration et logs suffisants |
| Entraînement | Sous-ensemble explicitement enregistré, sans accès au manifeste d’évaluation |
| Évaluation | Condition indépendante, idéalement `Re_c` ou position streamwise tenue hors entraînement |
| Criticité | Cas de recherche non critique pour la sécurité ; aucune décision opérationnelle autorisée |

La valeur `Re_c = 200000` est confirmée par le README du cas NACA4412 du dépôt PINN-RANS. Elle est basée sur `U_infinity` et la corde `c`. Elle ne constitue pas une validation physique ni une autorisation de licence.

## Artefact réel acquis

Les fragments `NACA4412/data/xaa` à `xaw` ont été réunis selon le script public `NACA4412/gen-Wing-Data` dans `artifacts/input_raw/top2n_HighRes.npz`.

| Élément | Valeur |
|---|---|
| Taille | `237619462` octets |
| SHA-256 | `dac13d230ab834e4112480ccebf3682ef6756e524daecbc2bcd2299471782a6a` |
| Dimensions | `11071 × 195` pour les champs principaux |
| Variables | `U`, `V`, `P`, `uu`, `uv`, `vv`, coordonnées et dérivées disponibles |
| Source commit | `26ba60bcf53476ca26c2fc20c82e5aa110343315` |
| Lecture seule | Oui |
| Licence/autorisation propriétaire | `PENDING_WRITTEN_OWNER_CONFIRMATION` |

La présence publique du dépôt n’est pas traitée comme une licence suffisante.

## Visualisation Quantum sans fausse validation

`artifacts/derived/naca4412_cfd_preview.json` est un aperçu `cfd-volume.v1` dérivé de l’artefact réel. Il contient une géométrie 2D embarquée en 3D, un maillage quadrilatère dérivé et les champs `U`, `V`, `P`, `uu`, `uv`, `vv` pour permettre le rendu dans Quantum.

Cet aperçu n’est pas le maillage CFD original. Il porte explicitement les états suivants : résidus de masse, quantité de mouvement et énergie `N/D`, comparaison de référence non effectuée, solveur indépendant non accepté et statut G0-G5 `UNVALIDATED`. Il peut donc alimenter le visualiseur sans afficher `CFD mesh unavailable: no real artifact loaded`, mais il ne peut pas afficher `VALIDATED` ni `PASS`.

## Sources candidates

1. Dépôt PINN-RANS VinuesaLAB-AI : https://github.com/VinuesaLAB-AI/Physics-informed-neural-networks-for-solving-Reynolds-averaged-Navier-Stokes-equations
2. Base WING VinuesaLAB : https://www.vinuesalab.com/wing/
3. Dépôt de données NACA4412 et contrôle de séparation : https://github.com/VinuesaLAB-AI/Separation-Control-Applied-To-The-Turbulent-Flow-Around-A-NACA4412-Wing-Section

Ces liens prouvent l’existence de sources publiques. Ils ne prouvent ni l’autorisation spécifique d’usage dans ce pilote, ni la conformité du contenu réel au contrat CFD.

## Gates de reprise

| Gate | Condition de reprise | État |
|---|---|---|
| G0 | Autorisation écrite, licence, protocole et tolérances approuvés | `BLOCKED` |
| G1 | Géométrie, maillage, champs, frontières et sidecar cohérents | `BLOCKED` |
| G2 | Reynolds, unités, conditions et repères vérifiés dans les artefacts | `BLOCKED` |
| G3 | Environnement, seed, configuration, logs et sorties hashés | `BLOCKED` |
| G4 | Résidus réels de masse, quantité de mouvement et énergie disponibles | `BLOCKED` |
| G5 | Comparaison held-out, tolérances approuvées et seconde reproduction concordante | `BLOCKED` |

Le runner doit s’arrêter si une gate est `BLOCKED`, `PENDING`, `UNAVAILABLE` ou `CONTRADICTORY`.

## Règle classique/quantique

La baseline classique et la variante hybride/quantique doivent consommer la même interface d’entrée, le même split d’évaluation tenu à l’écart, les mêmes unités et les mêmes définitions de métriques. Une amélioration de score ne peut jamais remplacer une preuve de physique, de provenance ou de reproduction.

## Résultat autorisé à ce stade

`INCONCLUSIVE`. La chaîne est préparée, mais le pilote n’est pas validé.

## Références

[1]: https://github.com/VinuesaLAB-AI/Physics-informed-neural-networks-for-solving-Reynolds-averaged-Navier-Stokes-equations "VinuesaLAB-AI — PINNs for Reynolds-averaged Navier–Stokes equations"
[2]: https://www.vinuesalab.com/wing/ "VinuesaLAB — WING database"
[3]: https://github.com/VinuesaLAB-AI/Separation-Control-Applied-To-The-Turbulent-Flow-Around-A-NACA4412-Wing-Section "VinuesaLAB-AI — NACA4412 separation-control database"

**Statut :** `INCONCLUSIVE — STOP UNTIL GATES ARE SATISFIED`

## Préparation de la reproduction G5

Le script `tools/simulate_clean_reproduction.py` prépare deux environnements propres et rejoue les contrôles de provenance, de hash et de split. Les précontrôles concordent dans `reproduction_2_simulation/simulation_report.json`.

Cette exécution est explicitement `SIMULATED_PRECHECK_ONLY`. Elle ne compte pas comme reproduction scientifique et ne modifie pas le statut `UNVALIDATED` : aucun entraînement, aucune inférence, aucune baseline classique, aucune variante hybride/quantique et aucun résidu physique n’ont été exécutés.
