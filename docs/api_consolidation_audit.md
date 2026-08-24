# Audit de consolidation `apps/api`

## Verdict

`apps/api` ne constitue pas encore une seule application FastAPI propre. `main.py` est le point d’entrée Render, mais il agrège plusieurs routeurs et monte ensuite une seconde application FastAPI V2. Trois autres applications FastAPI autonomes restent présentes dans le dépôt.

## Surface actuelle

```text
main.py
├── analysis_processor.router                 /v2/...
├── pgd_pinn_api.router                       /v2/hybrid/...
├── export_router.router                      /v2/export/...
├── cfd_import_router.router                  /v2/cfd/...
├── cao_router.router                         /v2/cao/...
└── startup: app.mount('/', hydrogen_api_v2.app)
```

Applications autonomes supplémentaires :

```text
hydrogen_api.py       FastAPI 1.0.0, /predict, /model/*
hydrogen_api_v2.py    FastAPI 2.0.0, /predict, /v2/predict-batch, /v2/analysis/*
hydrogen_tfc_api.py   FastAPI 2.0.0, /predict, /model/train
```

## Confusions et doublons

| Élément | Constat | Décision recommandée |
|---|---|---|
| `hydrogen_api.py` | Ancienne application autonome avec modèles différents | Ne plus la lancer comme serveur ; conserver temporairement en archive de compatibilité |
| `hydrogen_api_v2.py` | Seconde application montée à `/`, mélange routes non versionnées et `/v2` | Convertir en `APIRouter` ou extraire les handlers nécessaires dans des routeurs versionnés |
| `hydrogen_tfc_api.py` | Application autonome avec `/predict` concurrent | Retirer de la surface Render principale ; garder uniquement si un endpoint TFC documenté est requis |
| `analysis_processor.py` | Traitement d’analyse et résultats persistés | Garder comme routeur, mais interdire toute sortie `cfd_dataset` hors repository CFD |
| `pgd_pinn_api.py` | `upload-mesh` et création de dummy STL | Retirer le fallback dummy et faire échouer l’appel si aucun mesh réel n’est fourni |
| `transient_router.py` | Routeur non inclus dans `main.py` | Ajouter explicitement ses routes ou supprimer le bouton frontend correspondant |
| `cfd_import_router.py` | Seul flux contractuel VTU côté backend | Garder comme source canonique d’import CFD |

## Problèmes techniques immédiats

`main.py` appelle `os.getenv` lors de l’initialisation mais l’import `os` n’est pas visible dans le fichier audité. Cet import doit être ajouté explicitement.

`main.py` contient une URL Supabase de secours codée en dur. Elle doit être supprimée ; l’absence de `SUPABASE_URL` doit produire une erreur de configuration au démarrage.

La configuration CORS `allow_origins=["*"]` avec `allow_credentials=True` est trop permissive pour une API authentifiée. Elle doit utiliser `CORS_ALLOWED_ORIGINS` comme liste d’origines explicites.

Le montage dynamique `app.mount('/', hydrogen_api_v2.app)` masque la frontière entre l’application principale et l’application V2. Il empêche de décrire une surface unique et rend les tests de routes ambigus.

Le fichier `pgd_pinn_api.py` contient un générateur de dummy STL. Ce chemin est incompatible avec une validation CFD et doit être supprimé ou limité exclusivement aux tests.

Plusieurs modules scientifiques contiennent des placeholders ou fallbacks. Ils ne doivent pas être supprimés sans analyse de leurs callers, mais ils doivent être exclus des chemins qui produisent des résultats certifiants.

## Surface cible

La consolidation sûre doit produire :

```text
main.py : seule instance FastAPI
├── /health
├── /v2/cfd/*       import et lecture cfd-volume.v1
├── /v2/cao/*       CAO/maillage/contrats
├── /v2/analysis/*  analyses persistées
├── /v2/export/*    exports explicitement sourcés
└── /v2/hybrid/*    uniquement si le solveur réel est disponible
```

Les applications `hydrogen_api.py`, `hydrogen_api_v2.py` et `hydrogen_tfc_api.py` doivent être converties en modules de handlers/routeurs ou déplacées en archive hors du chemin de déploiement. Une suppression directe avant migration des endpoints `/predict` risquerait de casser le frontend.

## Tests requis avant suppression

```text
GET /health
GET /openapi.json
POST /v2/cfd/import
GET /v2/cfd/{analysis_id}
POST /v2/analysis/submit-analysis
GET /v2/analysis/analysis-result/{job_id}
POST /v2/cao/import
POST /v2/cao/mesh
POST /v2/export/validation-report/json
```

Les tests doivent vérifier qu’un dataset absent produit `UNVALIDATED`, qu’aucun endpoint legacy ne produit `VALIDATED` et qu’un upload sans artefact réel est refusé.

## Conclusion

Une fusion complète est réalisable, mais elle doit être faite en deux étapes : d’abord transformer `hydrogen_api_v2.py` en routeur ou extraire ses endpoints nécessaires, ensuite désactiver les trois applications autonomes. Les supprimer immédiatement sans cette migration serait une régression non vérifiable.
