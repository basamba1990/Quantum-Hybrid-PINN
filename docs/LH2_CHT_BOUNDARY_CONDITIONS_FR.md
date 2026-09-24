# Conditions aux limites CHT et changement de phase LH₂ dans OpenFOAM 12

## Réponse courte

Il n’existe pas de condition limite `evaporation` ou `condensation` à ajouter directement dans `chtMultiRegionFoam`. L’évaporation et la condensation sont des **termes sources interfacials** qui doivent être ajoutés dans le modèle multiphasique et être cohérents simultanément dans l’équation de fraction volumique, l’équation de masse et l’équation d’énergie.

Les conditions limites servent à imposer :

- l’imperméabilité et la vitesse à la paroi ;
- la pression relative ;
- la température couplée entre fluide et solide ;
- le flux thermique extérieur ;
- le comportement de `alpha` aux frontières ouvertes ou fermées.

## Limitation d’OpenFOAM 12

Dans OpenFOAM 12, `multiphaseInterFoam` est remplacé par le module `incompressibleMultiphaseVoF` exécuté par `foamRun`. Ce module VOF standard ne fournit pas, à lui seul, une fermeture thermique LH₂ avec `T_sat(p)`, `h_fg(p)`, `S_m,e`, `S_m,c` et les sources énergétiques associées.

Le tutoriel CHT `multiRegion/CHT/wallBoiling` utilise une autre architecture :

```foam
application foamMultiRun;
regionSolvers
{
    fluid multiphaseEuler;
    solid solid;
}
```

Il possède `thermalPhaseChangeMultiphaseSystem`, `saturationTemperature` et des modèles de transfert de phase, mais il s’agit d’un modèle Euler multiphasique, pas de la formulation VOF exacte de l’article LH₂.

Deux voies sont donc possibles :

| Voie | Configuration | Avantage | Limitation |
|---|---|---|---|
| VOF fidèle à l’article | `foamRun -solver incompressibleMultiphaseVoF` dans un solveur étendu | interface VOF et fraction volumique explicites | nécessite un module thermique de changement de phase personnalisé |
| CHT OpenFOAM native | `foamMultiRun` avec `multiphaseEuler` + `solid` | transfert de phase thermique déjà structuré | ce n’est pas le VOF de l’article |

## Conditions limites côté fluide

### Fraction volumique

Pour un réservoir fermé et une paroi imperméable, la fraction volumique ne reçoit pas de flux convectif à la paroi :

```foam
wall
{
    type zeroGradient;
}
```

Aux plans de symétrie axisymétriques :

```foam
front
{
    type wedge;
}
back
{
    type wedge;
}
```

À une entrée ou une sortie ouverte, il faut utiliser le flux de la phase correspondante et une valeur d’entrée cohérente :

```foam
inlet
{
    type fixedValue;
    value uniform 0.50;
}
outlet
{
    type inletOutlet;
    phi phi.liquid;
    inletValue uniform 0.50;
    value uniform 0.50;
}
```

Dans le réservoir fermé de l’article, il ne faut pas traiter la surface liquide-vapeur interne comme une patch géométrique. C’est une interface interne capturée par `alpha`; la source de phase doit être appliquée dans les cellules interfaciales.

### Vitesse et pression

À la paroi intérieure :

```foam
wall
{
    type noSlip;
}
```

Pour `p_rgh` à la paroi :

```foam
wall
{
    type fixedFluxPressure;
}
```

Cela ne crée ni évaporation ni condensation. Ces conditions expriment seulement une paroi sans pénétration et un flux de pression compatible avec l’équation de quantité de mouvement.

### Température au contact aluminium-LH₂

Pour une région fluide multiphasique avec température par phase, le tutoriel `wallBoiling` utilise :

```foam
wall
{
    type coupledMultiphaseTemperature;
    value $internalField;
}
```

Pour la température dans l’aluminium sur la face interne :

```foam
wall_inner
{
    type coupledTemperature;
    Tnbr T.liquid;
    value $internalField;
}
```

Si le modèle possède à la fois `T.liquid` et `T.gas`, la fermeture doit préciser comment la température de paroi est reliée aux deux phases. Il ne faut pas inventer une deuxième condition indépendante qui casserait le bilan de flux.

### Température et flux sur l’extérieur du PU

Pour reproduire la condition atmosphérique de l’article, une condition de flux extérieur peut être représentée par :

