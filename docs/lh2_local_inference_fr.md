# Inférence LH2 locale sans hibernation Render

Le service Render Free ne doit pas être utilisé pour une inférence longue : l’instance peut être arrêtée et le modèle V8 conservé en mémoire est alors perdu. Cette procédure exécute l’API dans un processus local ou Docker, avec le modèle chargé au démarrage.

## Prérequis

Le dépôt ne contient aucun poids `.pt` ou `.pth`. Il faut fournir un modèle V8 entraîné séparément, par exemple dans `models/hydrogen_pinn_v8.pt`. Un modèle nouvellement initialisé mais non entraîné est acceptable uniquement pour un test structurel ; il ne constitue pas une preuve scientifique et ne peut pas débloquer G3.

Installer les dépendances de l’API :

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r apps/api/requirements.txt
```

Lancer l’API locale :

```bash
export V8_MODEL_PATH=$PWD/models/hydrogen_pinn_v8.pt
export PORT=8000
uvicorn apps.api.main:app --host 0.0.0.0 --port "$PORT"
```

Avant l’inférence, vérifier :

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS -X POST http://127.0.0.1:8000/v2/model/initialize \
  -H 'Content-Type: application/json' \
  -d '{"layers":[4,256,256,256,256,5],"fluid_type":"H2","use_fno":false}'

curl -fsS -X POST http://127.0.0.1:8000/v2/predict-batch \
  -H 'Content-Type: application/json' \
  -d '{"time":[0.0],"x":[0.0],"y":[0.0],"z":[0.0]}'
```

## Générer les frames

```bash
python3 tools/generate_lh2_vtu_from_pinn.py \
  --mesh /data/lh2_analytic_base.msh \
  --output /data/lh2-cad-analytic-frames \
  --api-base-url http://127.0.0.1:8000 \
  --times 0.000 0.005 0.010 0.015 0.020 0.025 0.030 0.035 \
  --batch-size 128 \
  --timeout 180 \
  --mesh-revision lh2-cad-analytic-v1
```

Le batch initial recommandé est 128. Augmenter à 256 ou 512 uniquement après validation de la mémoire et du temps de réponse.

## Contrôle obligatoire

Chaque frame doit contenir les mêmes `points` et le même bloc `tetra`. Les champs physiques peuvent varier, mais la connectivité ne doit jamais varier. Le manifeste doit être vérifié avant l’import. Si `alpha_liquid` ou `enthalpy` sont dérivés au lieu d’être émis par le solveur, le manifeste doit rester `g3Eligible: false`.

Les frames actuelles du kit historique ont 12 511 points et 75 381 tétraèdres. Le maillage CAD analytique possède 35 536 points et 189 105 tétraèdres. Elles ne sont donc pas interchangeables.
