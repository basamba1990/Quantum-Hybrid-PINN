# Intégration CI/CD des artefacts STEP AP242

## Objectif

Le workflow `.github/workflows/validate-industrial-cad.yml` automatise la validation des paquets CAO industriels suivis dans `fixtures/step/industrial/`. Il se déclenche sur les modifications des STEP, des manifestes, du validateur ou du workflow lui-même, ainsi que manuellement avec `workflow_dispatch`.

La validation est **fail-closed** : le job échoue si un fichier n’est pas AP242DIS, si l’unité de longueur n’est pas le mètre SI, si l’empreinte SHA-256 ne correspond pas au manifeste, si la géométrie B-Rep est invalide, si le round-trip Open CASCADE ne respecte pas les dimensions du manifeste, ou si l’un des deux scénarios industriels requis est absent.

## Installation reproductible

Le workflow utilise Ubuntu 24.04, Python 3.12 et `cadquery==2.8.0`. CadQuery fournit les bindings Python OCP vers le noyau Open CASCADE. La documentation CadQuery recommande Conda/Mamba comme voie la mieux testée, tout en documentant l’installation pip sur Python 3.9 et plus récent [1] [2]. Le fichier `requirements-cad-ci.txt` verrouille la version utilisée par le CI afin d’éviter une dérive silencieuse des dépendances.

## Artefacts produits

Chaque exécution publie `artifacts/industrial_step_validation.json` comme artefact GitHub Actions nommé avec le SHA du commit. L’action `actions/upload-artifact@v4` fournit un digest SHA-256 et conserve l’artefact pendant 30 jours. GitHub documente ce mécanisme pour partager les sorties de test et vérifier les artefacts téléchargés [3] [4].

## Fonctionnement recommandé

Une pull request doit d’abord modifier les fichiers STEP et manifestes sous `fixtures/step/industrial/`, puis attendre le statut vert `Validate AP242 B-Rep packages`. Le rapport JSON doit être examiné avant fusion, notamment pour les champs `schema`, `si_length_unit`, `shape_valid`, `brepcheck_valid`, `step_sha256`, `volume_m3` et `bounds_m`.

La publication vers Supabase n’est pas activée automatiquement. Cette séparation est volontaire : une validation de pull request ne doit pas écraser un artefact de production. Pour autoriser ultérieurement une publication, il faut créer un environnement GitHub protégé nommé `production-cad`, ajouter au minimum `SUPABASE_URL`, `SUPABASE_BUCKET_NAME` et `SUPABASE_SERVICE_ROLE_KEY` comme secrets d’environnement, faire réviser un script d’upload idempotent, puis lancer manuellement le workflow avec `publish=true`. La clé de service ne doit jamais être placée dans le dépôt, dans un log ou dans un fichier `.env` suivi par Git.

## Commandes locales

```bash
python3 -m venv .venv-cad
. .venv-cad/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-cad-ci.txt
python scripts/validate_industrial_step.py
```

Le résultat attendu est `status: VALIDATED` pour les deux scénarios. Ce résultat concerne l’intégrité des paquets CAO et ne constitue pas, à lui seul, une validation physique complète G0–G5 : les contrats de cas, le maillage, les conditions aux limites, les champs et les résidus doivent être vérifiés par l’orchestrateur scientifique séparé.

## Références

[1] [CadQuery — Installing CadQuery](https://cadquery.readthedocs.io/en/latest/installation.html).  
[2] [PyPI — CadQuery 2.8.0](https://pypi.org/project/cadquery/).  
[3] [GitHub Docs — Store and share data with workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data).  
[4] [actions/upload-artifact](https://github.com/actions/upload-artifact).
