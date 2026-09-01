# État de compilation OpenFOAM — 2026-09-01

Le build complet de `reactingMultiphaseSystem` est exécuté dans le conteneur persistant `openfoam-lh2-build` basé sur `opencfd/openfoam-default:2512`. Le source `alphatPhaseChangeJayatillekeWallFunctionFvPatchScalarField.C` contient effectivement la protection `PratSafe(max(Prat, scalar(1e-8)))` avant `pow()`.

Le journal est `wmake_persistent.log` à la racine du dépôt. Au dernier contrôle, 131 objets C++ avaient été compilés et le processus `wmake libso` était encore actif dans la phase `derivedFvPatchFields/wallBoilingSubModels`. Aucun message `error:`, `undefined reference` ou `Killed` n’a été observé. La bibliothèque `libreactingMultiphaseSystem_patched.so` n’est pas encore produite ; aucune exécution CFD ne doit donc être déclarée comme test du patch avant sa création et son chargement vérifié.

La précédente tentative avec `docker run --rm` a été abandonnée comme non reproductible, car les objets intermédiaires étaient supprimés à la fin du conteneur. Cette limitation est corrigée par le conteneur persistant.
