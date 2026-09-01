# Diagnostic d’exécution OpenFOAM LH2 diphasique

## Résultat

Docker et OpenFOAM 2512 fonctionnent dans l’environnement. Le cas OpenFOAM officiel `reactingTwoPhaseEulerFoam/RAS/wallBoiling` a été copié comme base et configuré avec les données de saturation du parahydrogène extraites du NIST Chemistry WebBook pour l’identifiant `B5000001`.

La configuration comprend une table `Tsat_parahydrogen_NIST.csv` en Pa/K, les propriétés de densité, Cp, viscosité et conductivité liquide/vapeur dans `thermophysicalProperties.liquid` et `thermophysicalProperties.gas`, une masse molaire H2 de 2,01588, un état initial à 21,01 K et 125310 Pa, et une source de chaleur de paroi de 100 W/m².

## Échec observé

Le solver `reactingTwoPhaseEulerFoam` a démarré et a lu le modèle de saturation et les dictionnaires thermo. Il a créé le maillage et a commencé la boucle temporelle. La première étape a calculé `Tf.gasAndLiquid` et les termes de transfert de masse. Le calcul a ensuite dépassé le délai opérationnel ; le log partiel montre une inversion enthalpie–température instable avec des températures hors de la plage tabulée et une erreur de non-convergence de la fonction thermo.

Le premier message `Cannot open file "2/T.liquid"` provient de la commande `Allrun` qui tente d’inspecter un temps intermédiaire absent avant de relancer le solver ; ce n’est pas la cause principale de l’arrêt. La cause principale est l’incompatibilité entre la table `hTabulated/icoTabulated` utilisée comme approximation de saturation et le modèle thermo diphasique compressible requis pour un calcul LH2 avec changement de phase.

## Interprétation scientifique

`icoTabulated` est une équation d’état incompressible : elle interpole la densité en fonction de la température et ne représente pas la dépendance complète densité–pression d’une EOS NIST/REFPROP. Les propriétés NIST de saturation sont traçables, mais leur insertion dans `hTabulated/icoTabulated` ne constitue pas encore une interface EOS NIST/REFPROP complète. Les sorties partielles ne doivent donc pas être nommées `CFD-BASELINE` ou `CFD-INDEPENDENT` et ne peuvent pas servir à franchir les gates de validation.

## Étape requise

Il faut remplacer cette approximation par une loi thermo personnalisée ou une interface vérifiée vers REFPROP/CoolProp, avec inversion cohérente de l’énergie, de la pression et de la température dans les deux phases, puis refaire un dry-run et une exécution courte. Après stabilisation, deux cas distincts devront être générés avec journaux, résidus, bilans de masse/énergie, fraction vapeur et débit de boil-off.

Le statut du pilote reste **INCONCLUSIVE**.

## Références

[1]: https://webbook.nist.gov/cgi/fluid.cgi?ID=B5000001&Action=Page "NIST Chemistry WebBook — Parahydrogen fluid properties"

[2]: https://www.openfoam.com/documentation/user-guide/a-reference/a.1-standard-solvers "OpenFOAM — Standard solvers"

[3]: https://hub.docker.com/r/opencfd/openfoam-default "OpenCFD OpenFOAM Docker image"
