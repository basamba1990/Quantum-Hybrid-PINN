# Audit déploiement Render — 2026-08-24

URL vérifiée : https://quantum-pinn-api-qef2.onrender.com/

La réponse racine publique indique encore `version: 8.0.12` et ne liste pas `/v2/cfd/*` dans le champ déclaratif `endpoints`.

L’OpenAPI publique expose toutefois les routes CFD et V2 suivantes : `/v2/cfd/import`, `/v2/cfd/{analysis_id}`, `/v2/model/initialize`, `/v2/model/train`, `/v2/predict-batch`, `/v2/validate-3d`, `/v2/assimilate`, ainsi que les routes d’analyse, CAO, export et hybride.

Le fichier `apps/api/main.py` sur GitHub `main` (commit vérifié localement) contient `version="8.0.13"`, `from hydrogen_api_v2 import router as hydrogen_v2_router` et `app.include_router(hydrogen_v2_router)`, sans `app.mount` dynamique.

Conclusion : le service Render exécute une révision différente ou une ancienne image pour la route racine, alors que l’OpenAPI semble déjà refléter les routes du code consolidé. La réponse root contient une liste statique d’endpoints et une version non synchronisée avec l’instance source. Il faut déclencher/revérifier le déploiement Render et rendre la réponse root dérivée de la version et des routes réellement chargées.
