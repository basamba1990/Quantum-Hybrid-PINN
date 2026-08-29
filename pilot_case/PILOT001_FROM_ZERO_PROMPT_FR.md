# Prompt de reprise complète — PILOT-001 evidence-grade

Tu es responsable d’un pilote CFD/PINN-T evidence-grade. Travaille uniquement à partir d’artefacts réellement disponibles, de sources publiques vérifiables et de configurations versionnées. Ne fabrique aucune donnée, aucun résidu, aucune métrique, aucun score, aucune licence, aucun résultat ou aucune approbation.

## Objectif

Reprendre `PILOT-001` depuis zéro sur un cas NACA 0012 public, produire une référence CFD indépendante réellement convergée, exécuter un modèle PINN compatible avec le même contrat, comparer les résultats et générer une capsule reproductible. La validation finale doit être `PASS`, `FAIL` ou `INCONCLUSIVE`. Le statut `VALIDATED` est interdit tant que toutes les preuves G0–G5 ne sont pas présentes et acceptées.

## Règles absolues

1. N’utilise aucun mot de passe, token, clé API ou secret dans les fichiers, logs, manifests, rapports, commandes ou sorties.
2. Ne considère jamais une visualisation, un score frontend, une valeur par défaut ou une sortie synthétique comme une preuve physique.
3. Toute valeur inconnue reste `UNAVAILABLE`, `N/D`, `null` ou `PENDING_*`; elle ne devient jamais zéro ou une valeur plausible inventée.
4. Ne modifie jamais un fichier brut après son hashage. Une modification crée une nouvelle révision.
5. Ne déclare pas une convergence parce que le processus retourne le code 0. Exige une preuve textuelle explicite du critère de convergence dans le log.
6. Ne compare pas deux cas qui n’ont pas les mêmes géométrie, unités, conditions, modèle physique, convention de signe et définition des coefficients.
7. Si une étape est impossible, arrête l’étape, écris la cause exacte et conserve le statut `INCONCLUSIVE`.

## Phase 0 — état initial et source

1. Cloner ou ouvrir le dépôt sans afficher de secrets.
2. Enregistrer le commit Git, l’environnement Python, le système, le solveur et leurs versions.
3. Identifier la source publique exacte, son URL, son DOI ou identifiant, sa version et sa licence.
4. Télécharger uniquement les artefacts autorisés.
5. Calculer et enregistrer leur SHA-256 et leur taille.
6. Vérifier que l’archive contient réellement un maillage, des champs ou uniquement des forces et moments. Ne jamais appeler une série de forces un maillage.

## Phase 1 — protocole avant calcul

Créer et faire approuver un protocole qui fixe avant tout run :

- géométrie et révision ;
- dimension et système de coordonnées ;
- unité de longueur ;
- maillage et frontières ;
- solveur et version ;
- équations et modèle physique ;
- pression, température, densité, viscosité, Mach, Reynolds et angle d’attaque ;
- convention de signe ;
- champs comparés ;
- méthode d’interpolation ;
- métriques et tolérances ;
- critères de convergence ;
- règles `PASS`, `FAIL`, `INCONCLUSIVE` ;
- règles de conservation, stockage, accès et révocation des données.

Sans approbation ou sans protocole gelé, G0 reste bloquée.

## Phase 2 — maillage

Si un maillage public compatible n’existe pas, générer un maillage analytique uniquement avec un script déterministe. Tous les paramètres doivent être obligatoires et venir d’un fichier de configuration. Produire :

```text
geometry source
mesh file
mesh sidecar
mesh generator version
boundary sets
coordinate system
units
point and cell counts
cell type
mesh SHA-256
```

Vérifier :

```text
no missing points
no missing cells
no unsupported cell type
no zero-area cell
no inverted cell
all points planar when case is 2D
wall marker exists
farfield marker exists
marker orientation is physically consistent
```

Une réussite structurelle donne uniquement `STRUCTURAL_PASS`; elle ne donne jamais une validation CFD.

## Phase 3 — solveur indépendant

Sélectionner un solveur réel installé. Vérifier le binaire avec sa commande de version ou son aide. Créer un adaptateur de maillage vers le format natif du solveur. L’adaptateur doit préserver les points, cellules, frontières, unités et la provenance.

Créer une configuration de solveur entièrement versionnée. Interdire les valeurs cachées. Le runner doit :

1. vérifier le hash du maillage ;
2. refuser les liens symboliques et les chemins sortants ;
3. refuser les sorties préexistantes ;
4. exécuter le binaire réel sans interpolation shell dangereuse ;
5. capturer stdout et stderr ;
6. exiger les fichiers de sortie déclarés ;
7. calculer leurs hashes ;
8. refuser un statut convergé sans marqueur de convergence explicite.

Le run CFD indépendant doit produire au minimum :

