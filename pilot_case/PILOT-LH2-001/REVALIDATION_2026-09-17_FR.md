# Revalidation réelle OpenFOAM–CoolProp–LH₂ — 17 septembre 2026

## Conclusion

La plateforme logicielle est opérationnelle au niveau de l’installation et du chargement du solveur, mais le pipeline scientifique n’est pas encore validé. OpenFOAM v2512 a été installé depuis le dépôt officiel signé OpenCFD. Le solveur `reactingTwoPhaseEulerFoam` est présent et exécutable. CoolProp Python 8.0.0 a passé les tests de propriétés, et CoolProp natif 7.2.0 a été compilé avec succès. L’adaptateur `liblh2CoolPropThermo.so` a été compilé contre OpenFOAM v2512 et CoolProp natif, sans dépendance dynamique manquante.

Le calcul réel `CFD-BASELINE` repartant de `0.orig` s’arrête néanmoins au premier pas thermo. Le journal montre que le solveur charge bien `coolPropThermo` pour les deux phases, puis refuse une température inversée de **147.005 K** alors que la fenêtre LH₂ déclarée à `p = 125310 Pa` est **[15.0100593, 21.0300593] K**. Cette fermeture fail-closed est correcte : aucune valeur n’a été clampée silencieusement. Il n’existe donc pas encore de baseline convergé, de résidus contractuels complets, de bilan masse-énergie validé, de reproduction indépendante, ni de métriques d’entraînement ou d’évaluation V8 acceptables.

**G3, G4 et G5 restent fermés.** Le statut scientifique demeure `INCONCLUSIVE`, et non `CONCLUSIVE` ou `G3Eligible`.

## Installation et preuves logicielles

Le dépôt `https://dl.openfoam.com/repos/deb` a été ajouté par l’installateur officiel HTTPS `https://dl.openfoam.com/add-debian-repo.sh`. Les paquets installés sont `openfoam2512`, `openfoam2512-common`, `openfoam2512-default`, `openfoam2512-dev`, `openfoam2512-source`, `openfoam2512-tools` et `openfoam2512-tutorials`, tous en version `2512.0-2`.

La version vérifiée est `OpenFOAM-v2512`. Le binaire réel est situé dans `/usr/lib/openfoam/openfoam2512/platforms/linux64GccDPInt32Opt/bin/reactingTwoPhaseEulerFoam`. Le compilateur est GCC/G++ 13.3.0. Le contrôle `ldd` du solveur et de l’adaptateur ne révèle aucune bibliothèque `not found`. Les empreintes des bibliothèques et journaux sont dans `evidence/REVALIDATION_SHA256SUMS`.

## Validation CoolProp et cohérence thermo

La suite indépendante a vérifié les points suivants pour le fluide `Hydrogen` avec CoolProp 8.0.0 :

1. un état sous-refroidi à pression élevée ;
2. un état liquide saturé par `P,Q=0` ;
3. un état vapeur saturée par `P,Q=1` ;
4. un état vapeur surchauffée ;
5. la croissance stricte de `h(T,p)` sur trois pressions et dix températures ;
6. le round-trip `h(T,p)` puis `T(p,h)` avec une erreur maximale inférieure à `1.3e-11 K` dans les points testés ;
7. la finitude et la positivité de `p`, `T`, `h`, `rho`, `Cp`, `mu` et `k` dans l’enveloppe sondée ;
8. l’interdiction explicite de tout clamp ou fallback silencieux.

Ces tests sont **passants**, mais ils ne prouvent pas à eux seuls que la fermeture OpenFOAM `sensibleEnthalpy` est cohérente avec `coolPropThermo` et `icoTabulated` dans la combinaison diphasique du cas.

Le diagnostic de cohérence est précis. Les champs initiaux contiennent environ `7573.925 J/kg` pour le liquide et `449885.564 J/kg` pour le gaz à `T=21.01 K` et `p=125310 Pa`. CoolProp donne respectivement `7574.548 J/kg` et `449885.851 J/kg` aux états saturés correspondants. Pourtant, après l’assemblage `heRhoThermo`/`icoTabulated`, l’inversion interne demande une température de `147.005 K`. La prochaine correction doit donc vérifier le contrat d’énergie d’OpenFOAM, la référence `Hf`, la conversion molaire ou massique et le chemin exact de `T(h,p,T0)` avant toute modification de borne. Une borne élargie ou un clamp serait scientifiquement irrecevable.

## Run CFD-BASELINE réel

Le cas a été nettoyé et relancé depuis `0.orig`. `blockMesh` a produit un maillage de 1875 cellules et s’est terminé avec le marqueur `End`. Le solveur a chargé :

```text
thermo          coolPropThermo;
equationOfState icoTabulated;
energy          sensibleEnthalpy;
```

