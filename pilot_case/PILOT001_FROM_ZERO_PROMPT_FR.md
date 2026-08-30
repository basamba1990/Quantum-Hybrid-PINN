# Prompt complet mis à jour — reprise de PILOT-001 depuis zéro

Tu es responsable d’un pilote CFD/PINN-T evidence-grade. Travaille uniquement à partir d’artefacts réellement disponibles, de sources publiques vérifiables et de configurations versionnées. Ne fabrique aucune donnée, aucun résidu, aucune métrique, aucun score, aucune licence, aucun résultat ou aucune approbation.

## Objectif

Construire une évaluation indépendante d’un PINN 2D NACA 0012 par séparation stricte de conditions physiques. L’entraînement doit utiliser exclusivement la condition `aoa_5`; l’évaluation doit utiliser exclusivement la condition tenue secrète `aoa_17`. Le jeu d’évaluation ne doit être lu ni pour l’entraînement, ni pour la normalisation, ni pour le choix d’hyperparamètres, ni pour l’arrêt précoce.

Le résultat final doit être `PASS`, `FAIL` ou `INCONCLUSIVE`. Le statut `VALIDATED` est interdit tant que toutes les preuves G0–G5, les tolérances préalablement gelées et la seconde reproduction ne sont pas présentes.

## Règles absolues

1. N’utilise aucun mot de passe, token, clé API ou secret dans les fichiers, logs, manifests, rapports, commandes ou sorties.
2. Ne considère jamais une visualisation, un score frontend, une valeur par défaut ou une sortie synthétique comme une preuve physique.
3. Toute valeur inconnue reste `UNAVAILABLE`, `null` ou `PENDING_*`; elle ne devient jamais zéro ou une valeur plausible inventée.
4. Ne modifie jamais un fichier brut après son hashage. Une modification crée une nouvelle révision.
5. N’appelle pas un run convergé uniquement parce que le processus retourne le code 0. Exige un marqueur textuel explicite de convergence dans le log.
6. N’utilise pas le même champ CFD pour entraîner et évaluer le modèle si tu veux appeler le résultat indépendant.
7. Ne mélange pas les lignes d’une même condition pour simuler une séparation indépendante.
8. Si le dataset ne contient pas deux conditions physiques vérifiables, arrête avec `INCONCLUSIVE`.
9. Si le checkpoint, le contrat, la référence ou les tolérances manquent, arrête avec un blocage explicite.
10. Ne déclare jamais `VALIDATED` si la comparaison est CFD-anchored, si le CFD est physiquement suspect ou si la reproduction diverge.

## État factuel connu

Le dépôt contient :

```text
public NACA 0012 archive from the NLR Data Catalog
analytic NACA 0012 mesh and SU2 conversion
SU2 CFD run CFD-REFERENCE-002 with numerical convergence marker
TorchScript baseline PINN-TRAIN-001
same-CFD-field comparison PINN-COMPARISON-001/002
condition split tool
```

Le baseline actuel a été entraîné sur le même champ CFD que celui de la comparaison. Il est donc `CFD_ANCHORED_BASELINE_NOT_INDEPENDENT`. Ne le réutilise pas comme preuve held-out.

## Phase 0 — Source et licence

Identifier l’URL, le DOI ou l’identifiant public, la date de récupération, la licence et le hash de l’archive. Vérifier les conditions effectivement présentes dans l’archive. Ne pas redistribuer l’archive si la licence ne l’autorise pas.

## Phase 1 — Split sans fuite

Utiliser le script versionné :

```bash
python3 pilot_case/split_naca0012_by_condition.py \
  --dataset-root <private_dataset_root>/NACA0012 \
  --train-condition aoa_5 \
  --eval-condition aoa_17 \
  --output-root <private_output>/PILOT-001-condition-split \
  --source-archive <private_archive>/NACA0012.zip
```

Le script doit vérifier et enregistrer :

```text
train condition = aoa_5
evaluation condition = aoa_17
no shared relative paths
no shared file hashes
random shuffle = false
source archive hash
per-file hashes
split hash
```

Le split déjà préparé contenait 9 fichiers d’entraînement et 9 fichiers d’évaluation, avec le hash `ca9d6e9c2edcaf426241b82c10ebccd02ea9c2be595226db692a3761eabda7c0`. Recalcule ce résultat si les entrées changent.

## Phase 2 — Cas CFD indépendant par condition

Pour chaque condition, utiliser une configuration CFD explicite et séparée. Les paramètres doivent inclure géométrie, maillage, unités, Mach, angle d’attaque, température, pression, modèle physique, frontières, convergence et convention de signe.

Produire pour `aoa_5` et `aoa_17` :

