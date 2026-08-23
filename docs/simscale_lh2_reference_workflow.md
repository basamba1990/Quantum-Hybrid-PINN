# Workflow SimScale + Onshape pour un cas LH2 de référence

## Statut scientifique du workflow

Ce workflow produit un **cas CFD de référence reproductible** si une géométrie autorisée et un calcul SimScale terminé sont conservés. Il ne transforme pas automatiquement le modèle en réservoir industriel réel et ne constitue pas une certification G0–G5.

La documentation officielle de SimScale décrit son analyse multiphasique comme un calcul temporel VOF de deux fluides incompressibles, isothermes et immiscibles [1]. Cette formulation n’est pas suffisante, à elle seule, pour revendiquer un calcul de boil-off LH2 avec changement de phase, transfert thermique cryogénique et équation d’état réelle. Le choix du solveur doit donc être validé avant l’exécution.

## 1. Préparer la CAO dans Onshape

Créer un document privé intitulé :

```text
LH2_REFERENCE_TANK_DESIGN_R001
```

Utiliser les unités SI et documenter dans une fiche de conception :

```text
length: m
mass: kg
time: s
temperature: K
pressure: Pa
```

La géométrie de référence doit être composée de volumes fermés et séparés selon l’usage CFD. Pour un premier cas interne, créer au minimum :

| Élément | Rôle CFD |
|---|---|
| Volume fluide interne | Domaine de calcul |
| Coque solide | À inclure seulement pour une étude CHT |
| Piquage d’entrée | Frontière `inlet` |
| Évent ou sortie | Frontière `outlet` |
| Parois internes | Frontière `tank_wall` |
| Zone liquide initiale | Sous-domaine ou région initiale |
| Zone gazeuse initiale | Sous-domaine ou région initiale |
| Tube plongeur, si utilisé | Géométrie séparée ou paroi interne |
| Baffles, si utilisés | Surfaces internes clairement identifiées |

Avant export, vérifier que le volume fluide est fermé. Les surfaces qui recevront des conditions aux limites doivent être regroupées dans des parties ou faces identifiables. Ne pas exporter uniquement la coque extérieure si le calcul porte sur l’écoulement interne.

Exporter l’assemblage depuis Onshape en STEP AP214 ou AP242 lorsque disponible. Conserver :

```text
lh2_reference_tank_R001.step
onshape_document_url.txt
onshape_revision.txt
geometry_manifest.json
```

Le manifeste doit indiquer l’auteur, l’identifiant du document, la révision, la date d’export, les unités et le SHA-256 du STEP. Onshape confirme que STEP et IGES font partie des formats d’export disponibles pour les pièces et assemblages [2]. L’export ne conserve toutefois pas l’historique paramétrique complet.

## 2. Créer le projet SimScale

Dans SimScale :

1. Créer un projet privé nommé `LH2_REFERENCE_TANK_R001`.
2. Importer le STEP exporté depuis Onshape.
3. Vérifier l’orientation, l’échelle et les unités.
4. Créer ou vérifier le volume fluide interne.
5. Confirmer visuellement que l’entrée, la sortie, les parois, le tube plongeur et les baffles sont distincts.
6. Capturer l’arbre de géométrie et enregistrer l’identifiant du projet.

Pour une analyse multiphasique, SimScale indique que le domaine doit contenir la région fluide et non les parties solides, sauf si une configuration de transfert conjugué est explicitement utilisée [3].

## 3. Choisir honnêtement le type d’analyse

### Cas A — Test VOF hydrodynamique de référence

Utiliser ce cas uniquement pour vérifier la dynamique d’une interface liquide-gaz sans prétendre modéliser le boil-off cryogénique :

```text
Analysis: Multiphase ou Multi-purpose Multiphase
Method: VOF
Time dependency: Transient
Phases: 2
```

La documentation SimScale indique que le mode multiphasique est intrinsèquement transitoire et que la somme des fractions volumiques doit être égale à 1 [1].

### Cas B — Cas thermo-compressible à examiner

Si le compte et le solveur disponibles proposent un modèle compressible avec modèle thermophysique réel, vérifier avant tout calcul :

