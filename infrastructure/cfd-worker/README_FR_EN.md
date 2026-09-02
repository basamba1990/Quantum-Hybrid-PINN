# Worker CFD LH2 persistant — configuration et intégration

## Français

Ce worker est le composant de calcul externe du pilote `PILOT-LH2-001`. Il exécute `reactingTwoPhaseEulerFoam` dans une image OpenFOAM 2512, conserve les sorties dans un volume persistant et écrit un manifeste SHA-256 pour chaque job. Il ne décide jamais `VALIDATED` : la décision demeure dans le service d’évaluation G0–G6.

### Démarrage local

Depuis la racine du dépôt :

```bash
docker compose -f infrastructure/cfd-worker/docker-compose.yml build
docker compose -f infrastructure/cfd-worker/docker-compose.yml up -d
curl http://127.0.0.1:8080/health
curl -X POST http://127.0.0.1:8080/jobs \\
  -H 'Content-Type: application/json' \\
  -d '{"pilotId":"PILOT-LH2-001","case":"CFD-BASELINE"}'
```

Le job est autorisé uniquement pour `CFD-BASELINE` ou `CFD-INDEPENDENT`. Les cas sont montés en lecture seule depuis `pilot_case/PILOT-LH2-001/cases`; les artefacts sont écrits dans le volume Docker `lh2-cfd-artifacts`. Le manifeste contient le code retour, le journal, les hachages et, quel que soit le résultat, `scientificStatus: INCONCLUSIVE` et `validationAllowed: false`.

### Variables de service API

L’API FastAPI utilise :

```text
LH2_CFD_WORKER_URL=http://lh2-cfd-worker:8080
LH2_CFD_WORKER_TOKEN=<secret hors dépôt>
```

Les routes sont `GET /v1/cfd-worker/health` et `POST /v1/cfd-worker/jobs`. Elles exigent l’en-tête `X-Worker-Token`. L’API transmet uniquement la demande au worker et ne transforme pas un code retour zéro en validation scientifique.

### Déploiement recommandé

Vercel/Next.js ne doit pas héberger le solveur OpenFOAM : le déploiement de production est serverless et ne fournit ni image OpenFOAM, ni volume persistant, ni calcul long. Le worker doit être déployé sur une VM Docker, un runner Kubernetes ou un service de calcul persistant avec volume durable. Le réseau entrant doit être limité à l’API, et le secret `LH2_CFD_WORKER_TOKEN` doit être fourni par le gestionnaire de secrets de l’infrastructure.

Le runner doit être exécuté deux fois dans des dossiers de sortie différents, avec des paramètres indépendants et des manifestes séparés. L’import dans Supabase ne doit être autorisé qu’après contrôle des champs finis, des résidus, des bilans masse-énergie, des artefacts et des hachages. Tant que G0–G6 ne sont pas toutes satisfaites, l’interface doit afficher `INCONCLUSIVE`.

## English

This worker is the external compute component for `PILOT-LH2-001`. It runs `reactingTwoPhaseEulerFoam` in an OpenFOAM 2512 image, preserves outputs in a durable volume, and writes a SHA-256 manifest for every job. It never decides `VALIDATED`; the G0–G6 evidence service remains authoritative.

### Local start

```bash
docker compose -f infrastructure/cfd-worker/docker-compose.yml build
docker compose -f infrastructure/cfd-worker/docker-compose.yml up -d
curl http://127.0.0.1:8080/health
curl -X POST http://127.0.0.1:8080/jobs \\
  -H 'Content-Type: application/json' \\
  -d '{"pilotId":"PILOT-LH2-001","case":"CFD-BASELINE"}'
```

Only `CFD-BASELINE` and `CFD-INDEPENDENT` are accepted. Cases are mounted read-only from `pilot_case/PILOT-LH2-001/cases`; artifacts are written to the persistent Docker volume `lh2-cfd-artifacts`. Every manifest contains the return code, log, hashes, `scientificStatus: INCONCLUSIVE`, and `validationAllowed: false`.

Vercel/Next.js must not host OpenFOAM itself: the production deployment is serverless and does not provide the OpenFOAM image, durable volumes, or long-running compute required here. Deploy the worker on a Docker VM, Kubernetes runner, or persistent compute service. Restrict ingress to the API and keep `LH2_CFD_WORKER_TOKEN` outside the repository.
