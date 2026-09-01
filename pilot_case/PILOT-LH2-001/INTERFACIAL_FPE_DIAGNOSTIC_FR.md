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

## Test instrumenté détaillé

Le test contrôlé a été exécuté avec `fieldMinMax` à `t=0` et une journalisation des dictionnaires interfacials avant le démarrage. Le solveur conserve `alpha.gas = 0,01`, puis avance jusqu’à `Time = 0,00011999`. À l’itération suivante, il résout encore la fraction gazeuse dans l’intervalle `0,0099998742–0,0100000002`, puis s’arrête dans :

```text
alphatPhaseChangeJayatillekeWallFunctionFvPatchScalarField::Psmooth
return 9.24*(pow(Prat, 0.75) - 1)*(1 + 0.28*exp(-0.007*Prat));
```

La FPE vient donc de `pow(Prat, 0.75)` avec un `Prat` non positif ou non fini. Dans OpenFOAM 2512, `Prat = (muw/alphaw)/Prt`; le chemin fautif est appelé par `correctEnergyTransport()` avant/après l’assemblage momentum de la phase. Le passage en turbulence laminaire n’élimine pas le problème, car la wall function est encore évaluée dans le transport énergétique.

Les diagnostics montrent également `Tf.gasAndLiquid` compris entre 21,0100 et 21,0613 K et un transfert de masse interfacial initial non nul mais faible, jusqu’à `1,8560e-6` dans le premier cycle. La fraction gazeuse n’est donc plus le diviseur nul. Le candidat prioritaire est une diffusivité thermique de paroi `alphaw` nulle, négative ou non cohérente avec le transport `const` utilisé dans le cas temporaire ; le dictionnaire constTransport avait été régularisé avec des scalaires, mais la wall function Jayatilleke reste inadaptée sans garde explicite sur `Prat`.

La correction robuste ne consiste pas à modifier arbitrairement `Cvm`, Schiller–Naumann ou Burns. Il faut soit fournir un transport cryogénique positif cohérent avec CoolProp et une wall function bornant `Prat` à une valeur strictement positive, soit désactiver la wall function Jayatilleke pour un test thermo de base et utiliser une condition `fixedValue`/`zeroGradient` explicitement documentée. Pour un modèle de boil-off validé, il faudra ensuite une wall function cryogénique dédiée qui conserve le flux de changement de phase tout en protégeant les arguments des fonctions fractionnelles.

Le test est un diagnostic réussi, pas une exécution CFD validée. Le statut reste **INCONCLUSIVE**.

## Paramètres interfacials journalisés

Les valeurs de dictionnaire observées sont : `d = 4,5e-4 m`, `residualAlpha = 1e-4` dans les phases, `SchillerNaumann` avec `residualRe = 1e-3`, `Cvm = 0,5`, transfert thermique `spherical`/`RanzMarshall` avec `residualAlpha = 1e-3`, dispersion `Burns` avec `sigma = 0,7`, `Ctd = 1,0`, et `pMin = 10000 Pa`. Aucun de ces coefficients n’est explicitement nul.
