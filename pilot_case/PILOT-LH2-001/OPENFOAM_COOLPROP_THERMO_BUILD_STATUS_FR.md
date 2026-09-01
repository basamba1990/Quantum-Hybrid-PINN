# Type thermo OpenFOAM CoolProp — résultat de compilation et test runtime

## Compilation

Le type personnalisé `coolPropThermo` a été enregistré avec `makeThermos` pour la combinaison `heRhoThermo / pureMixture / const / coolPropThermo / icoTabulated / specie / sensibleEnthalpy`. La bibliothèque `liblh2CoolPropThermo.so` se compile avec OpenFOAM 2512 et se lie effectivement à `libCoolProp.so.8`.

La présence du type dans la sélection runtime a été vérifiée : OpenFOAM affiche la combinaison suivante avant de créer chaque phase :

```text
heRhoThermo  pureMixture  const  coolPropThermo  icoTabulated  specie  sensibleEnthalpy
```

Le solveur reconnaît donc le dictionnaire suivant :

```text
thermoType
{
    type            heRhoThermo;
    mixture         pureMixture;
    transport       const;
    thermo          coolPropThermo;
    equationOfState icoTabulated;
    specie          specie;
    energy          sensibleEnthalpy;
}
```

## Test runtime

`reactingTwoPhaseEulerFoam` charge la bibliothèque, sélectionne `coolPropThermo` pour le gaz et le liquide, construit le système diphasique et démarre la boucle de temps. Le test arrive à `Time = 0.00011999`.

L’arrêt observé est une exception flottante dans `alphatWallBoilingWallFunctionFvPatchScalarField::updateCoeffs()`, pendant une division par zéro liée au champ de fraction gazeuse initial. Ce n’est pas une erreur de chargement de CoolProp ni une erreur de compilation du type thermo. Le cas de test contient encore une configuration de paroi wall-boiling héritée du tutoriel et une fraction gaz initiale nulle ; il doit être régularisé avant une exécution physique.

## Limites restantes

Le type personnalisé appelle CoolProp HEOS `ParaHydrogen` pour les propriétés `p,T` et l’API native CoolProp a été validée indépendamment pour `p,h`. REFPROP n’est pas installé et aucune équivalence REFPROP ne peut être revendiquée.

L’intégration est compilée et chargée par OpenFOAM, mais la robustesse du cas diphasique LH2 exige encore : une condition initiale de fraction vapeur non nulle ou une paroi compatible avec `alpha.gas = 0`, une vérification des champs `alphat`, des conditions thermiques, des limites de la plage CoolProp et un test de conservation de masse et d’énergie.

Le statut scientifique reste **INCONCLUSIVE**. Aucune sortie interrompue ne doit être utilisée comme `CFD-BASELINE` ou `CFD-INDEPENDENT`.