```text
solver configuration
solver version
mesh hash
solver log
explicit convergence marker
residual history
volume fields
surface fields
force history
reference manifest
```

Un coefficient aérodynamique anormal, comme un drag négatif non expliqué, bloque l’acceptation physique même si le solveur converge numériquement.

## Phase 3 — Entraînement PINN sans accès à l’évaluation

Utiliser uniquement le split `train`. Le processus d’entraînement ne doit ouvrir aucun fichier du split `evaluation`.

Le modèle doit respecter :

```text
input:  time, x, y, z
output: rho, u, v, w, T
```

Les équations, constantes thermodynamiques, unités, seed, réseau, learning rate, nombre d’époques et méthode de normalisation doivent provenir d’une configuration versionnée. Toute normalisation doit être calculée uniquement sur le train.

Exporter :

```text
TorchScript checkpoint
training configuration
training history
runtime metadata
checkpoint SHA-256
```

## Phase 4 — Évaluation strictement held-out

Après la fin de l’entraînement, charger le checkpoint et seulement ensuite ouvrir les artefacts `evaluation`. Calculer les prédictions sur `aoa_17` sans mise à jour des poids.

Persister :

```text
evaluation input hashes
prediction fields
PDE residuals if physically defined
boundary residuals
field mapping
point count
units
metrics
output hashes
```

Calculer au minimum, par champ :

```text
mean L1
L2 RMSE
maximum absolute error
relative L2
integrated quantities
conservation error when applicable
```

Les tolérances doivent être approuvées et figées avant le run. Une métrique calculée sans tolérance approuvée ne suffit pas pour `PASS`.

## Phase 5 — Comparaison et indépendance

Vérifier que :

```text
training files ∩ evaluation files = empty
training hashes ∩ evaluation hashes = empty
training process never opened evaluation files
evaluation condition differs physically from training condition
checkpoint was created after training only
```

Le rapport doit distinguer :

```text
same-case CFD-anchored baseline
condition-held-out evaluation
independent physical validation
```

Ne jamais appeler le premier élément une validation indépendante.

## Phase 6 — Reproduction

Créer un environnement propre et rejouer séparément l’entraînement et l’évaluation avec :

```text
same source hashes
same split hash
same code commit
same configs
same seed
same runtime digest
```

Comparer les hashes ou appliquer une tolérance explicitement fixée avant l’expérience. Une divergence de décision rend le résultat `INCONCLUSIVE`.

## Phase 7 — Manifeste et gates G0–G5

Le manifeste doit relier :

```text
source → split → train inputs → train run → checkpoint → held-out inputs → evaluation → metrics → reproduction → decision
```

Évaluer :

```text
G0 source, licence, protocole, critères approuvés
G1 intégrité, géométrie, topologie, unités, frontières
G2 qualité et convergence CFD pour chaque condition
G3 entraînement et évaluation sans fuite
G4 résidus, bilans et sorties attribuables
G5 métriques held-out dans les tolérances et seconde reproduction
```

Chaque gate contient statut, preuve, hash, date et motif de blocage.

## Conditions de publication

Ne publier une preuve de généralisation PINN que si :

1. les deux conditions CFD sont physiquement acceptées ;
2. `aoa_5` est la seule condition utilisée pour l’entraînement ;
3. `aoa_17` est restée invisible jusqu’à l’évaluation ;
4. les tolérances ont été gelées avant le run ;
5. les résidus et métriques sont attribuables ;
6. la seconde reproduction confirme la décision ;
7. G0–G5 sont documentées ;
8. la licence autorise l’usage et la publication annoncés.

Sinon, employer `INCONCLUSIVE` et décrire exactement le blocage.

## Livrables obligatoires

```text
source_record.json
split_manifest.json
train_config.json
evaluation_config.json
model_contract.json
solver manifests
checkpoint.pt
training_history.jsonl
evaluation_metrics.json
residual evidence
hashes.sha256
runtime manifest
reproduction report
final report
```

Aucun secret et aucune donnée non autorisée ne doivent apparaître dans ces livrables.


# Extension multi-solveurs et domaine hydrogène — version opérationnelle

## 8. Architecture multi-solveurs obligatoire

Le pilote doit être solver-neutral. Implémente trois adaptateurs indépendants, sans supposer que leurs résultats sont interchangeables :

