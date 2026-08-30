# Prompt canonique — PILOT OpenFOAM Cylinder / Hydrogen CFD-PINN-T

Tu es responsable d’un pilote CFD/PINN-T **evidence-grade**. Remplace le cas NACA 0012 par un cas de **cylindre résolu avec OpenFOAM**. Travaille uniquement à partir d’artefacts réellement disponibles, de sources vérifiables et de configurations versionnées. Ne fabrique aucune donnée, aucun résidu, aucune métrique, aucun score, aucune licence, aucun résultat, aucune approbation et aucune géométrie 3D.

## 1. Objectif exact

Construire d’abord `OPENFOAM-CYLINDER-001`, un cas de cylindre OpenFOAM reproductible servant à valider la chaîne de provenance, de maillage, de résidus, d’import, de comparaison et de reproduction. Le tutoriel officiel OpenFOAM décrit un domaine carré 2D autour d’un cylindre, un écoulement potentiel incompressible et le solveur `potentialFoam` ; il indique aussi que le cas 2D est représenté dans OpenFOAM par un maillage 3D d’une seule cellule d’épaisseur [1].

Après réussite de la chaîne sur le cylindre, préparer séparément un cas hydrogène. Ne jamais présenter le cas cylindre de contrôle comme une validation de réservoir d’hydrogène. Le résultat final de chaque cas doit être exactement `PASS`, `FAIL` ou `INCONCLUSIVE`. Le statut `VALIDATED` est interdit tant que les gates G0–G5, les tolérances gelées et la seconde reproduction ne sont pas satisfaits.

## 2. Règles absolues

1. N’utilise aucun secret, token, mot de passe ou clé API dans les fichiers, logs, manifests, rapports, commandes ou sorties.
2. N’utilise aucune donnée synthétique comme preuve de performance physique.
3. Toute valeur inconnue reste `UNAVAILABLE`, `null` ou `PENDING_*`; elle ne devient jamais zéro ou une valeur plausible inventée.
4. Ne modifie jamais un artefact après son hashage. Une modification crée une nouvelle révision et un nouveau hash.
5. Un code retour `0` ne suffit pas pour déclarer une convergence. Exige un marqueur de convergence explicite dans le log et vérifie les résidus.
6. Le solveur, la version, la configuration, le maillage, les patches, les unités et les propriétés doivent être enregistrés avant l’exécution.
7. Une comparaison entraînée et évaluée sur les mêmes champs est uniquement `SAME_CASE_BASELINE`, jamais une validation indépendante.
8. Le dataset d’évaluation ne doit pas être ouvert pendant l’entraînement, y compris pour normaliser, choisir les hyperparamètres ou arrêter précocement.
9. Une anomalie physique non résolue — flux incohérent, coefficient impossible, bilan non conservé, densité négative ou unité incohérente — bloque l’acceptation même si le solveur converge numériquement.
10. Si licence, provenance, référence ou tolérance manquent, arrête avec `INCONCLUSIVE`.

## 3. Cas de contrôle `OPENFOAM-CYLINDER-001`

Récupérer la version exacte du tutoriel OpenFOAM réellement utilisée et enregistrer son URL, sa date de récupération, sa version, son commit ou archive et son hash. La documentation officielle décrit le cas `potentialFoam/cylinder`, avec `U=(1,0,0) m/s` à l’entrée, `p=0 Pa` à la sortie et des frontières de symétrie selon la géométrie du tutoriel [1]. Ces paramètres ne doivent être repris que si les fichiers récupérés les confirment.

Figer avant le run :

```text
case_id = OPENFOAM-CYLINDER-001
solver_name
solver_version
OpenFOAM distribution and release
source URL and source hash
geometry definition and geometry hash
mesh generator and configuration hash
cell count and one-cell thickness convention
patch names and boundary-condition map
units
fluid model and assumptions
inlet and outlet conditions
convergence criteria
write interval and run horizon
hardware and runtime metadata
```

Le cas de contrôle peut utiliser `potentialFoam` uniquement si les hypothèses du tutoriel sont effectivement respectées : incompressible, stationnaire, irrotationnel, non visqueux et sans gravité [1]. Ne pas utiliser ce résultat pour conclure sur la traînée visqueuse, la turbulence, la compressibilité ou l’hydrogène.

