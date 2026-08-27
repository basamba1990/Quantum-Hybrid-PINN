# deep_mining_block — Onde de pression abstraite RD1

## Classification

Ce cas est un **benchmark synthétique non opérationnel** destiné à tester le rendu volumique CFD, l’animation transitoire, le transport d’un front de pression et la réflexion sur une limite idéalisée. Il ne représente pas une mine réelle, une explosion réelle, une détonation, une charge explosive, une procédure d’initiation ou une étude de sécurité.

Le sidecar utilise :

| Champ | Valeur |
|---|---|
| `eventType` | `PUBLIC_OVERPRESSURE_BENCHMARK` |
| `sourceProvenance` | NIOSH public document used for context only; no measured trace copied |
| `arrivalTime` | `0 s` |
| `peakOverpressure` | `250 Pa` bounded synthetic reference, not measured |
| `boundaryReflectionModel` | One-dimensional rigid-end acoustic reflection surrogate |
| `solverProduced` | `false` |
| Statut scientifique | `UNVALIDATED` |

## Modèle de propagation

Le champ de surpression est un pulse gaussien synthétique servant de benchmark de surpression publique se déplaçant dans la direction longitudinale :

\[
\Delta p_i(x,t)=\Delta p_{max}
\exp\left[-\left(\frac{x-x_0-c_at}{w}\right)^2\right].
\]

Une seconde contribution représente uniquement une réflexion numérique sur l’extrémité du domaine :

\[
\Delta p_r(x,t)=R\Delta p_{max}
\exp\left[-\left(\frac{x-(2L-x_0-c_at)}{w}\right)^2\right],
\]

avec `R = 0,65`. La pression stockée dans les VTU est :

\[
p(x,y,z,t)=p_0+\Delta p_i+\Delta p_r+\Delta p_{hydrostatique}.
\]

Les valeurs `c_a = 343 m/s`, `w = 4 m` et `Δpmax = 250 Pa` sont des paramètres de test numérique et ne sont pas des caractéristiques d’une explosion. Aucun modèle de combustion, de détonation, de charge, d’énergie libérée ou d’initiation n’est inclus.

## Frames et champs

Le kit contient huit frames à `t = 0, 0,1, ..., 0,7 s`. Chaque frame possède la même topologie tétraédrique : **5 456 sommets** et **22 500 cellules**. Les champs sont associés aux sommets, sauf `region_id`, associé aux cellules.

| Champ | Unité | Interprétation |
|---|---|---|
| `temperature` | K | Champ thermique synthétique |
| `pressure` | MPa | Pression absolue avec pulse abstrait |
| `velocity` | m/s | Champ de vitesse synthétique à trois composantes |
| `gas_concentration` | ppm | Indicateur synthétique de concentration gazeuse |
| `leak_indicator` | 1 | Indicateur de région source abstraite |
| `wavefront_indicator` | 1 | Indicateur normalisé du front acoustique |
| `region_id` | 1 | Région volumique de contrôle |

Le vérificateur confirme que les hashes SHA-256 concordent, que la connectivité est identique entre les frames, que les champs sont finis et que la pression ainsi que l’indicateur de front varient dans le temps.

## Conditions aux limites de test

La frontière `ventilation_inlet` est située à `x = 0 m`, et `ventilation_outlet` à `x = 120 m`. `gallery_walls` représente les limites latérales et verticales du volume de contrôle. `abstract_source_region` localise une région synthétique autour de `x = 88 m` pour tester le couplage entre indicateur de source et champ gazeux.

Ces ensembles ne constituent pas un plan de ventilation réel. Pour un calcul industriel, il faudrait une géométrie autorisée, les sections de galeries, les pertes singulières, les ventilateurs, les portes, les plans de ventilation et les mesures de terrain.

## Contrôles de non-opérationnalité

Le contrat refuse conceptuellement toute revendication de certification en maintenant `solverProduced=false`, des résidus `mass`, `momentum` et `energy` à `null`, et les preuves de solveur à `false`. Le kit ne contient volontairement aucun champ nommé `explosiveChargeMass`, `detonationEnergy`, `charge_mass` ou `initiationProcedure`.

La référence publique est utilisée uniquement pour le contexte terminologique et la provenance ; aucune valeur mesurée n’est recopiée dans le kit. Le rendu d’une onde visible ne prouve pas que l’onde est physiquement prédictive. Une preuve G0–G5 exigerait une sortie de solveur identifié, une équation d’état et un modèle compressible appropriés, une étude de convergence maillage/temps, des comparaisons de référence et, pour un cas réel, une validation de sécurité indépendante.

## Références de contexte

[1]: https://archive.cdc.gov/www_cdc_gov/niosh/mining/topics/ventilation.html "NIOSH Mining Topic: Ventilation Overview"
[2]: https://www.cdc.gov/niosh/engcontrols/ecd/detail159.html "NIOSH Guidelines for Control and Monitoring of Methane Gas"
[3]: https://www.ecfr.gov/current/title-30/chapter-I/subchapter-O/part-75/subpart-D "30 CFR Part 75 Subpart D — Ventilation"
[4]: https://stacks.cdc.gov/view/cdc/161327 "NIOSH Explosion Pressure Design Criteria for Seals — context only, not used to create an explosion model"

## Références

[1] [NIOSH — Ventilation Overview][1]  
[2] [NIOSH — Methane Control and Monitoring][2]  
[3] [eCFR — Ventilation Requirements][3]  
[4] [NIOSH — Explosion Pressure Design Criteria][4]