- si le fluide LH2 est réellement disponible ou si une table de propriétés peut être importée ;
- si la densité dépend de la température et de la pression ;
- si la chaleur latente et l’évaporation sont modélisées ;
- si l’interface liquide-vapeur et le transfert de masse sont disponibles ;
- si les sorties de résidus et de fractions de phase sont exportables.

SimScale documente l’existence de modèles thermophysiques et d’une option `Real Gas` pour certains solveurs, mais précise que les disponibilités dépendent du type d’analyse [4]. Il ne faut pas substituer un modèle `Perfect Gas` à un modèle LH2 réel sans le déclarer comme approximation.

## 4. Définir les phases et les matériaux

Pour un cas VOF de référence, créer deux phases clairement nommées :

```text
phase_1: liquid_reference
phase_2: vapor_reference
```

Si SimScale ne fournit pas les propriétés LH2 validées pour le solveur sélectionné, utiliser des propriétés de démonstration uniquement sous la classification :

```text
REFERENCE_APPROXIMATION_NOT_LH2_VALIDATION
```

Pour un vrai cas LH2, importer ou renseigner des propriétés dont la source, la température, la pression, le domaine de validité et l’incertitude sont documentés. Le sidecar Quantum-Hybrid-PINN doit contenir la provenance de chaque table, et non seulement le nom `LH2`.

La documentation SimScale explique que les modèles thermophysiques calculent les propriétés selon un système pression-température et que les modèles disponibles varient selon le solveur [4].

## 5. Définir les frontières

Créer les frontières suivantes dans la configuration SimScale :

| Nom | Type recommandé pour le cas de référence | Données à enregistrer |
|---|---|---|
| `tank_wall` | No-slip wall | matériau, rugosité si utilisée, flux thermique |
| `inlet` | Velocity ou mass-flow inlet | valeur, unité, phase fractions |
| `outlet` | Pressure outlet ou flow-driven outlet | pression, backflow, fractions |
| `vent` | Pressure outlet si présent | pression et condition de retour |
| `plunger_wall` | No-slip wall | géométrie et condition thermique |
| `baffles` | Wall ou interface interne | identification des faces |

Pour une entrée multiphasique, SimScale demande de spécifier les fractions de phase à l’entrée. La somme doit être exactement 1. Pour une sortie flow-driven, aucune fraction n’est nécessaire sauf en cas de backflow [1].

Ne pas créer artificiellement une fuite, un évent ou un baffle dans l’interface si l’élément n’existe pas dans la CAO.

## 6. Définir les conditions initiales

Pour un test de remplissage ou de mouvement d’interface :

```text
Initial velocity: vector explicitly documented
Initial pressure: explicitly documented
Liquid fraction in liquid region: 1
Vapor fraction in vapor region: 1
Other phase fraction: 0
```

La fraction liquide plus la fraction vapeur doit être égale à 1 dans chaque cellule. Définir la région liquide et la région gazeuse à l’aide de sous-domaines ou de zones initiales explicites. Ne pas utiliser une animation frontend pour créer l’interface.

## 7. Générer le maillage

Créer un maillage volumique et enregistrer la configuration exacte :

```text
Mesh method: Hex-dominant recommandé pour multiphase
Refinement: local autour de l’entrée, de l’interface et des baffles
Boundary layers: selon le modèle de paroi choisi
Geometry cleanup: documenté et non destructif
```

SimScale recommande le maillage hex-dominant pour l’analyse multiphasique et rappelle que la taille des cellules influence le pas de temps via le nombre de Courant [1].

Après génération, exporter ou capturer les métriques disponibles :

- nombre de cellules et de points ;
- taille minimale, maximale et moyenne ;
- non-orthogonalité ;
- skewness ;
- ratio de volume ;
- cellules négatives ou invalides ;
- patches et frontières nommées ;
- log de maillage.

La documentation SimScale recommande d’éviter une non-orthogonalité élevée et indique que la qualité du maillage influe sur la stabilité et la convergence [5]. Les seuils doivent être traités comme critères de qualité du solveur, pas comme preuves automatiques de validité physique.

