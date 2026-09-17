# Rapport de run réel LH₂ — 2026-09-17

## Verdict

Le runner réel OpenFOAM v2512 et l’adaptateur CoolProp ont été installés et compilés. Le cas `CFD-BASELINE` a été lancé avec `reactingTwoPhaseEulerFoam`. Le solveur a chargé `coolPropThermo`, construit le système diphasique et atteint le premier pas de temps, puis a arrêté le calcul sur une température hors domaine thermodynamique : `T=147.005 K` pour une fenêtre attendue d’environ `15.010–21.030 K` à `p=125310 Pa`.

Le résultat est donc **NON CONVERGÉ** et reste `INCONCLUSIVE`. Aucun run `CFD-INDEPENDENT`, entraînement V8, évaluation held-out ou décision `CONCLUSIVE/G3Eligible` n’a été lancé.

## Environnement vérifié

OpenCFD/Keysight OpenFOAM `2512.0-2` a été installé depuis le dépôt Debian/Ubuntu officiel signé par l’installateur HTTPS `https://dl.openfoam.com/add-debian-repo.sh`. Le préflight détecte désormais :

- `WM_PROJECT_VERSION=v2512` ;
- `reactingTwoPhaseEulerFoam` présent dans `/usr/lib/openfoam/openfoam2512/platforms/linux64GccDPInt32Opt/bin/` ;
- `blockMesh` et `checkMesh` disponibles ;
- compilateur GCC/G++ 13 ;
- bibliothèque `libreactingTwoPhaseSystem.so` fournie par OpenFOAM ;
- CoolProp Python `7.2.0` ;
- CoolProp natif `libCoolProp.so.7.2.0`, compilé depuis la source taguée `v7.2.0` avec ses sous-modules.

L’adaptateur du dépôt `liblh2CoolPropThermo.so` a été compilé contre OpenFOAM v2512 et CoolProp natif. Ses empreintes et ses dépendances sont conservées dans le journal d’environnement et dans les sorties locales du run.

## Ordre des opérations réellement exécutées

1. Lecture du contrat LH₂, des critères d’acceptation et des règles interdisant toute promotion automatique des gates.
2. Installation du dépôt OpenCFD officiel signé et du paquet `openfoam2512-default`.
3. Vérification du package, de la version, du chemin du solveur, du compilateur et de l’aide du solveur.
4. Création d’un environnement Python isolé et installation de CoolProp `7.2.0`.
5. Test indépendant de l’inversion `T(P,H)` de CoolProp pour le parahydrogène liquide et vapeur à `p=125310 Pa`, `T=21.01 K`.
6. Compilation de CoolProp natif `libCoolProp.so` depuis la source officielle taguée `v7.2.0`.
7. Compilation de `liblh2CoolPropThermo.so` avec `wmake libso` sous OpenFOAM v2512.
8. Premier lancement réel du baseline : arrêt initial dû à l’absence de la bibliothèque d’adaptateur et à la combinaison thermo non chargée.
9. Correction du chemin natif CoolProp et chargement effectif de `coolPropThermo` pour les deux phases.
10. Détection du manque de `0/h.gas` et `0/h.liquid` dans le baseline ; restauration à partir des champs enthalpie versionnés du kit independent, avec conservation de leurs hashes.
11. Second lancement réel : le solveur charge l’adaptateur, atteint `Time = 0.00011999`, puis ferme le run sur `T outside phase window`.

## Cause bloquante actuelle

La fermeture actuelle mélange l’inversion d’enthalpie CoolProp et l’équation d’état tabulée `icoTabulated`. L’adaptateur refuse correctement de borner silencieusement une température de `147.005 K` dans une fenêtre LH₂ proche de `21 K`. Cette détection est un comportement fail-closed ; elle ne doit pas être remplacée par un clamp.

La correction scientifique suivante doit traiter l’incompatibilité entre la définition d’enthalpie utilisée par OpenFOAM, la phase sélectionnée, la pression absolue et la fermeture `T(p,h)`. Elle doit être testée sur une grille sous-refroidie, saturée et vapeur, avec round-trip et bilans avant toute reprise du baseline.

## État des gates

| Gate | État | Justification |
|---|---|---|
| G3 | `INCONCLUSIVE` | Le baseline réel s’arrête avant une trajectoire convergée et ne fournit pas les résidus/bilans contractuels complets. |
| G4 | `INCONCLUSIVE` | Aucun entraînement V8 accepté exclusivement sur un baseline convergé. |
| G5 | `INCONCLUSIVE` | Aucune évaluation held-out indépendante avec métriques dans les tolérances gelées. |
| G6 | `INCONCLUSIVE` | Aucune reproduction propre complète. |

La 3D ne sera considérée que comme une visualisation d’artefacts reliés à un run réel. Son affichage ne pourra pas transformer un run non convergé en validation scientifique.

## Fichiers et preuves

Le préflight et les rapports de décision restent conservateurs. Les logs complets du solveur et les sorties de compilation doivent rester associés à leur manifeste, à leur version de solveur, à leur configuration et à leurs empreintes SHA-256. Aucun score de crédibilité, niveau de certification ou statut `G3Eligible` ne doit être produit pour ce run.

## Réponse technique à Laurent

La réponse honnête est désormais : le solveur officiel v2512 est installé, CoolProp est installé et l’adaptateur est effectivement chargé. Le calcul réel a été lancé, mais il n’est pas convergé. Le projet a donc produit une preuve d’intégration et un diagnostic thermodynamique reproductible, pas encore une preuve CFD validée.