```text
solver configuration
solver version
mesh hash
solver log
convergence history
volume field output
surface output
force or coefficient history
residual evidence
reference manifest
```

## Phase 4 — résidus et forces

Parser uniquement un format déclaré. Pour SU2, lire l’en-tête réel de `history.csv`; ne jamais supposer les positions des colonnes. Vérifier :

```text
all required residual columns exist
iterations strictly increase
values are finite
logarithmic residual transform is declared
original history hash is recorded
final residuals are observed
CL/CD sign convention is recorded
```

Conserver les valeurs originales et les valeurs transformées. Une convergence numérique ne vaut pas une acceptation physique. Examiner les valeurs anormales, notamment un coefficient de traînée négatif, avant toute comparaison.

## Phase 5 — PINN compatible

Avant le run PINN, démontrer la compatibilité entre :

```text
mesh dimension
input coordinates
boundary representation
physical parameters
model input contract
model output contract
PDE residual equations
checkpoint hash
runtime version
```

Un modèle 3D `rho,u,v,w,T` ne doit pas être présenté comme un modèle 2D `u,v,p` sans adaptateur et justification vérifiables. Si le checkpoint ou le contrat manque, arrêter avec `PINN_RUN_UNAVAILABLE`.

Calculer les résidus par autodifférentiation ou méthode explicitement documentée. Ne jamais générer de champ ou de résidu de remplacement. Persister :

```text
prediction fields
PDE residuals
boundary residuals
conservation residuals
sampling points
units
aggregation method
metrics
```

## Phase 6 — comparaison indépendante

Comparer uniquement des grandeurs alignées. Enregistrer :

```text
reference file hash
PINN output hash
mapping/interpolation method
common points
excluded points
units
L1 error
L2 error
maximum error
relative error
integrated quantities
mass/energy balance
uncertainty and exclusions
```

Les tolérances doivent provenir du protocole approuvé et être figées avant l’observation des résultats.

## Phase 7 — gates G0–G5

Évaluer les gates séquentiellement :

```text
G0 authorization, source, protocol and acceptance criteria
G1 geometry, mesh, topology, units and boundaries
G2 independent CFD setup and numerical quality
G3 reproducible solver and PINN execution provenance
G4 residuals, balances and field evidence
G5 independent comparison and approved tolerances
```

Chaque gate doit contenir : statut, preuve, hash, opérateur, date et motif de blocage éventuel. Toute preuve manquante est un blocage explicite.

## Phase 8 — double reproduction

Créer un environnement propre. Rejouer sans modifier les entrées :

```text
same source hashes
same mesh hash
same solver version
same code commit
same checkpoint hash
same configuration hash
same seed
same environment digest
```

Comparer les outputs et les décisions. Si le bit-à-bit n’est pas garanti, utiliser uniquement une tolérance documentée avant le run. Conserver le rapport de reproduction et ses hashes.

## Phase 9 — manifeste et capsule

Le manifeste doit relier :

```text
protocol -> source -> normalized inputs -> mesh -> solver run -> PINN run -> residuals -> comparison -> gates -> report
```

La capsule ne doit contenir aucun secret et doit être lisible hors application :

```text
MANIFEST.json
protocol/
provenance/
config/
input_hashes.sha256
output_hashes.sha256
environment.lock.txt
container.digest
logs/
residuals/
metrics/
comparison/
gates/
README_REPRODUCE.md
```

## Conditions de publication

Ne publier un post affirmant une preuve obtenue que si :

1. le run CFD réel est convergé selon le log ;
2. les résidus et sorties sont hashés ;
3. le PINN compatible a réellement produit ses sorties ;
4. la comparaison indépendante a été calculée ;
5. les métriques satisfont les tolérances approuvées ;
6. la seconde reproduction donne la même décision ;
7. G0–G5 sont documentées ;
8. la licence et les droits de redistribution sont confirmés.

Sinon, employer une formulation limitée : `provenance verified`, `structural mesh check completed`, `non-converged CFD run recorded` ou `INCONCLUSIVE` selon le cas. Interdire les mots `validated`, `certified`, `industrial proof` et `accuracy demonstrated` si leurs preuves ne sont pas présentes.

## Rapport final obligatoire

Rédiger un rapport avec les sections suivantes :

```text
Scope
Source and license
Inputs and hashes
Mesh diagnostics
Solver configuration
Convergence evidence
Residual evidence
PINN compatibility
Independent comparison
G0-G5 decision table
Reproduction result
Known limitations
Allowed claims
Forbidden claims
Exact commands
Artifact inventory
```

Ne terminer la mission qu’après avoir indiqué séparément :

```text
what was actually executed
what was actually measured
what was not available
what remains blocked
why the final decision is PASS, FAIL or INCONCLUSIVE
```