Conserver :

```text
mesh_log.txt
mesh_quality.csv
named_boundaries.json
mesh_revision.txt
```

## 8. Régler le calcul transitoire

Commencer avec un calcul court de vérification, puis augmenter progressivement la durée. Les valeurs ci-dessous sont des champs à renseigner selon le cas et ne sont pas des constantes LH2 universelles :

| Paramètre | Valeur à fournir | Règle de traçabilité |
|---|---|---|
| `delta_t` | valeur documentée | liée au CFL et à la taille de cellule |
| `end_time` | durée étudiée | justifiée par le phénomène |
| `write_interval` | intervalle d’écriture | assez fin pour conserver plusieurs frames |
| `CFL` | limite configurée | enregistrer l’évolution réelle |
| turbulence | modèle choisi | justification et domaine de validité |
| gravity | vecteur SI | conserver l’orientation |
| surface tension | valeur sourcée | seulement si le modèle l’utilise |

Pour le mode multiphasique, SimScale indique que le solveur est transitoire et que l’ajustement du CFL participe à la stabilité [1]. Le nombre de frames doit être supérieur à 1 si vous voulez alimenter l’animation temporelle du viewer.

## 9. Ajouter les contrôles de résultats

Configurer des contrôles de résultats pour enregistrer :

```text
pressure
velocity
temperature, si le solveur la résout
phase fraction
density, si disponible
mass flow rate
wall heat flux, si disponible
```

Ajouter des probes :

- au centre du réservoir ;
- près de l’entrée ;
- près de l’évent ;
- au-dessus de l’interface ;
- près d’un baffle ou du tube plongeur.

Conserver les courbes exportées et les fichiers source. SimScale documente les contrôles de résultats et le téléchargement de données pour post-traitement local [6].

## 10. Lancer le run

Avant de cliquer sur `Start`, enregistrer :

```text
case_id
project_id
geometry_revision
mesh_revision
analysis_type
solver_name
solver_version, si affichée
material_model
boundary_conditions
initial_conditions
time_control
result_controls
```

Lancer d’abord un run court. Ne pas déclarer de convergence avant de vérifier :

1. absence d’erreur de maillage ;
2. résidus décroissants ou stabilisés ;
3. bilans de masse ;
4. comportement du CFL ;
5. absence de fraction de phase hors de [0, 1] ;
6. absence de divergence ou de valeurs non finies ;
7. stabilité des grandeurs intégrales ;
8. cohérence des profils avec les conditions limites.

Un run terminé avec succès signifie seulement que le solveur a terminé son exécution. Il ne prouve pas automatiquement la validité du modèle physique.

## 11. Télécharger les résultats

Depuis le panneau du run terminé :

1. télécharger la base de résultats ;
2. conserver le ZIP original sans modification ;
3. conserver le log et l’identifiant du run ;
4. ouvrir le résultat dans ParaView ;
5. afficher le volume, les cellules, la fraction de phase, la pression et la vitesse ;
6. exporter les frames volumétriques dans un format accepté par votre pipeline ;
7. conserver le format d’origine et le format converti.

SimScale indique que les résultats CFD peuvent être téléchargés pour un post-traitement externe et ouverts dans ParaView [6]. Le format téléchargé peut être `.foam` ou une base de résultats plutôt qu’un VTU isolé. La conversion doit être enregistrée dans le manifeste.

## 12. Préparer le sidecar Quantum-Hybrid-PINN

Le sidecar final doit ressembler à ceci, avec des valeurs réellement extraites du run :

