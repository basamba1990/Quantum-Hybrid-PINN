# Run réel OpenFOAM 2512 — 2026-09-15

Ce dossier contient les preuves du run réel du cas `CFD-BASELINE` avec `reactingTwoPhaseEulerFoam`, OpenFOAM 2512, CoolProp 7.2.0 et `liblh2CoolPropThermo.so`.

Le runner et l’extension thermo ont été chargés avec succès. `Tf.gasAndLiquid` et `iDmdt.gasAndLiquid` restent finis pendant plusieurs itérations. Le run n’est toutefois pas convergé : OpenFOAM termine sur `Maximum number of iterations exceeded` dans l’inversion enthalpie-température après l’activation du limiteur physique.

Aucun statut G3/G4/G5 n’est attribué dans ce dossier. Les fichiers sont conservés pour audit et reproduction du blocage restant.

## Provenance

- Solveur : `reactingTwoPhaseEulerFoam`
- Version : OpenFOAM 2512
- Fluide : ParaHydrogen via CoolProp 7.2.0
- Cas : `CFD-BASELINE`
- Champs natifs attendus : `alpha_liquid`, `enthalpy`
- `phaseFieldsDerived` : `false` pour les sorties natives V8 ; aucune preuve de convergence CFD n’est revendiquée.