Le premier pas de temps est `Time = 0.00011999`, après lequel le calcul s’arrête dans `safeT` :

```text
T outside phase window at p=125310 Pa: T=147.005 K,
expected [15.0100593, 21.0300593] K, phaseQuality=0
```

Aucun état convergé n’a été obtenu. Aucun résidu final ni bilan masse-énergie complet ne peut être déclaré. Le log de solveur archivé est `evidence/baseline_reactingTwoPhaseEulerFoam_2026-09-17.log`.

## Dashboard et visualisation 3D

Le garde-fou de chemin de rendu production passe : aucune ancienne visualisation CFD basée sur un point-cloud ou un composant interdit n’est détectée. Le code du dashboard utilise le composant `CFDViewer` et prévoit un état explicite `NO_CFD_ARTIFACT` lorsque les artefacts persistants manquent.

La vérification de la visualisation 3D en production ne peut toutefois pas être déclarée complète. Aucun artefact CFD certifié issu d’un run convergé n’a été produit dans cette revalidation. Les tests Vitest n’ont pas été exécutés car `apps/web/node_modules` est absent. L’affichage d’une géométrie de démonstration ne constituerait pas une preuve de calcul scientifique.

## Décision de pipeline

| Étape | Décision | Preuve actuelle |
|---|---|---|
| Installation OpenFOAM 2512 | PASS | Paquets signés `2512.0-2`, version et solveur vérifiés |
| Installation CoolProp | PASS | Python 8.0.0 ; natif 7.2.0 compilé et lié |
| Tests sous-refroidi, saturé, vapeur | PASS | Résultats JSON archivés |
| Monotonie `h(T,p)` | PASS | Trois pressions, grille monotone |
| Round-trip `T(p,h)` | PASS côté CoolProp isolé | Erreur maximale observée inférieure à `1.3e-11 K` |
| Baseline CFD | BLOCKED | Arrêt thermo à `147.005 K` |
| CFD-INDEPENDENT | NOT REACHED | Séquence conservatrice |
| Entraînement V8 | NOT REACHED | Baseline non convergé |
| Évaluation V8 indépendante | NOT REACHED | Aucun modèle accepté |
| G3 | CLOSED | Pas de contrat physique CFD complet validé |
| G4 | CLOSED | Pas de convergence et de résidus acceptables |
| G5 | CLOSED | Pas de comparaison indépendante validée |
| Production 3D | NOT CERTIFIED | Chemin de rendu contrôlé, artefact certifié absent |

## Étapes nécessaires avant reprise

La prochaine modification doit ajouter un test ciblé de contrat d’énergie entre `h.gas`/`h.liquid`, `Hf`, `ha`, `Hs`, `HE` et la fonction `T(p,h,T0)`. Ce test doit comparer les valeurs OpenFOAM et CoolProp sur une grille commune sous-refroidie, saturée et vapeur. Il doit échouer dès qu’un round-trip dépasse la tolérance ou qu’un état sort du domaine physique.

Ensuite, le cas baseline doit être relancé depuis zéro avec des champs `h` cohérents et les mêmes paramètres de pression absolue. Les résidus de masse, quantité de mouvement et énergie doivent être extraits, et les bilans doivent être calculés indépendamment du solveur. Tant que ce run n’est pas convergé et reproduit dans un environnement propre, `CFD-INDEPENDENT` ne doit pas être lancé. L’entraînement et l’évaluation V8 ne peuvent commencer qu’après ces deux conditions.

## Réponse courte à Laurent

> OpenFOAM 2512 et CoolProp sont réellement installés et vérifiés. Le solveur diphasique charge bien l’adaptateur CoolProp et le run baseline démarre réellement. La validation thermo isolée est passante, mais le couplage OpenFOAM `T(p,h)` avec `sensibleEnthalpy` et `icoTabulated` produit encore une température non physique de 147.005 K à 125310 Pa. Le mécanisme fail-closed bloque correctement le calcul sans clamp silencieux. Il n’y a donc pas encore de preuve de convergence ni de base scientifique pour ouvrir G3/G4/G5. CFD-INDEPENDENT et V8 restent volontairement non lancés jusqu’à correction et reproduction de cette incohérence.

## Références

[1]: https://doi.org/10.3390/fluids8090239 "CFD Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank with Different Insulation Thickness in a Small-Scale Hydrogen Liquefier"
[2]: https://gitlab.com/openfoam/core/openfoam/-/wikis/precompiled/debian "OpenFOAM precompiled Debian and Ubuntu packages"
[3]: https://api.openfoam.com/2512/reactingTwoPhaseEulerFoam_8C.html "OpenFOAM v2512 reactingTwoPhaseEulerFoam documentation"
[4]: https://github.com/CoolProp/CoolProp/releases/tag/v7.2.0 "CoolProp v7.2.0 source release"