```json
{
  "contractVersion": "cfd-volume.v1",
  "classification": "REFERENCE_DESIGN_SOLVER_OUTPUT",
  "meshRevision": "simscale-run-<id>-mesh-<revision>",
  "coordinateSystem": "<from-source>",
  "lengthUnit": "m",
  "fieldDescriptors": {
    "pressure": { "unit": "Pa", "quantity": "pressure" },
    "velocity": { "unit": "m/s", "quantity": "velocity" },
    "phase_fraction": { "unit": "1", "quantity": "phase fraction" }
  },
  "boundarySets": [],
  "provenance": {
    "solver": "<actual solver name>",
    "solverVersion": "<actual version>",
    "sourceUri": "<SimScale project/run reference>",
    "calculationId": "<actual run id>",
    "geometryRevision": "<STEP hash/revision>",
    "meshRevision": "<mesh hash/revision>"
  },
  "residuals": {
    "source": "<actual exported residual file>",
    "norm": "<actual norm>",
    "mass": "<actual value>",
    "momentum": "<actual value>",
    "energy": "<actual value or absent>"
  },
  "references": [],
  "frames": [],
  "evidence": {
    "meshGeometryAndTopology": false,
    "fieldsAndUnits": false,
    "namedBoundaries": false,
    "solverProvenance": false,
    "solverResiduals": false,
    "referenceComparison": false,
    "immutableHashes": false,
    "calculatedTransientStates": false
  }
}
```

Les champs `<...>` doivent être remplacés par des données provenant du run. Les valeurs absentes doivent rester absentes ou produire `UNVALIDATED`; elles ne doivent jamais être complétées par le frontend.

## 13. Importer dans Quantum-Hybrid-PINN

Dans `New Project` :

```text
Project ID: LH2-REFERENCE-SIMSCALE-R001
Summary: SimScale solver output on an Onshape reference design; not an industrial asset certification.
Transcription: laisser vide pour le flux CFD
Media: laisser vide
```

Dans le composant **Importer un artefact CFD** :

1. sélectionner toutes les frames VTU ;
2. sélectionner le sidecar JSON ;
3. cliquer sur `Importer et vérifier` ;
4. noter l’`analysisId` ;
5. vérifier `meshRevision`, `cellCount`, `pointCount` et `frameCount` ;
6. comparer la colorbar à la plage réelle du champ ;
7. déplacer la timeline ;
8. vérifier que le maillage est connecté et que l’iso-surface dépend du champ ;
9. vérifier que le statut reste `UNVALIDATED` tant que les preuves ne sont pas complètes.

## 14. Critères de réussite du premier run

Le premier run est acceptable comme **preuve de pipeline CFD de référence** si :

- le run SimScale possède un identifiant ;
- la géométrie est exportée avec une révision ;
- le maillage est volumique ;
- les patches sont nommés ;
- plusieurs frames existent ;
- les champs sont associés aux points ou cellules ;
- les unités sont documentées ;
- les résultats viennent effectivement du run ;
- les SHA-256 sont calculés après export ;
- le sidecar décrit exactement les fichiers importés.

Il ne devient pas pour autant une preuve d’un équipement industriel réel. Pour ce niveau, il faut remplacer la géométrie `REFERENCE_DESIGN` par un modèle fourni ou autorisé par le fabricant ou l’exploitant, et justifier le modèle thermodynamique LH2.

## Références

[1]: [SimScale — Multi-purpose Multiphase](https://www.simscale.com/docs/analysis-types/multi-purpose-analysis/multiphase/) — caractère transitoire, VOF, fractions de phase et conditions aux limites.

[2]: [Onshape — Exporting Files](https://cad.onshape.com/help/Content/File/exporting_files.htm) — export STEP/IGES des pièces et assemblages.

[3]: [SimScale — Multiphase Fluid Flow Analysis](https://www.simscale.com/docs/analysis-types/multiphase-fluid-flow-analysis/) — domaine fluide, matériaux, maillage et contrôles du calcul.

[4]: [SimScale — Thermophysical Fluid Models](https://www.simscale.com/docs/simulation-setup/materials/thermophysical-fluid-models/) — modèles thermophysiques, compressibilité et équations d’état disponibles selon le solveur.

[5]: [SimScale — Mesh Quality](https://www.simscale.com/docs/simulation-setup/meshing/mesh-quality/) — métriques de qualité et impact sur stabilité/convergence.

[6]: [SimScale — Post-Processing](https://www.simscale.com/docs/post-processing/) — champs, contrôles de résultats et export pour post-traitement local.
