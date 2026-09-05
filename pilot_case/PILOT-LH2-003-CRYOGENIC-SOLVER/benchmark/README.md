# Benchmark public minimal — test immédiat du pipeline

## Nature du benchmark

Le paquet réutilise `artifacts/synthetic_lh2_vtu`, un jeu de données synthétique déjà couvert par le contrat d’import QuantumPINN. Il teste :

- la lecture de VTU ;
- la topologie identique entre frames ;
- le calcul SHA-256 ;
- le contrat `cfd-volume.v1` ;
- le sidecar ;
- le chemin d’import.

Il ne s’agit **pas** d’un calcul VOF physique, ni d’une validation LH₂, ni d’une preuve de solveur. Le statut attendu est `STRUCTURAL_TEST_UNVALIDATED`.

## Exécution immédiate sans Docker

Depuis la racine du dépôt :

```bash
cd /home/ubuntu/Quantum-Hybrid-PINN
bash pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/run_benchmark.sh
```

Vérification directe :

```bash
python3 pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/scripts/generate_sidecar.py \
  pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/run/synthetic_vof_reference

python3 pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/scripts/verify_sidecar.py \
  pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/run/synthetic_vof_reference
```

Test canonique du parseur :

```bash
cd apps/api
python3 -m pytest tests/test_cfd_import_manual.py tests/test_cfd_import_endpoint.py -q
```

## Import local via l’endpoint FastAPI

Le serveur API doit être démarré avec `CFD_IMPORT_API_TOKEN` configuré. Exemple :

```bash
export CFD_IMPORT_API_TOKEN='token-local-uniquement'
cd apps/api
uvicorn main:app --host 127.0.0.1 --port 8000
```

Dans un second terminal :

```bash
cd /home/ubuntu/Quantum-Hybrid-PINN
RUN='pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/run/synthetic_vof_reference'

curl --fail-with-body -X POST 'http://127.0.0.1:8000/v2/cfd/import' \
  -H "Authorization: Bearer ${CFD_IMPORT_API_TOKEN}" \
  -F 'case_id=LH2_PUBLIC_STRUCTURAL_BENCHMARK' \
  -F 'project_id=11111111-1111-4111-8111-111111111111' \
  -F 'owner_id=22222222-2222-4222-8222-222222222222' \
  -F "vtu_files=@${RUN}/frame_0000.vtu;type=application/xml" \
  -F "vtu_files=@${RUN}/frame_0001.vtu;type=application/xml" \
  -F "sidecar=@${RUN}/sidecar.json;type=application/json"
```

Réponse attendue pour ce jeu synthétique :

```json
{
  "status": "STRUCTURAL_TEST_UNVALIDATED",
  "frameCount": 2
}
```

L’API doit refuser un VTU modifié dont le `payloadHash` ne correspond plus.

## Test de refus d’un hash falsifié

```bash
python3 - <<'PY'
import json
from pathlib import Path
p = Path('pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/run/synthetic_vof_reference/sidecar.json')
d = json.loads(p.read_text())
d['frames'][0]['payloadHash'] = '0' * 64
Path('/tmp/sidecar-tampered.json').write_text(json.dumps(d))
PY
```

Un import avec `/tmp/sidecar-tampered.json` doit répondre HTTP `422` avec une erreur `SHA-256 invalide`.

## Exécution Docker immédiate

Depuis le répertoire du benchmark :

```bash
cd /home/ubuntu/Quantum-Hybrid-PINN/pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml run --rm public-vof-contract-benchmark
```

Les artefacts apparaissent dans `run/docker/`. Cette image teste le runner, la génération du sidecar, les hashes et le parseur QuantumPINN ; elle n'exécute pas encore un solveur VOF physique LH₂.

## Docker : séparation runner / import

Le benchmark de contrat ne nécessite pas de solveur cryogénique. Lorsque le solveur réel sera obtenu, le pipeline Docker devra séparer :

```text
image solveur épinglée par digest
→ volume d’entrée en lecture seule
→ volume de sortie dédié
→ runner
→ vérification résidus/bilans
→ conversion VTU
→ sidecar
→ import QuantumPINN
```

Ne pas appeler ce benchmark `PRODUCTION` et ne pas l’utiliser pour passer G0–G6.
