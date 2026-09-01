# Intégration CoolProp/REFPROP — état technique

## Ce qui est implémenté

CoolProp a été construit depuis sa source en bibliothèque partagée native (`libCoolProp.so`) et un adaptateur C++ LH2 a été créé dans `tools/lh2_coolprop_adapter.cpp`. Il expose les propriétés `T`, `rho`, `u`, `Cp`, viscosité, conductivité, qualité, température de saturation et pression de saturation à partir de couples `p,h` ou `T,Q` pour `ParaHydrogen`.

Le probe natif retourne, à 21,01 K et environ 125308 Pa, une densité liquide de 69,9648 kg/m³, une densité vapeur de 1,62291 kg/m³, une énergie interne liquide d’environ 5782,91 J/kg et une énergie interne vapeur d’environ 372674 J/kg. Le test de round-trip p–h renvoie correctement une qualité proche de 0 pour le liquide, 1 pour la vapeur et 0,5 pour l’état intermédiaire.

## Ce qui n’est pas encore équivalent à REFPROP

Le backend REFPROP n’est pas disponible dans l’environnement : CoolProp signale l’absence de `librefprop.so`. L’implémentation active utilise donc le backend HEOS de CoolProp avec le fluide `ParaHydrogen`. Cette voie est open source et reproductible, mais elle ne doit pas être appelée « REFPROP ».

Le solveur OpenFOAM 2512 n’est pas encore lié à cet adaptateur. Les types thermo standard `hTabulated` et `icoTabulated` ne peuvent pas déléguer automatiquement leur inversion enthalpie–température à cette bibliothèque. Le dictionnaire tabulé précédemment créé reste une approximation de transition ; il ne faut pas le présenter comme une EOS CoolProp complète.

## Étape d’intégration OpenFOAM requise

Pour obtenir une interface thermo complète, il faut compiler une extension OpenFOAM qui appelle l’adaptateur dans les méthodes `rho(p,T)`, `he(p,T)`, `T(p,he)`, `Cp(p,T)` et les propriétés de transport, puis l’enregistrer dans les `thermoPhysicsTypes` utilisés par le solveur diphasique. Cette extension doit aussi définir le comportement dans la zone diphasique, notamment la qualité, la pression de saturation et les dérivées nécessaires au Jacobien thermo.

L’adaptateur natif est donc une brique fonctionnelle vérifiée, mais l’intégration complète dans le cycle thermo de `reactingTwoPhaseEulerFoam` reste à compiler et à tester. Le statut scientifique du pilote demeure **INCONCLUSIVE**.

## Reproductibilité

Le build CoolProp est basé sur le dépôt public CoolProp et ses en-têtes C exportés. Le wrapper est compilé avec `-DEXTERNC`, car le header CoolProp doit déclarer les fonctions C (`PropsSI`, `get_global_param_string`) pour résoudre les symboles exportés par `libCoolProp.so`. Les sources et le test de round-trip sont versionnés dans le dépôt.

## Références

[1]: https://github.com/CoolProp/CoolProp "CoolProp — dépôt source public"

[2]: https://coolprop.org/coolprop/HighLevelAPI.html "CoolProp — High-Level API"

[3]: https://webbook.nist.gov/cgi/fluid.cgi?ID=B5000001&Action=Page "NIST Chemistry WebBook — propriétés du parahydrogène"

[4]: https://www.openfoam.com/documentation/user-guide/a-reference/a.1-standard-solvers "OpenFOAM — solveurs standard"
