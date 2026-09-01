# Correctif fraction vapeur et wall-boiling

## Modifications

Le champ `alpha.gas` est initialisé à `0.01` dans le volume, à l’entrée et à la sortie. Le champ `alpha.liquid` est initialisé à `0.99` dans les mêmes zones, de sorte que la somme des fractions est égale à un au démarrage.

Les deux conditions `alphatWallBoilingWallFunction` de `alphat.gas` et `alphat.liquid` ont été remplacées par `compressible::alphatPhaseChangeJayatillekeWallFunction` sur `wall2`. Cette modification évite le chemin de calcul qui déclenchait une division singulière dans la wall function wall-boiling avec une phase absente ou une fraction de film nulle.

## Vérification

Après chargement de `liblh2CoolPropThermo.so`, OpenFOAM affiche `alpha.gas volume fraction = 0.01` et ne s’arrête plus dans `alphatWallBoilingWallFunctionFvPatchScalarField::updateCoeffs()`.

Le calcul s’arrête encore pendant `Constructing face momentum equations` par une exception flottante dans `reactingTwoPhaseSystem`. La singularité restante n’est donc plus située dans la wall function wall-boiling. La trace disponible ne contient pas de symbole source exploitable ; il faut isoler ensuite les modèles d’interaction interfaciale, la pression de phase et les propriétés de transport.

## Interprétation scientifique

Le correctif stabilise l’initialisation numérique et élimine le premier diviseur nul lié à la wall function. Il ne constitue pas une validation du modèle d’ébullition. Le remplacement par la wall function phase-change est un mode de démarrage diagnostique ; pour une preuve de boil-off, il faudra réactiver un modèle wall-boiling compatible avec une fraction vapeur non nulle et vérifier le flux massique de changement de phase.

Le statut du pilote reste **INCONCLUSIVE** et aucun fichier produit par ce run interrompu ne peut être enregistré comme `CFD-BASELINE` ou `CFD-INDEPENDENT`.
