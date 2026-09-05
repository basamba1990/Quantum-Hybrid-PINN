# Runner externe → sidecar → QuantumPINN

## Principe

Le script `run_external_solver.py` automatise uniquement une chaîne déterministe :

```text
configuration
→ lancement de la commande solveur
→ vérification du code retour
→ vérification des VTU récents
→ ingestion déterministe des VTU
→ recalcul SHA-256
→ vérification du contrat
→ import QuantumPINN facultatif
```

Le runner est **fail-closed** : il refuse `validation_allowed=true`, un solveur sans VTU, un import sans token, un sidecar invalide et un statut d’import inattendu.

## Configuration réelle

Copier le modèle :

```bash
cp config.example.json config.local.json
```

Modifier uniquement les valeurs locales non secrètes :

```json
{
  "case_id": "LH2_EXTERNAL_SOLVER_RUN_001",
  "project_id": "UUID_PROJET",
  "owner_id": "UUID_PROPRIETAIRE",
  "case_dir": "/data/cryofoam/case",
  "solver_command": [
    "docker", "run", "--rm",
    "--network", "none",
    "-v", "/data/cryofoam/case:/case:ro",
    "-v", "/data/cryofoam/output:/output:rw",
    "cryofoam-image@sha256:DIGEST_REEL",
    "solver", "/case", "/output"
  ],
  "solver_output_dir": "/data/cryofoam/output",
  "sidecar_template": "/data/Quantum-Hybrid-PINN/pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/runner/sidecar.template.json",
  "timeout_seconds": 86400,
  "import_url": "https://api.example/v2/cfd/import",
  "validation_allowed": false
}
```

Le digest Docker doit provenir de l’image réellement obtenue et être enregistré dans le sidecar. Ne jamais utiliser `:latest`.

## Lancer sans importer

Pour exécuter le solveur et produire les artefacts sans appel API :

```bash
unset CFD_IMPORT_API_TOKEN
python3 runner/run_external_solver.py runner/config.local.json
```

Si `import_url` est vide, le runner s’arrête après la vérification locale.

## Lancer avec import QuantumPINN

```bash
export CFD_IMPORT_API_TOKEN='secret-interservices-local'
export QUANTUMPINN_IMPORT_URL='https://backend.example/v2/cfd/import'
python3 runner/run_external_solver.py runner/config.local.json \
  --run-dir /data/runs/lh2-run-001
```

Le runner envoie les VTU et `sidecar.json` en multipart. Il accepte uniquement une réponse dont le statut reste `UNVALIDATED` ou `STRUCTURAL_TEST_UNVALIDATED`.

## Test local de l’orchestrateur

Ce test ne lance aucun solveur CFD. Il copie des frames synthétiques uniquement pour valider le contrôle de chaîne :

```bash
cd /home/ubuntu/Quantum-Hybrid-PINN
cat > /tmp/contract-runner.json <<EOF
{
  "case_id": "CONTRACT_TEST_ONLY",
  "project_id": "11111111-1111-4111-8111-111111111111",
  "owner_id": "22222222-2222-4222-8222-222222222222",
  "case_dir": "/tmp",
  "solver_command": [
    "python3",
    "pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/runner/mock_solver_for_contract_test.py",
    "{CASE_DIR}",
    "{OUTPUT_DIR}"
  ],
  "solver_output_dir": "/tmp/quantumpinn-contract-output",
  "sidecar_template": "artifacts/synthetic_lh2_vtu/sidecar.json",
  "timeout_seconds": 60,
  "validation_allowed": false
}
EOF
python3 pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/runner/run_external_solver.py \
  /tmp/contract-runner.json \
  --run-dir /tmp/quantumpinn-contract-run
```

Le résultat doit rester `UNVALIDATED`. Ce test ne doit jamais être cité comme résultat CFD.

## Entrées attendues du vrai solveur

Le solveur doit écrire des VTU contenant au minimum des champs numériques avec unités documentées dans `fieldDescriptors`. Pour un cas VOF LH₂, prévoir notamment :

```text
alpha_l ou alpha_v
T ou h
p
U
rho_l / rho_v ou rho
```

Les résidus, bilans de masse et d’énergie doivent être exportés séparément ou ajoutés au sidecar à partir des fichiers réellement produits par le solveur.

## Artifacts de chaque run

```text
run-dir/
├── config.snapshot.json
├── solver.stdout.log
├── solver.stderr.log
└── artifacts/
    ├── frame_0000.vtu
    ├── frame_0001.vtu
    └── sidecar.json
```

Le dossier doit être conservé avec le commit du solveur, le digest Docker, le CAD, le maillage et les fichiers d’entrée hashés. Aucun fichier ne doit être remplacé après génération du sidecar sans régénérer et revérifier les hashes.
