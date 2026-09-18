# Cause racine de `T=147.005 K` dans le baseline LH₂

## Conclusion

La valeur anormale `T=147.005 K` ne provient pas de CoolProp, de l’inversion `T(P,H)`, ni d’un facteur d’unité de l’enthalpie. Elle est créée par la condition limite thermique `fixedMultiPhaseHeatFlux` appliquée à `wall2` dans `0/T.liquid`.

Le cas définit :

```text
wall2
{
    type            fixedMultiPhaseHeatFlux;
    relax           0.5;
    q               uniform 100;
    phase           liquid;
    value           uniform 21.01;
}
```

Dans OpenFOAM 2512, le constructeur de `fixedMultiPhaseHeatFluxFvPatchScalarField` fixe par défaut :

```cpp
Tmin_(dict.getOrDefault<scalar>("Tmin", 273))
```

Sa mise à jour est :

```cpp
operator==((scalar(1) - relax_)*Tp + relax_*max(Tmin_, (q_ + A)/(B)));
```

Au premier appel, la température actuelle de paroi est `Tp=21.01 K`. Comme la valeur issue du flux est inférieure au plancher par défaut `Tmin=273 K`, la nouvelle température est exactement :

\[
T_{wall}^{n+1}=(1-0.5)\times21.01+0.5\times273
=147.005\;K.
\]

Cette valeur correspond exactement à celle observée dans l’erreur :

```text
T outside phase window at p=125310 Pa: T=147.005 K
```

## Chemin d’exécution démontré

Le chemin source est le suivant :

1. `reactingTwoPhaseEulerFoam/EEqns.H` assemble l’équation d’énergie de chaque phase avec `phase.heEqn()` et la table retournée par `fluid.heatTransfer()`.
2. `ThermalPhaseChangePhaseSystem::heatTransfer()` ajoute les termes liés au changement de phase et à la chaleur latente.
3. `OneResistanceHeatTransferPhaseSystem::heatTransfer()` assemble les échanges interphases avec les termes `K`, `K/Cpv` et `dmdt*he`.
4. Avant et pendant la résolution thermique, la condition `fixedMultiPhaseHeatFlux` met à jour la température de `wall2` à partir de `q`, `A`, `B`, `relax` et `Tmin`.
5. `heRhoThermo` reconstruit l’enthalpie de frontière via `mixture_.HE(p,T)`.
6. `coolPropThermo::Hs/Ha` appelle `phaseProperty("H",p,T)`.
7. `phaseProperty` appelle `safeT(p,T)`.
8. `safeT` refuse `147.005 K`, car la phase liquide est limitée autour de `Tsat=21.010 K`, avec la fenêtre observée `[15.0100593,21.0300593] K`.

La trace compilée avec un identifiant d’appel a confirmé que l’échec se produit sur :

```text
caller=H
```

Cela signifie que `phaseProperty("H",p,T)` reçoit `T=147.005 K`. Cette observation est cohérente avec le chemin `fixedMultiPhaseHeatFlux -> température de paroi -> HE/Hs -> phaseProperty("H")`.

## Ce qui a été exclu

Les contrôles CoolProp indépendants ont donné :

| État | `p` | `h` | `T(P,H)` |
|---|---:|---:|---:|
| Liquide saturé | 125310 Pa | 7573.92519 J/kg | 21.0099982 K |
| Vapeur saturée | 125310 Pa | 449885.564 J/kg | 21.0100593 K |

Ces résultats excluent :

- une erreur de conversion J/kg versus J/kmol ;
- une incohérence initiale `T(P,H)` ;
- un défaut de monotonicité de l’enthalpie initiale ;
- une génération de 147 K par l’appel CoolProp lui-même ;
- un clamp silencieux dans `safeT`.

## Interaction avec `icoTabulated`

