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

Si Docker n'est pas installé sur Ubuntu :

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo service docker start
```

Depuis le répertoire du benchmark :

```bash
cd /home/ubuntu/Quantum-Hybrid-PINN/pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml run --rm public-vof-contract-benchmark
```

Les artefacts apparaissent dans `run/docker/`. Cette image teste le runner, la génération du sidecar, les hashes et le parseur QuantumPINN ; elle n'exécute pas encore un solveur VOF physique LH₂.

Si `docker compose` n'est pas disponible, utiliser directement Docker CLI :

```bash
cd /home/ubuntu/Quantum-Hybrid-PINN
sudo docker build --network=host \
  -f pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/Dockerfile \
  -t quantumpinn-lh2-contract-benchmark:local .

mkdir -p pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/run/docker

sudo docker run --rm --network none --read-only --tmpfs /tmp \
  -e OUT_DIR=/workspace/output \
  -v "$PWD/pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/run/docker:/workspace/output" \
  quantumpinn-lh2-contract-benchmark:local
```

Dans l'environnement de développement du dépôt, cette commande a réussi et a produit deux VTU et un sidecar vérifié. Le digest de l'image de base est épinglé dans le Dockerfile ; le digest final local peut être inspecté avec :

```bash
sudo docker image inspect quantumpinn-lh2-contract-benchmark:local --format '{{.Id}}'
```

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

## Remplacer par la sortie d’un solveur réel

Le solveur externe doit écrire ses VTU dans un répertoire de sortie, sans modifier le sidecar directement. Exemple :

```bash
SOLVER_OUT=/data/my-solver/run-001/VTU
DEST=/home/ubuntu/Quantum-Hybrid-PINN/pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/run/solver-001
TEMPLATE=/home/ubuntu/Quantum-Hybrid-PINN/artifacts/synthetic_lh2_vtu/sidecar.json

python3 scripts/ingest_solver_vtu.py "$SOLVER_OUT" "$DEST" "$TEMPLATE"
python3 scripts/verify_sidecar.py "$DEST"
```

L’adaptateur :

1. refuse un répertoire sans VTU ;
2. copie les VTU vers des noms déterministes `frame_0000.vtu`, etc. ;
3. recalcule le hash de chaque octet copié ;
4. conserve le contrat `cfd-volume.v1` ;
5. conserve les champs de provenance du template ;
6. marque la sortie `EXTERNAL_SOLVER_OUTPUT_UNVALIDATED` ;
7. ne passe jamais automatiquement à `VALIDATED`.

Les propriétés `fieldDescriptors`, `boundarySets`, `residuals`, `references` et `evidence` doivent ensuite être remplacées par les valeurs réellement produites par le solveur. Ne pas conserver les valeurs du template si elles ne décrivent pas le calcul externe.
