# Pilote LH2 diphasique — Rapport technique bilingue

**Projet :** PILOT-LH2-001  
**Solveur :** OpenFOAM 2512, `reactingTwoPhaseEulerFoam`  
**Thermodynamique :** parahydrogène via CoolProp HEOS, références NIST  
**Statut :** **INCONCLUSIVE — validation non acquise**  
**Date :** 2 septembre 2026

## Résumé exécutif — français

Le pilote transpose la logique de preuve du démonstrateur NACA 0012 vers un écoulement interne de parahydrogène liquide-vapeur avec transfert thermique et changement de phase. La compilation du correctif `Psmooth()` est réussie et la bibliothèque est chargée par le solveur. L’inversion `hTabulatedThermo` a été diagnostiquée : la table `Cp(T)` était utilisée hors de son domaine LH2, avec une référence d’intégration proche de 298,15 K alors que la table s’arrêtait vers 32,5 K. Un adaptateur CoolProp a ensuite été recompilé avec `psi = (∂rho/∂p)|T`, des bornes cryogéniques et des planchers positifs.

Le calcul reste bloqué. Avec `phaseChange on`, `Tf.gasAndLiquid` et `iDmdt.gasAndLiquid` deviennent `NaN` après la mise à jour de `alpha.gas`. Avec `phaseChange off`, `Tf` reste fini près de 21,01 K, mais la matrice de pression devient `NaN`. Ces résultats démontrent une progression du diagnostic, pas une validation physique. Les jeux `CFD-BASELINE` et `CFD-INDEPENDENT` ne doivent donc pas être déclarés et aucun PINN-T held-out ne doit être entraîné sur ces sorties.

## Executive summary — English

This pilot transfers the evidence-chain logic of the NACA 0012 demonstrator to an internal two-phase parahydrogen flow with heat transfer and phase change. The `Psmooth()` patch was compiled successfully and the resulting library is loaded by the solver. The `hTabulatedThermo` failure was diagnosed: the `Cp(T)` table was evaluated outside the LH2 domain, with an integration reference near 298.15 K while the table ended near 32.5 K. A CoolProp adapter was then rebuilt with `psi = (∂rho/∂p)|T`, cryogenic temperature bounds, and positive floors.

The calculation remains blocked. With `phaseChange on`, `Tf.gasAndLiquid` and `iDmdt.gasAndLiquid` become `NaN` after the `alpha.gas` update. With `phaseChange off`, `Tf` remains finite near 21.01 K, but the pressure matrix becomes `NaN`. This is diagnostic progress, not physical validation. `CFD-BASELINE` and `CFD-INDEPENDENT` must therefore not be declared, and no held-out PINN-T must be trained on these outputs.

## 1. Cause technique des NaN dans `Tf.gasAndLiquid`

Dans la chaîne actuelle, le premier calcul fin est la saturation interfaciale. La table NIST utilisée contient notamment `125310 Pa → 21,010 K`. Elle est interpolée par pression absolue. Si la pression fournie au modèle est `p_rgh`, si elle est hors domaine, si elle est non finie, ou si elle est utilisée avec une convention d’unités différente, la température de saturation devient invalide. Le modèle de transfert produit alors un `Tf` non fini et un `iDmdt` non fini ; la division ultérieure dans le système multiphasique déclenche la FPE ou propage des NaN.

Le cas CoolProp ajoute une seconde contrainte : une paire `P,T` peut être non admissible pour `ParaHydrogen` dans la région proche de saturation ou si l’itération Newton s’éloigne de la plage pilote. Une limite silencieuse de température n’est pas suffisante pour une validation finale ; elle doit être accompagnée d’un contrôle de domaine et d’un journal d’événements.

## 2. Correctif de production recommandé

| Étape | Correctif | Test d’acceptation |
|---|---|---|
| Pression | Reconstruire `p_abs = p_rgh + rho*g*h` avant `Tsat(p)` | `p_abs` fini et dans le domaine de la table |
| Saturation | Table monotone en pression absolue, unités Pa/K explicites | interpolation bornée, aucun extrapolateur silencieux |
| Thermo | CoolProp pour `rho`, `h`, `Cp`, `mu`, `psi`; dérivées bornées | valeurs finies et strictement positives où requis |
| Interface | Refuser tout `Tf`, `Tsat`, `hfg`, `K` ou `iDmdt` non fini | arrêt explicite avec cellule et phase |
| Changement de phase | Régulariser le terme avec `residualAlpha`, `residualDeltaT` et un coefficient limité | `iDmdt` fini, signe cohérent avec évaporation/condensation |
| Pression | Vérifier `psi`, `rho`, vitesse du son et coefficients de compressibilité | matrice `p_rgh` finie avant solveur |
| Initialisation | Initialiser `alpha.gas > residualAlpha` et des états thermo cohérents | premier correcteur sans NaN |
| Reproduction | Exécuter deux cas dans deux répertoires propres | mêmes métriques dans les tolérances pré-déclarées |