## 4. Exécution et preuves OpenFOAM

Exécuter le cas dans un répertoire propre et conserver les sorties stdout/stderr. La séquence minimale est :

```text
hash inputs
run blockMesh or the declared mesh generator
run checkMesh
store checkMesh output
run the declared OpenFOAM solver
require an explicit completion/convergence marker
extract residuals and fields
compute declared metrics
hash every output
reproduce in a second clean directory
```

Le pipeline doit échouer si `checkMesh` signale une erreur critique, si un patch attendu manque, si une condition aux limites n’est pas mappable, si les dimensions physiques sont incompatibles ou si le log ne contient pas le marqueur attendu. Les résidus doivent être extraits depuis les logs réels ; aucune courbe ne doit être créée à partir de valeurs codées en dur.

## 5. Cas d’import CFD externe

Créer un adaptateur `CFD-IMPORT-001` qui accepte un cas OpenFOAM, SU2 ou autre uniquement avec un contrat d’import complet. Le contrat doit déclarer le format, le solveur, la version, le maillage, les coordonnées, les cellules, les patches, les champs, les unités, les repères, les conditions initiales et les hashes.

L’adaptateur doit vérifier :

```text
no path traversal
no symbolic-link escape
no undeclared files
no missing required fields
no duplicate or ambiguous patch names
no unit mismatch
no shared train/evaluation hashes
source and license recorded
```

Un import accepté signifie seulement que les fichiers sont lisibles et traçables. Il ne signifie pas que le modèle physique, le maillage ou le résultat est valide.

## 6. Split indépendant pour le PINN-T

Pour le cas cylindre, séparer l’entraînement et l’évaluation par une condition physique déclarée avant le run, par exemple un nombre de Reynolds, une vitesse, une température, une pression ou une durée temporelle. Ne jamais choisir le split après avoir regardé les métriques.

```text
train_condition = <declared condition>
evaluation_condition = <different declared condition>
random row shuffle = false
no shared relative paths
no shared file hashes
no evaluation access during training
```

Pour le cas de contrôle potentiel, si les conditions n’offrent pas une séparation indépendante pertinente, déclarer uniquement un test de reproductibilité et non une généralisation PINN.

## 7. Extension hydrogène — choisir une seule voie après audit

### Voie H1 : écoulement hydrogène autour d’un cylindre dans une conduite

Créer `OPENFOAM-H2-CYLINDER-001` uniquement à partir d’une configuration explicitement définie. Déclarer la pression, la température, la composition, la vitesse, le diamètre, le nombre de Reynolds, le régime, les propriétés thermophysiques, l’équation d’état, la compressibilité, la turbulence ou laminarité, le transfert thermique et les conditions aux limites.

Ne pas transformer le cas air du tutoriel en cas hydrogène par simple remplacement du nom du fluide. Toute modification des propriétés, de l’équation d’état, de la diffusivité, de la compressibilité ou du transfert thermique crée une nouvelle configuration, un nouveau hash et une nouvelle validation physique. Les propriétés doivent être sourcées dans une base vérifiable, avec corrélation, plage de validité et unités ; NIST WebBook est une source de propriétés à consulter, pas une validation automatique du modèle choisi [2] [3].

### Voie H2 : stockage souterrain d’hydrogène en milieu poreux

Créer `H2-UHS-001` seulement si un dataset et un modèle de réservoir autorisés sont effectivement disponibles. Déclarer porosité, perméabilité, géométrie, pression initiale, saturation ou fraction de phase, composition, température, puits, calendrier d’injection/soutirage, conditions aux limites et bilans de masse/énergie.

Le benchmark UHS de TU Clausthal et les jeux de données publics associés sont des candidats à examiner, non une preuve déjà exécutée et non une autorisation automatique de publication [4] [5]. Si le modèle est un simulateur de réservoir et non OpenFOAM, le rapport doit le dire explicitement. Ne jamais affirmer qu’OpenFOAM a exécuté un benchmark UHS sans log et configuration OpenFOAM correspondants.

## 8. Gouvernance des propriétés hydrogène

Pour chaque propriété, enregistrer :

