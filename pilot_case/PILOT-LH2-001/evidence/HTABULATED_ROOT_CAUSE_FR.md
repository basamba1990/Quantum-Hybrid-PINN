# Diagnostic hTabulatedThermo — cause racine

La documentation OpenFOAM v2512 décrit `hTabulated` comme une table de `Cp(T)` en J/kg/K. Le code `integratedNonUniformTable` construit l’intégrale en ancrant la table à `Tstd`, puis la classe `hTabulatedThermo` calcule `Hs = Cp_.intfdT(p,T) + EquationOfState::H(p,T)`.

Dans le cas LH2, les tables Cp s’arrêtent à 32.510 K alors que `Tstd` est environ 298.15 K. Le code OpenFOAM indique explicitement que `hTabulatedThermo::limit()` n’applique actuellement aucune limite ; l’évaluation hors table est donc une extrapolation linéaire du dernier segment. Avec les Cp croissants près du point critique, cette extrapolation génère un décalage d’environ -2.74e5 J/kg pour le liquide et -3.41e5 J/kg pour le gaz à 21.01 K, avec une pente extrapolée non physique hors du domaine LH2.

L’arrêt observé (`f=-273086571`, `p=127197.092`, Newton 100 itérations) est cohérent avec une cible d’enthalpie devenue incompatible avec la table et/ou avec l’extrapolation hors domaine. Le correctif prioritaire est de ne pas utiliser `hTabulated` pour couvrir le diphasique LH2 : soit fournir une thermodynamique EOS/enthalpie cohérente CoolProp/REFPROP avec inversion bornée, soit étendre et ancrer une table validée sur tout le domaine réellement parcouru, avec contrôle explicite des bornes. Augmenter seulement `maxIter_` ou modifier la tolérance ne constitue pas un correctif physique.

Références publiques :
- https://api.openfoam.com/2512/classFoam_1_1hTabulatedThermo.html
- https://doc.openfoam.com/2306/tools/processing/models/thermophysical/thermodynamics/rtm/hTabulated/
