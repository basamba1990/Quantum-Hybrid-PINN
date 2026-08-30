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
