# Supabase Edge Function Deployment Guide

## Overview

Le projet utilise deux chemins d'orchestration parallèles pour les analyses :

1. **Backend Direct (Render)** : `POST /hybrid/run-simulation` → Exécution de simulation PINN complète
2. **Edge Function (Supabase)** : `verify-physics-logic` → Validation physique et scoring

## Edge Function: verify-physics-logic

### Déploiement

```bash
# Se connecter à Supabase
npx supabase login

# Déployer la fonction
npx supabase functions deploy verify-physics-logic --project-id ivhxnaxhgfbiqlhgfkik
```

### Variables d'environnement requises

| Variable | Valeur | Description |
|----------|--------|-------------|
| `OPENAI_API_KEY` | (secret) | Clé API OpenAI pour l'extraction de paramètres |
| `H2_INFERENCE_API_URL` | `https://quantum-hybrid-pinn-jdoj.onrender.com` | URL du backend |
| `SUPABASE_URL` | `https://ivhxnaxhgfbiqlhgfkik.supabase.co` | URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | (secret) | Clé service role Supabase |
| `LOG_LEVEL` | `info` | Niveau de log |
| `CACHE_TTL_SECONDS` | `300` | TTL du cache en secondes |
| `MAX_RETRIES` | `3` | Nombre maximum de retries |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Seuil du circuit breaker |

### Schema Supabase requis

Le schéma Supabase doit contenir les tables suivantes :

- `projects` : avec colonnes `id`, `user_id`, `name`, `transcription`, `category`, `video_url`, `status`
- `analyses` : avec colonnes `id`, `project_id`, `user_id`, `title`, `status`, `analysis_type`, `transcription`, `results`, `credibility_score`
- `analysis_results` : avec colonnes `project_id`, `analysis_id`, `extracted_parameters`, `pinn_predictions`, `assimilation_results`, `credibility_score`, `anomalies`, `context`, `user_id`
- `reports` : avec colonnes `id`, `project_id`, `name`, `file_url`, `file_type`, `type`, `created_at`, `updated_at`
- `storage.buckets` : bucket `reports` public

### Correction des appels Edge Function

Le fichier `apps/web/app/dashboard/assistant/page.tsx` a été corrigé :
- L'authentification utilise maintenant le token de session de l'utilisateur (et non l'anon key)
- La réponse est parsée directement (`const data = await response.json()`) au lieu de `result.data`

## Backend API (Render)

### Endpoints principaux

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/v2/validate-3d` | POST | Validation 3D avec scan spatial |
| `/v2/assimilate` | POST | Assimilation de données via Kalman Filter |
| `/hybrid/run-simulation` | POST | Lancement de simulation hybride complète |
| `/jobs/{job_id}` | GET | Polling du statut d'un job |

### Variables d'environnement (Render)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL Supabase |
| `SUPABASE_SERVICE_KEY` | Clé service role Supabase |
| `MODEL_PATH` | Chemin du modèle entraîné |

## Architecture recommandée

Pour une production industrielle robuste :

1. **Le Frontend** crée l'enregistrement `analyses` en statut `pending`
2. **Le Backend Render** exécute la simulation complète et met à jour le statut
3. **L'Edge Function Supabase** s'exécute en parallèle pour la validation physique indépendante
4. **Le Dashboard** lit les résultats depuis la table `analyses` (unifiée)

Les deux chemins écrivent dans la même table `analyses` avec la colonne `credibility_score`, ce qui garantit une source de vérité unique.