```foam
wall_outer
{
    type externalTemperature;
    q uniform 0;
    value $internalField;
}
```

Pour une condition convective dépendant du vent, il faut utiliser une condition de flux convectif disponible dans l’installation ou une condition personnalisée qui impose :

```text
q_wall = h_conv (T_infinity - T_wall)
```

avec `T_infinity = 283.15 K`, vitesse extérieure `2 m/s`, corrélation de Nusselt documentée et signe vérifié par un test de flux. Ne pas remplacer ce flux par un `fixedValue` arbitraire si l’objectif est de reproduire l’article.

## Où placer l’évaporation et la condensation

Les sources publiées par Jeong et al. sont de la forme :

```text
Nu       = 2 + 0.6 Re^(1/2) Pr^(1/3)
A_i'''   = 6 alpha_d / D_d
S_m,e    = C_evap C_A (k_l/D_d) A_i''' Nu (T_l - T_sat(p))/h_fg(p)
S_m,c    = C_cond C_A (k_l/D_d) A_i''' Nu (T_v - T_sat(p))/h_fg(p)
```

avec activation conditionnelle :

```text
S_m,e > 0 uniquement si T_l >= T_sat(p)
S_m,c > 0 uniquement si T_v >= T_sat(p)
```

La mise en œuvre correcte doit appliquer les mêmes termes dans trois endroits cohérents :

1. fraction volumique : conversion liquide-vapeur ;
2. masse/continuité : `+S_m,c-S_m,e` ;
3. énergie : `S_q,e` et `S_q,c`, avec `S_q = S_m h_fg` et le signe opposé à la phase qui perd son énergie.

Un simple `fvModel` source sur `T` ne suffit pas : il violerait le bilan de masse et rendrait `alpha` incohérent. Un `codedSource` générique n’est acceptable que si le code modifie aussi le transport d’alpha, la masse, l’énergie et la correction de pression de manière conservative. Pour une étude de publication, il faut plutôt créer un module de solveur dédié.

## Architecture recommandée pour ce projet

### Option A — solveur VOF thermique personnalisé

Partir du module `incompressibleMultiphaseVoF` et ajouter un modèle `lh2RanzMarshallPhaseChange` qui :

- lit une fonction `T_sat(p)` tabulée ;
- lit ou calcule `h_fg(p)` ;
- calcule `Re`, `Pr`, `Nu` et `A_i'''` ;
- limite les sources avec `max(0, T-T_sat)` ;
- applique les sources dans alpha, masse et énergie ;
- écrit `mDotEvap`, `mDotCond`, `qEvap`, `qCond` pour vérification ;
- impose la conservation globale de masse et d’énergie à chaque pas.

Le `controlDict` du cas VOF devrait alors appeler le module personnalisé, par exemple :

```foam
application foamMultiRun;
regionSolvers
{
    LH2             lh2ThermalMultiphaseVoF;
    aluminium2219   solid;
    polyurethane10mm solid;
}
```

Le nom ci-dessus est un nom de projet à compiler ; il n’existe pas dans l’installation stock tant que le module n’a pas été développé et compilé.

### Option B — solveur Euler thermique natif

Pour obtenir rapidement une preuve OpenFOAM de transfert de phase, adapter le tutoriel `multiRegion/CHT/wallBoiling` :

```foam
application foamMultiRun;
regionSolvers
{
    LH2             multiphaseEuler;
    aluminium2219   solid;
    polyurethane10mm solid;
}
```

Dans `constant/LH2/phaseProperties`, utiliser `thermalPhaseChangeMultiphaseSystem`, `saturationTemperature` sous forme de table et les modèles thermiques disponibles. Cette voie doit être étiquetée **Euler multiphasique**, et non VOF.

## Vérifications obligatoires

Avant de déclarer un cas valide :

```text
1. alpha reste borné dans [0,1] ;
2. mDotEvap et mDotCond ont le signe attendu ;
3. la masse totale liquide+vapeur ferme ;
4. le terme latent compense la variation d’enthalpie ;
5. le flux sur aluminium-LH₂ est égal au flux entrant dans le solide ;
6. le flux extérieur correspond à h_conv(T_inf-T_wall) ;
7. la pression augmente avec le boil-off dans le cas fermé ;
8. le résultat converge avec le maillage et le pas de temps.
```

Tant que ces contrôles ne sont pas produits par un solveur VOF étendu, le statut reste `THERMAL_LH2_VOF_CHT_NOT_VALIDATED`.