Le correctif ne doit pas transformer un NaN en zéro. Il doit interrompre le calcul avec un diagnostic exploitable. La phase suivante doit aussi remplacer la dépendance structurelle à `icoTabulated` comme classe EOS de base par une classe EOS CoolProp cohérente, ou démontrer formellement que chaque méthode utilisée par `heRhoThermo` est bien redirigée vers CoolProp.

## 3. Ce qui est transposable depuis NACA 0012

Le commentaire de Laurent est pleinement applicable. Pour LH2, la traçabilité doit couvrir non seulement les logs et les condensats, mais également l’image OpenFOAM, la version du patch, les bibliothèques CoolProp, les tables NIST, les unités, la géométrie, le maillage, les conditions cryogéniques, les lois de saturation, les règles de sécurité numérique et l’historique des redémarrages. La preuve systémique doit documenter qui gèle les critères, qui autorise un changement de modèle et comment les artefacts sont conservés.

Le commentaire de Kemi est également directement applicable. L’analogue de l’angle d’attaque tenu n’est pas une seconde valeur arbitraire de température ; il doit être une condition réellement non vue, par exemple une combinaison gelée de pression absolue, flux thermique, fraction vapeur initiale et durée transitoire. Le jeu d’évaluation ne doit jamais être lu par le script d’entraînement. La CFD de référence doit être physiquement acceptée avant d’évaluer le PINN.

| NACA 0012 | LH2 |
|---|---|
| AoA 5° d’entraînement | état thermo-hydraulique d’entraînement gelé |
| AoA 17° held-out | pression/flux/fraction vapeur/trajectoire non vue |
| convergence SU2 | résidus OpenFOAM + bilans masse/énergie + champs finis |
| `CL`, `CD` | débit, taux de boil-off, pression, température, densité, fraction vapeur |
| champ aérodynamique | champs diphasiques et variables thermodynamiques |

## 4. Décision concernant les jeux et le PINN-T

La déclaration de `CFD-BASELINE` et `CFD-INDEPENDENT` serait prématurée. Les essais actuels sont des **runs diagnostiques** : ils montrent la sélection du thermo et le franchissement de certaines étapes, mais pas deux trajectoires convergées. La fabrication de jeux à partir de champs contenant `NaN`, d’un run avec `phaseChange off`, ou d’une trajectoire arrêtée constituerait une référence invalide et pourrait introduire une fuite méthodologique.

La chaîne correcte est :

> **CFD convergée → contrôle physique → gel des manifestes → séparation baseline/independent → entraînement baseline uniquement → évaluation held-out → reproduction à blanc → décision.**

## 5. Verdict

Le pilote est **reproductible au niveau du diagnostic**, mais non validé au niveau de la physique diphasique. Le statut reste **INCONCLUSIVE**. Les prochaines actions prioritaires sont la fermeture robuste de `Tsat`, `Tf` et `iDmdt`, la vérification de la pression absolue et la suppression de la dépendance EOS résiduelle à `icoTabulated`. Après seulement, deux trajectoires distinctes pourront être produites et le PINN-T pourra être entraîné sans fuite.

## Références / References

[1]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "NIST — Fundamental Equations of State for Parahydrogen, Normal Hydrogen, and Orthohydrogen"

[2]: https://trc.nist.gov/cryogenics/fluidProperties.html "NIST — Cryogenic Fluid Properties"

[3]: https://www.energy.gov/cmei/fuels/hydrogen-storage "U.S. DOE — Hydrogen Storage"

[4]: https://api.openfoam.com/2512/classFoam_1_1hTabulatedThermo.html "OpenFOAM v2512 — hTabulatedThermo"

[5]: https://doc.openfoam.com/2306/tools/processing/models/thermophysical/thermodynamics/rtm/hTabulated/ "OpenFOAM — hTabulated thermodynamics"