`icoTabulated` n’est pas la source immédiate de la valeur 147 K. Il intervient ensuite dans la densité et la compressibilité de la phase, tandis que `coolPropThermo` fournit les propriétés thermiques CoolProp. La combinaison reste néanmoins à revalider après correction de la condition limite, car elle couple une densité tabulée de saturation avec des propriétés thermiques CoolProp dépendant de la phase.

La règle conservatrice est donc : ne pas déclarer le baseline convergé sur la seule correction de `Tmin`; il faut refaire les tests thermo, le run, les résidus et les bilans.

## Correction recommandée

Pour ce cas LH₂ saturé, deux stratégies sont possibles :

### Stratégie A — cas strictement saturé

Remplacer la condition de flux imposée par une condition compatible avec la température de saturation, ou mettre explicitement un `Tmin` physique proche de la température de saturation et documenter que le flux de 100 W/m² ne peut pas produire une température liquide hors fenêtre.

### Stratégie B — modèle sous-refroidi/surchauffé réel

Élargir le modèle thermodynamique et les fenêtres CoolProp pour autoriser les états sous-refroidis et vapeur hors saturation. Cette option exige de remplacer l’utilisation systématique de `PropsSI(...,"T",T,"Q",phaseQuality,...)` par des requêtes `P,T` lorsque l’état n’est plus strictement saturé, ainsi que de redéfinir les données de transport et de densité hors ligne de saturation.

La stratégie B est une modification scientifique majeure et ne doit pas être remplacée par un simple élargissement numérique de `safeT`.

## Statut des gates

Cette analyse identifie la cause racine de l’échec, mais ne constitue pas une preuve de convergence. Les gates CFD-INDEPENDENT, entraînement V8, évaluation indépendante et G3/G4/G5 restent fermés jusqu’à :

1. correction versionnée de la condition limite ;
2. test thermo complet sans clamp silencieux ;
3. exécution du baseline depuis zéro ;
4. résidus et bilans masse-énergie ;
5. reproduction indépendante ;
6. seulement ensuite CFD-INDEPENDENT et V8.

## Relances après correction wall2 — 18 septembre 2026

La première correction appliquée à `0.orig/T.liquid` remplace `fixedMultiPhaseHeatFlux` par :

```text
type fixedValue;
value uniform 21.01;
```

La valeur `21.01 K` est cohérente avec la température de saturation initiale à `p=125310 Pa`. Le premier run corrigé confirme que l’erreur initiale `T=147.005 K` disparaît : le log atteint `Tf.gasAndLiquid=21.01 K`, résout `h.gas` et `h.liquid`, puis poursuit jusqu’à la seconde itération PIMPLE.

Le gaz était initialement copié depuis le liquide (`copiedFixedValue`), ce qui imposait `21.01 K` alors que la pression locale montait à `127206 Pa`. À cette pression, la fenêtre gaz commence à `21.04398 K`. La condition gaz a donc été rendue explicite à `21.10 K`, et `h.gas` a été recalculée par CoolProp à `450995.069846 J/kg` pour l’état `P=125310 Pa, T=21.10 K`.

Malgré cette correction, le run reste bloqué à la seconde itération :

```text
T outside phase window at p=127206.108 Pa:
T=21.01 K, expected [21.0439764, 27.0639764] K, phaseQuality=1
```

La température fautive n’est donc plus la température murale 147 K. Elle est reconstruite dans le champ gaz au cours du couplage énergie/interphase, alors que `Tf` reste proche de `21.01 K`. Cela démontre un conflit persistant entre :

- la pression variable du cas ;
- l’état vapeur défini par `phaseQuality=1` ;
- le transfert interphase et la température d’interface ;
- l’inversion `P,H` stricte et fail-closed de CoolProp.

Le statut scientifique après ces relances est : **wall2 corrigé, erreur 147 K éliminée, baseline toujours non convergé et non opérationnel**. La prochaine correction doit traiter le couplage gaz `P,H`/phase-change, et non élargir silencieusement la fenêtre `safeT`.
