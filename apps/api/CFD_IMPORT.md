# Import CFD VTU sécurisé

## Endpoints

`POST /v2/cfd/import` reçoit un formulaire `multipart/form-data` composé de `vtu_files` répété pour chaque frame `.vtu`, d’un fichier `sidecar` `.json`, de `case_id`, `project_id`, `owner_id` et, pour une analyse préalablement créée, `analysis_id`. Le backend reçoit aussi `owner_id`, ajouté par le proxy Next.js après lecture de la session Supabase.

`GET /v2/cfd/{analysis_id}` relit le dataset persistant. Les deux endpoints exigent `Authorization: Bearer <CFD_IMPORT_API_TOKEN>`.

`GET /v2/cfd/project/{project_id}/latest?owner_id=<user_uuid>` renvoie le dataset le plus récent du projet. Lorsqu’aucun dataset n’existe encore, la réponse est HTTP 200 et non ambiguë : `{"status":"NO_ANALYSIS","analysis":null,"dataset":null}`.

## Configuration serveur

Définir la même valeur aléatoire longue dans Render et Vercel, sans la préfixer par `NEXT_PUBLIC_` :

```text
CFD_IMPORT_API_TOKEN=<secret différent des clés Supabase>
CFD_IMPORT_MAX_BYTES=52428800
CFD_IMPORT_MAX_TOTAL_BYTES=41943040
CFD_IMPORT_MAX_FILES=32
CFD_ARTIFACT_BUCKET=cfd-artifacts
```

Le backend n’autorise qu’un import volumineux simultané sur l’instance Free. La limite totale de 40 MiB s’applique à l’ensemble du sidecar et des frames, en plus de la limite par fichier. Une réponse `413` ou `429` est volontaire et préférable à un redémarrage mémoire.

Le bucket privé `cfd-artifacts` doit exister dans Supabase Storage. La migration canonique `apps/web/supabase/migrations/014_cfd_artifacts_and_datasets.sql` doit être exécutée dans Supabase avant le premier import. Le backend utilise uniquement la clé `SUPABASE_SERVICE_ROLE_KEY`; elle ne doit jamais être envoyée au navigateur.

## Intégrité du sidecar

Le sidecar doit déclarer `contractVersion: cfd-volume.v1`, `fieldDescriptors`, `boundarySets`, `provenance`, `residuals`, `references`, `evidence` et une liste `frames`. Chaque frame doit contenir `frameId`, `time`, `file` et `payloadHash`. Le serveur calcule le SHA-256 des octets reçus et compare exactement ce hash à `payloadHash`. Il refuse les fichiers supplémentaires, les frames manquantes, les temps non croissants, les connectivités différentes, les cellules hors limites, les champs non numériques et toute unité absente.

Le dataset final est reconstruit à partir des octets VTU; les métadonnées non présentes ne sont pas complétées. Les octets originaux du sidecar et des VTU sont conservés dans Storage, tandis que le contrat normalisé et le manifeste de hashes sont enregistrés dans `cfd_datasets`. La ligne conserve la relation complète `project_id`, `analysis_id`, `owner_id`, `case_id`, `mesh_hash`, `contract_hash`, `frame_hashes` et `status`.

## Statuts

Un sidecar classé `SYNTHETIC_*` donne `STRUCTURAL_TEST_UNVALIDATED`. Un artefact non synthétique dont les preuves sont incomplètes donne `UNVALIDATED`. L’import ne produit pas automatiquement une certification G0–G5; une validation scientifique nécessite encore les preuves de solveur, de provenance, de résidus et de comparaison exigées par le service de certification.

## Test local

```bash
cd apps/api
python3 -m pytest tests/test_cfd_import_manual.py tests/test_cfd_import_endpoint.py -q
```

Le test du kit synthétique doit réussir le parsing et le contrôle de hash, mais le statut attendu reste `STRUCTURAL_TEST_UNVALIDATED`.

## Répartition des variables par service

### Render — backend FastAPI

Configurer uniquement côté Render :

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<clé service_role régénérée>
CFD_IMPORT_API_TOKEN=<secret interservices>
CFD_ARTIFACT_BUCKET=cfd-artifacts
```

FastAPI utilise `SUPABASE_SERVICE_ROLE_KEY` dans `_supabase()` pour écrire dans `storage.objects` et `cfd_datasets`. Cette clé n’est jamais retournée par une route et ne doit pas être placée dans le dépôt.

### Vercel — proxy Next.js et frontend

Configurer côté Vercel :

```text
H2_INFERENCE_API_URL=https://<backend-render>.onrender.com
NEXT_PUBLIC_API_URL=https://<backend-render>.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon régénérée si elle a été exposée>
CFD_IMPORT_API_TOKEN=<même secret interservices que Render>
```

Le proxy `/api/cfd/import` utilise la session Supabase de l’utilisateur pour vérifier son identité, ajoute `owner_id`, puis transmet les fichiers au backend avec `Authorization: Bearer CFD_IMPORT_API_TOKEN`. Il ne doit pas utiliser `SUPABASE_SERVICE_ROLE_KEY` et cette variable ne doit jamais commencer par `NEXT_PUBLIC_`.

### Ne pas faire

Ne pas mettre `SUPABASE_SERVICE_ROLE_KEY`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` ou un token GitHub dans le code, dans `NEXT_PUBLIC_*`, dans le sidecar ou dans les logs. Les valeurs précédemment publiées dans une conversation doivent être considérées comme compromises et régénérées.
