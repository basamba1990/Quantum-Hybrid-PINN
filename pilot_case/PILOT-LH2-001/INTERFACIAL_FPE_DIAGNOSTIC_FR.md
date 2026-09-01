# Diagnostic FPE — reactingTwoPhaseSystem et interactions LH2

## Reproduction

Le cas charge correctement `liblh2CoolPropThermo.so`, sélectionne `coolPropThermo` pour les deux phases et démarre `reactingTwoPhaseEulerFoam`. Avec `alpha.gas = 0.01` et `alpha.liquid = 0.99`, la première division par zéro de `alphatWallBoilingWallFunction` est éliminée.

Le calcul atteint `Time = 0.00011999`, résout la fraction `alpha.gas` avec `Min = Max = 0.01`, puis s’arrête pendant `Constructing face momentum equations` par une FPE dans `reactingTwoPhaseSystem`. Une tentative en turbulence laminaire reproduit la même FPE ; le modèle RAS n’est donc pas la cause principale.

## Coefficients inspectés

| Bloc | Configuration actuelle | Risque immédiat observé |
|---|---|---|
| Fraction résiduelle gaz/liquide | `residualAlpha = 1e-4` | Non nul, mais inférieur aux seuils d’interaction `1e-3` |
| Diamètre gaz/liquide | `d = 4.5e-4 m` | Non nul |
| Traînée | `SchillerNaumann`, `residualRe = 1e-3` | Pas de zéro explicite |
| Masse virtuelle | `constantCoefficient`, `Cvm = 0.5` | Coefficient non nul |
| Transfert thermique gaz | `spherical`, `residualAlpha = 1e-3` | Non nul |
| Transfert thermique liquide | `RanzMarshall`, `residualAlpha = 1e-3` | Non nul |
| Dispersion turbulente | `Burns`, `sigma = 0.7`, `Ctd = 1.0`, `residualAlpha = 1e-3` | Non nul |
| Pression minimale | `pMin = 10000 Pa` | Compatible avec le point de référence ~125 kPa |
| Saturation | `function1`, table NIST, `outOfBounds clamp` | À contrôler hors plage, mais pas un diviseur nul direct |

## Interprétation

La FPE n’est plus produite par l’absence de vapeur ni par la wall function wall-boiling. Le fait qu’elle subsiste avec turbulence laminaire exclut le modèle RAS comme cause primaire. Les candidats restants sont l’assemblage momentum de `reactingTwoPhaseSystem`, une grandeur thermo non finie/non positive retournée par le type personnalisé dans le chemin `rho(p,T)`, ou un modèle interfacial recevant une combinaison de fraction/pression/diamètre non compatible avec l’état initial.

Le type personnalisé a été enregistré sous la sélection runtime, mais la classe actuelle conserve `icoTabulated` comme classe d’équation d’état de base et redéfinit seulement certaines méthodes. Cette combinaison peut laisser des appels internes utiliser les données tabulées ou les dérivées de `icoTabulated` au lieu d’appeler CoolProp. Il s’agit d’un point de vigilance prioritaire avant d’ajuster arbitrairement les coefficients interfacials.

## Conclusion

Aucun coefficient du dictionnaire `phaseProperties` n’est explicitement nul dans les blocs principaux inspectés. Il serait incorrect de conclure que la FPE est résolue par une simple augmentation de `residualAlpha`. La prochaine expérience contrôlée doit isoler successivement la traînée, la masse virtuelle, le transfert thermique et la dispersion, puis journaliser `rho`, `p`, `T`, `alpha`, `d` et les coefficients interfacials avant l’assemblage momentum.

Le statut reste **INCONCLUSIVE** et aucun run interrompu ne doit être enregistré comme baseline ou indépendant.