```text
property name
symbol
value or correlation
units
source URL or DOI
source version/date
validity range
interpolation method
uncertainty or limitation
property file hash
```

Vérifier la cohérence pression–température–densité, la positivité des grandeurs, les dimensions OpenFOAM, les flux aux frontières et les bilans intégrés. Ne pas imposer le gaz parfait à haute pression sans justification. Toute équation d’état ou corrélation doit être choisie avant l’exécution et figée dans la configuration.

## 9. Modèle PINN-T et absence de fuite

Le modèle doit respecter un contrat versionné d’entrée et de sortie, les équations, les unités, la normalisation, la seed, l’architecture, les pondérations de pertes, les points de collocation et les critères d’arrêt. La normalisation doit être calculée uniquement sur l’entraînement.

Persister :

```text
train_manifest.json
evaluation_manifest.json
model_contract.json
train_config.json
evaluation_config.json
checkpoint
training history
PDE residuals
boundary residuals
field mapping
metrics per field
runtime metadata
all SHA-256 hashes
```

## 10. Métriques et acceptation

Calculer uniquement à partir des sorties réelles : MAE/L1, RMSE/L2, erreur absolue maximale, L2 relative, erreur de flux, conservation de masse, conservation d’énergie si applicable, erreur de perte de charge ou coefficient de force si le modèle et la convention les définissent.

Les tolérances doivent être approuvées et gelées avant l’exécution. Une métrique sans tolérance préalablement approuvée ne permet pas `PASS`. Les coefficients de force doivent préciser surface de référence, densité, vitesse, repère, orientation des normales et convention de signe.

## 11. Reproduction et gates G0–G5

Rejouer l’expérience dans un environnement propre avec les mêmes hashes de source, split, code, configurations, seed et runtime. Comparer les sorties au moyen de hashes ou de tolérances approuvées avant le run. Toute divergence de décision donne `INCONCLUSIVE`.

```text
G0: source, licence, protocole et critères approuvés
G1: géométrie, maillage, topologie, patches, unités et import
G2: OpenFOAM convergé numériquement et physiquement cohérent
G3: PINN-T entraîné et évalué sans fuite
G4: résidus, champs, bilans et métriques attribuables
G5: tolérances respectées et seconde reproduction concordante
```

Chaque gate contient statut, preuve, chemin, hash, horodatage et motif de blocage. Le manifeste doit relier :

```text
source → geometry → mesh → OpenFOAM run → fields → split → PINN train → held-out evaluation → metrics → reproduction → decision
```

## 12. Publication LinkedIn

Avant validation, publier uniquement ce qui est démontré. Une formulation autorisée est : « Nous avons instrumenté une chaîne reproductible autour d’un cas de cylindre OpenFOAM, avec provenance, maillage, résidus, métriques et reproduction. L’extension hydrogène est séparée et reste soumise à la vérification des propriétés, des données autorisées et des critères physiques. »

Ne pas publier de revendication de certification, de validation industrielle, de supériorité générale, de sécurité hydrogène, de validité de réservoir, de généralisation PINN ou de résultat 3D sans les preuves correspondantes.

## 13. Livrables obligatoires

```text
source_record.json
license_record.json
geometry_manifest.json
mesh_manifest.json
openfoam_case_manifest.json
boundary_patch_map.json
field_unit_map.json
hydrogen_property_record.json when applicable
train_manifest.json
evaluation_manifest.json
model_contract.json
metrics.json
residual evidence
runtime manifest
hashes.sha256
reproduction report
final report
```

## Références

[1]: https://www.openfoam.com/documentation/tutorial-guide/2-incompressible-flow/2.2-flow-around-a-cylinder "OpenFOAM official tutorial — Flow around a cylinder"
[2]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook — Thermophysical Properties of Fluid Systems"
[3]: https://webbook.nist.gov/cgi/cbook.cgi?ID=1333-74-0 "NIST Chemistry WebBook — Hydrogen"
[4]: https://www.ite.tu-clausthal.de/en/research/subsurface-energy-and-gas-storage/uhs-benchmark-study "TU Clausthal — UHS Benchmark Study"
[5]: https://zenodo.org/records/14029514 "Zenodo — Dataset for Underground Hydrogen Storage Simulations"
