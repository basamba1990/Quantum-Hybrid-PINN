# Reprise OpenFOAM LH2 — 2026-09-02

## Résultats reproductibles

La bibliothèque `reactingMultiphaseSystem` patchée a été restaurée dans le conteneur persistant `openfoam-lh2-build`. L’adaptateur `coolPropThermo` a été recompilé avec succès (`COOLPROP_BOUNDED_WMAKE_EXIT=0`) après ajout d’un calcul CoolProp de `psi = d rho/d p|T`, l’implémentation héritée d’`icoTabulated` étant nulle et provoquant une division par zéro.

Le cas charge bien `coolPropThermo` pour les deux phases et atteint le premier pas `Time = 0.00011999`. La FPE de `Psmooth()` n’est plus observée. Des bornes `13.8033 <= T <= 32.50 K` et des planchers positifs ont été ajoutés à l’adaptateur pour empêcher l’inversion Newton d’interroger des états hors domaine LH2.

## Nouvelle cause bloquante

Avec `phaseChange on`, les diagnostics OpenFOAM signalent immédiatement :

```text
Tf.gasAndLiquid: min = -nan, mean = -nan, max = -nan
iDmdt.gasAndLiquid: min = -nan, mean = -nan, max = -nan
```

Ces NaN apparaissent après la résolution de `alpha.gas`, pendant la correction thermo interfaciale, avant l’assemblage stable du momentum. Avec `phaseChange off`, `Tf.gasAndLiquid` reste fini autour de 21.01 K et les équations d’enthalpie se résolvent au premier correcteur ; le système de pression devient ensuite NaN. Le changement de phase est donc une source confirmée des NaN interfacials, mais un contrôle complémentaire de la pression/coefficient `psi` est encore requis.

## Interprétation scientifique

Le problème `hTabulatedThermo` initial était réel : la table `Cp(T)` s’arrêtait à 32.51 K alors que la référence d’intégration OpenFOAM est proche de 298.15 K ; l’extrapolation produit un décalage enthalpique non physique. Le passage à CoolProp supprime cette extrapolation, mais l’adaptateur actuel reste un prototype : il réutilise `icoTabulated` comme classe EOS de base et doit encore remplacer proprement toutes les méthodes EOS et la loi de changement de phase par une formulation cohérente avec les propriétés de saturation parahydrogène.

## Jeux de données et PINN-T

Aucun fichier `CFD-BASELINE` ou `CFD-INDEPENDENT` de validation n’est déclaré ni produit à cette étape. Les deux exécutions ne sont pas convergées ; produire des données à partir de ces sorties interrompues créerait une référence synthétique ou contaminée et violerait les critères approuvés. L’entraînement et l’évaluation held-out du PINN-T sont donc volontairement bloqués jusqu’à l’obtention de deux trajectoires CFD convergées et indépendantes.

Statut scientifique : **INCONCLUSIVE**.
