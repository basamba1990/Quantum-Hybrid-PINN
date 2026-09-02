# PILOT-LH2-001 — Démonstrateur PINN-T cryogénique

## Statut actuel

**INCONCLUSIVE — diagnostic OpenFOAM reproductible, mais calcul diphasique de production non convergé.** Le patch `Psmooth()` est compilé et l’adaptateur CoolProp est chargé. Les essais avec `phaseChange on` produisent encore des `NaN` dans `Tf.gasAndLiquid` et `iDmdt.gasAndLiquid`; aucune certification, aucun score de crédibilité et aucun résultat thermodynamique ne sont présentés comme validés.

## Objectif

Ce pilote étend la chaîne de preuve CFD/PINN-T à un écoulement interne transitoire de parahydrogène liquide-vapeur, avec transfert thermique de paroi, saturation et boil-off. Il ne modélise ni combustion, ni explosion, ni installation industrielle complète, ni procédure de manipulation LH2 réelle, ni certification de sécurité.

La page publique **New PINN Project** expose actuellement une démonstration pré-calculée en lecture seule. Elle ne lance pas encore `reactingTwoPhaseEulerFoam` et ne doit pas afficher `VALIDATED` pour `PILOT-LH2-001` tant que G0–G6 ne sont pas satisfaites.

## Architecture de preuve

> **Artefact → Version → Calcul → Contrôle physique → Comparaison → Décision**

Les artefacts attendus sont le dictionnaire OpenFOAM, la géométrie, le maillage, l’image ou l’environnement de calcul, la bibliothèque CoolProp, les tables thermodynamiques, les journaux du solveur, les résidus, les bilans, les jeux de données et leurs empreintes SHA-256.

## Cas physique

| Élément | Définition | État |
|---|---|---|
| Fluide | Parahydrogène | Défini, à auditer dans le domaine choisi |
| Phases | Liquide + vapeur | En cours de stabilisation |
| Changement de phase | Évaporation/condensation et boil-off | Bloqué par NaN interfaciels |
| Thermodynamique | CoolProp parahydrogène, références NIST | Adaptateur compilé, fermeture à compléter |
| Solveur | OpenFOAM 2512 `reactingTwoPhaseEulerFoam` | Chargement vérifié, convergence non acquise |
| Géométrie | Canal 2D déterministe, 2,00 m × 0,10 m | Versionnée comme support explicatif |
| Entraînement | `CFD-BASELINE` uniquement | Non déclaré avant convergence |
| Évaluation | `CFD-INDEPENDENT` held-out | Non déclaré avant convergence |

## Correction du problème h-T et des NaN

La table `Cp(T)` initiale était limitée à environ `21,01–32,51 K`, alors que l’inversion générique d’OpenFOAM utilise une référence d’enthalpie proche de `298,15 K`. Cette combinaison rend l’extrapolation non physique. Le type `coolPropThermo` redirige maintenant `Ha`, `Cp`, `rho` et `psi` vers CoolProp et applique des bornes cryogéniques strictes.

La correction définitive doit également reconstruire la pression absolue avant l’interpolation de `Tsat`, vérifier les unités Pa/K, régulariser `iDmdt` près de `Tf = Tsat`, et arrêter explicitement le calcul sur toute valeur non finie. Un `NaN` ne doit jamais être remplacé silencieusement par zéro.

## Séparation des données PINN-T

`CFD-BASELINE` sera réservé à l’ajustement du modèle et de la normalisation. `CFD-INDEPENDENT` sera produit dans un dossier séparé, avec une condition thermique ou hydraulique réellement absente du train. Le processus d’entraînement ne devra lire ni le manifeste, ni les chemins, ni les hachages du jeu indépendant. L’évaluation chargera un checkpoint figé sans réentraînement.

Aucun jeu valide n’est déclaré tant que les deux trajectoires ne présentent pas des champs finis, des résidus admissibles, des bilans masse-énergie contrôlés et une reproduction indépendante.

## Gates

| Gate | Preuve requise | Statut |
|---|---|---|
| G0 | Sources, unités, critères et domaine thermodynamique gelés | INCONCLUSIVE |
| G1 | Géométrie, maillage et frontières contrôlés | INCONCLUSIVE |
| G2 | `CFD-BASELINE` convergée avec phase change | INCONCLUSIVE |
| G3 | `CFD-INDEPENDENT` convergée dans un dossier séparé | INCONCLUSIVE |
| G4 | PINN-T entraîné uniquement sur baseline | INCONCLUSIVE |
| G5 | Métriques held-out dans les seuils pré-déclarés | INCONCLUSIVE |
| G6 | Reproduction propre et même décision | INCONCLUSIVE |

## Références

[1]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen — NIST, équations d’état du parahydrogène.

[2]: https://trc.nist.gov/cryogenics/fluidProperties.html — NIST, propriétés des fluides cryogéniques.

[3]: https://webbook.nist.gov/cgi/cbook.cgi?ID=1333-74-0 — NIST Chemistry WebBook, hydrogen.

[4]: https://www.energy.gov/cmei/fuels/hydrogen-storage — U.S. DOE, hydrogen storage.

[5]: https://api.openfoam.com/2512/classFoam_1_1hTabulatedThermo.html — OpenFOAM 2512, `hTabulatedThermo`.