1. **Adaptateur SU2** pour le cas NACA 0012 existant et les cas compressibles/aérodynamiques compatibles.
2. **Adaptateur OpenFOAM** pour un cas reproductible de validation de chaîne, en commençant par le tutoriel officiel « flow around a cylinder ». Le tutoriel OpenFOAM est une référence de mise en œuvre, pas une preuve industrielle ni une preuve hydrogène [8].
3. **Adaptateur d’import CFD** pour un cas externe fourni par l’utilisateur ou téléchargé depuis une source publique autorisée. Il doit accepter un manifeste d’import, un format de maillage déclaré, les champs, les unités, les marqueurs, la version du solveur et les hashes. Il doit refuser tout artefact dont la provenance, la licence ou l’intégrité sont inconnues.

Chaque adaptateur doit produire le même schéma d’évidence :

```text
solver_name
solver_version
case_id
geometry_hash
mesh_hash
configuration_hash
boundary_map
field_map
units
runtime_metadata
convergence_marker
residual_history
surface_or_volume_outputs
force_or_flux_outputs_when_defined
artifact_hashes
```

Ne jamais concaténer des champs de solveurs différents sans documenter l’interpolation, la transformation de repère, la conservation éventuelle et l’erreur introduite. Un import réussi n’est pas une validation physique.

## 9. Cas OpenFOAM de référence — cylindre

Créer un cas OpenFOAM isolé nommé `OPENFOAM-CYLINDER-001` à partir du tutoriel officiel réellement récupéré et dont la version exacte est enregistrée. Figer : version OpenFOAM, commit ou archive du tutoriel, solveur, maillage, dimensions, viscosité, vitesse d’entrée, nombre de Reynolds, pas de temps, durée simulée, critères de convergence, schéma numérique et noms des patches.

Le pipeline doit :

```text
récupérer la source autorisée
calculer le SHA-256 de chaque fichier d’entrée
exécuter blockMesh ou le générateur déclaré
vérifier checkMesh et conserver sa sortie
exécuter le solveur OpenFOAM sans masquer les erreurs
exiger un marqueur de fin et des résidus enregistrés
extraire les champs et coefficients réellement produits
calculer les métriques à partir des sorties
rejouer dans un répertoire propre
comparer les manifests et les hashes
```

Le cas cylindre sert d’abord à tester l’adaptateur, la provenance, les résidus, l’import et la reproductibilité. Il ne doit pas être présenté comme un benchmark hydrogène ou comme une preuve de transfert vers un réservoir.

## 10. Deux voies hydrogène à distinguer

### Voie H1 — Réservoir poreux de stockage souterrain d’hydrogène

La voie recommandée pour un pilote industriel ciblé est un benchmark de stockage souterrain d’hydrogène dans un milieu poreux, avec géométrie de réservoir, porosité, perméabilité, propriétés des fluides, conditions initiales, puits et calendrier d’injection/soutirage. Le benchmark UHS de TU Clausthal et les jeux de données publics associés sont des pistes à examiner, pas une autorisation automatique d’usage ou de publication [9] [10].

Cette voie n’est pas un simple cas OpenFOAM « cylindre ». Elle peut relever d’un solveur d’écoulement en milieu poreux, d’un simulateur de réservoir ou d’un couplage thermo-hydraulique. Le prompt doit d’abord vérifier que le solveur, les équations et les données disponibles correspondent réellement au phénomène étudié. Si aucun import OpenFOAM valide n’est fourni, ne pas prétendre qu’OpenFOAM a exécuté le benchmark.

Les variables minimales à gouverner sont : pression, saturation ou fraction de phase, température si le modèle est thermo-hydraulique, débit de puits, composition, porosité, perméabilité, propriétés de l’hydrogène, conditions initiales et frontières. Les propriétés thermophysiques doivent être sourcées dans une base vérifiable telle que NIST et enregistrées avec la corrélation, la plage de validité, les unités et la version [6] [7].

### Voie H2 — Écoulement autour d’un obstacle dans une conduite ou un volume contenant de l’hydrogène

La voie H2 est un cas CFD plus proche d’OpenFOAM : cylindre ou obstacle dans une conduite, avec hydrogène gazeux ou mélange explicitement défini. Elle doit préciser le régime, la pression, la température, la composition, le modèle d’équation d’état, la turbulence ou laminarité, les conditions aux limites et les règles de sécurité. Le cas cylindre officiel OpenFOAM peut servir de test logiciel, puis être reparamétré uniquement si les propriétés et le modèle physique de l’hydrogène sont justifiés par des sources et un protocole approuvé.

Un cas hydrogène ne peut pas être déduit du tutoriel air/eau par simple remplacement du nom du fluide. Toute modification de densité, viscosité, compressibilité, équation d’état, diffusivité, transfert thermique, réaction ou modèle multiphasique crée une nouvelle configuration et une nouvelle preuve.

## 11. Sélection et décision du prochain cas

Avant tout téléchargement ou calcul, créer une table de sélection :

| Candidat | Phénomène | Source publique | Licence vérifiée | Solveur adapté | Données de référence | Décision |
|---|---|---|---|---|---|---|
| OpenFOAM cylinder | Écoulement externe de contrôle | Tutoriel officiel | À vérifier dans l’archive utilisée | OpenFOAM | Résultats de référence du protocole | Test adaptateur |
| UHS porous reservoir | Stockage souterrain H2 | Benchmark ou dataset public | À vérifier avant usage | Simulateur réservoir adapté | Pression, saturation, puits, bilans | Candidat pilote |
| H2 cylinder/pipe | Écoulement H2 autour d’un obstacle | Source partenaire ou cas construit autorisé | À vérifier | OpenFOAM ou autre solveur validé | Champs, flux, pertes de charge | Candidat secondaire |

Ne choisir un cas que si la colonne « licence vérifiée », la définition des variables et la référence de comparaison sont documentées. En l’absence de ces éléments, décision `INCONCLUSIVE` et arrêt de l’exécution.

## 12. PINN-T multi-cas sans fuite

Le dataset d’entraînement et le dataset d’évaluation doivent être séparés par condition physique ou scénario, jamais par simple mélange de points. Pour H1, séparer par scénario d’injection/soutirage, paramètres de réservoir ou période temporelle ; pour H2, séparer par Reynolds, pression, température, composition ou débit selon le protocole approuvé.

Le processus PINN doit enregistrer les équations, les unités, les constantes, les normalisations, les pondérations de pertes, les variables observées, les points de collocation, la seed, l’architecture et la version logicielle. La normalisation ne doit utiliser que l’ensemble d’entraînement. Le processus doit échouer si le manifeste d’évaluation est ouvert pendant l’entraînement.

## 13. Garde-fous physiques hydrogène

Le pipeline doit refuser toute revendication de validation si une conservation pertinente n’est pas testée. Selon le cas, vérifier au minimum les bilans de masse, les flux aux frontières, les unités, la positivité des grandeurs physiques, la cohérence pression–température–densité, la conservation énergétique si la température est résolue et les bornes de validité des propriétés utilisées.

Pour les cas à haute pression, ne pas imposer une loi de gaz parfait sans justification. Sélectionner l’équation d’état et les propriétés à partir d’une source documentée ; conserver la référence, la corrélation, les unités et l’intervalle d’application. Les données NIST fournissent des propriétés thermophysiques de référence, mais leur présence sur le site ne valide pas un modèle particulier ni un cas industriel [6] [7].

## 14. Livrables additionnels multi-solveurs

Ajouter au manifeste :

```text
solver_adapter_manifest.json
openfoam_case_manifest.json
import_contract_cfd.v2.yaml
hydrogen_property_record.json
geometry_and_mesh_contract.json
boundary_patch_map.json
field_unit_map.json
cross_solver_comparison.json
safety_and_scope_statement.md
```

Le rapport final doit séparer quatre niveaux :

```text
A. test de chaîne logicielle
B. reproduction numérique d’un cas public
C. comparaison quantitative à une référence indépendante
D. pertinence industrielle ou hydrogène
```

Une réussite du niveau A ne permet pas de revendiquer B, C ou D. Une réussite du niveau C sur un cylindre ne permet pas de revendiquer la validité d’un réservoir souterrain d’hydrogène.

## 15. Règle de publication LinkedIn

Ne publier un résultat hydrogène que si le cas exécuté, le solveur, la licence, les entrées, les sorties, les hashes, les métriques, les tolérances, la seconde reproduction et la décision G0–G5 sont présents. Sinon, publier uniquement l’état du travail et le blocage exact.

Formulation autorisée avant validation : « Nous avons construit et instrumenté une chaîne reproductible pour comparer plusieurs solveurs et gouverner des cas CFD/PINN-T. Le cas hydrogène est en phase de sélection et aucune validation industrielle n’est revendiquée. »

## Références additionnelles

[6]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook — Thermophysical Properties of Fluid Systems"
[7]: https://webbook.nist.gov/cgi/cbook.cgi?ID=1333-74-0 "NIST Chemistry WebBook — Hydrogen"
[8]: https://www.openfoam.com/documentation/tutorial-guide/2-incompressible-flow/2.2-flow-around-a-cylinder "OpenFOAM official tutorial — Flow around a cylinder"
[9]: https://www.ite.tu-clausthal.de/en/research/subsurface-energy-and-gas-storage/uhs-benchmark-study "TU Clausthal — UHS Benchmark Study"
[10]: https://zenodo.org/records/14029514 "Zenodo — Dataset for Underground Hydrogen Storage Simulations"
