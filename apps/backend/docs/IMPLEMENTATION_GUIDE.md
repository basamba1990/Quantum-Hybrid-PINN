# Guide d'Implémentation : Quantum-Hybrid-PINN

**Version**: 1.0.0  
**Date**: 4 mai 2026  
**Auteur**: Manus AI

## 1. Vue d'ensemble

Ce guide documente l'implémentation des corrections industrielles pour le système Quantum-Hybrid-PINN. Les corrections adressent les défaillances observées lors de l'exécution de simulations hybrides CFD-ML en résolvant les problèmes de chemins, de dimensions et de généralisation du modèle.

## 2. Architecture de la Solution

### 2.1 Composants Principaux

L'architecture se compose de cinq modules interconnectés :

| Module | Responsabilité | Fichier |
|--------|-----------------|---------|
| **PathValidator** | Validation des chemins OpenFOAM avant exécution | `api/path_validator.py` |
| **FastAPI Main** | Endpoints REST pour validation et simulation | `api/main.py` |
| **InterpolationLayer** | Adaptation dynamique des dimensions des données | `api/interpolation_layer.py` |
| **MLPredictor** | Prédicteur ML généraliste avec support multi-grille | `api/ml_predictor.py` |
| **MasterCaseGenerator** | Création de cas OpenFOAM paramétrables | `scripts/create_master_case.py` |

### 2.2 Flux de Traitement

```
Requête de Simulation
    ↓
[PathValidator] → Validation du chemin du cas
    ↓ (Succès)
[OpenFOAM] → Exécution CFD
    ↓
[InterpolationLayer] → Adaptation des dimensions
    ↓
[MLPredictor] → Prédiction ML
    ↓
Résultat Hybride CFD-ML
```

## 3. Phase 1 : Validation des Chemins

### 3.1 Fonctionnalités

Le module `PathValidator` fournit :

- **Validation stricte** : Vérification de l'existence et de l'accessibilité des répertoires
- **Vérification structurelle** : Contrôle de la présence des répertoires et fichiers obligatoires
- **Rapports détaillés** : Messages d'erreur clairs et codes d'erreur standardisés
- **Listing des cas** : Énumération des cas disponibles et invalides

### 3.2 Utilisation

```python
from api.path_validator import PathValidator

# Initialiser le validateur
validator = PathValidator(base_path="/home/ubuntu/cases")

# Valider un cas par nom
result = validator.validate_case_path("h2_pipeline")
if result.is_valid:
    print(f"Case is valid: {result.path}")
else:
    print(f"Error: {result.error_message}")

# Valider un chemin absolu
result = validator.validate_absolute_path("/home/ubuntu/cases/h2_pipeline")

# Lister les cas disponibles
cases = validator.list_available_cases()
print(f"Available cases: {cases['total_available']}")
```

### 3.3 Codes d'Erreur

| Code | Description | Action |
|------|-------------|--------|
| `CASE_NOT_FOUND` | Répertoire du cas inexistant | Créer le cas ou vérifier le chemin |
| `PATH_NOT_DIRECTORY` | Le chemin existe mais n'est pas un répertoire | Vérifier le chemin |
| `PERMISSION_DENIED` | Permissions insuffisantes | Ajuster les permissions |
| `MISSING_DIRECTORIES` | Répertoires OpenFOAM manquants | Créer la structure complète |

## 4. Phase 2 : Cas Master OpenFOAM

### 4.1 Création du Cas Master

Le script `create_master_case.py` génère un cas OpenFOAM complet et fonctionnel :

```bash
cd /home/ubuntu/quantum-hybrid-pinn
python3 scripts/create_master_case.py
```

### 4.2 Structure Créée

```
/home/ubuntu/cases/h2_pipeline/
├── system/
│   ├── controlDict          # Paramètres de simulation
│   ├── fvSchemes            # Schémas numériques
│   └── fvSolution           # Solveurs et relaxation
├── constant/
│   ├── transportProperties  # Propriétés du fluide
│   ├── turbulenceProperties # Modèle de turbulence
│   └── polyMesh/            # Maillage
│       ├── points           # Sommets
│       ├── faces            # Faces
│       ├── owner            # Propriétaires
│       ├── neighbour        # Voisins
│       └── boundary         # Conditions aux limites
└── 0/
    ├── U                    # Champ de vitesse
    ├── p                    # Champ de pression
    ├── k                    # Énergie cinétique turbulente
    └── epsilon              # Dissipation turbulente
```

### 4.3 Paramétrage

Le cas Master peut être adapté en modifiant les fichiers :

- **Géométrie** : Éditer `constant/polyMesh/points`
- **Conditions aux limites** : Modifier les champs dans `0/`
- **Paramètres de simulation** : Ajuster `system/controlDict`

## 5. Phase 3 : Interpolation Intelligente

### 5.1 Fonctionnalités

Le module `InterpolationLayer` gère :

- **Détection automatique** : Identification de la forme source des données
- **Interpolation multi-méthode** : Support linéaire, nearest, cubique
- **Gestion des NaN** : Remplissage intelligent des valeurs invalides
- **Adaptation batch** : Traitement efficace de multiples données

### 5.2 Utilisation

```python
from api.interpolation_layer import DynamicInterpolationLayer
import numpy as np

# Initialiser la couche d'interpolation
interpolator = DynamicInterpolationLayer(target_shape=(32, 32, 32))

# Adapter des données 3D
data = np.random.randn(16, 16, 16)
adapted = interpolator.adapt_data_dynamic(data)
print(f"Adapted shape: {adapted.shape}")  # (32, 32, 32)

# Adapter un batch
batch = np.random.randn(4, 16, 16, 16)
adapted_batch = interpolator.adapt_batch(batch)
print(f"Adapted batch shape: {adapted_batch.shape}")  # (4, 32, 32, 32)

# Obtenir les infos d'adaptation
info = interpolator.get_adaptation_info()
print(f"Scaling factors: {info['scaling_factors']}")
```

## 6. Phase 4 : Prédicteur ML Généraliste

### 6.1 Fonctionnalités

Le module `MLPredictor` fournit :

- **Adaptation automatique** : Gestion des différentes tailles de grille
- **Normalisation** : Prétraitement et post-traitement des données
- **Factory Pattern** : Création facile de prédicteurs pour différents cas
- **Batch Processing** : Traitement efficace de multiples prédictions

### 6.2 Utilisation

```python
from api.ml_predictor import MLPredictorFactory
import numpy as np

# Créer un prédicteur pour le cas H2 Pipeline
predictor = MLPredictorFactory.create_predictor("h2_pipeline")

# Effectuer une prédiction
input_data = np.random.randn(16, 16, 16)
prediction = predictor.predict(input_data)
print(f"Prediction shape: {prediction.shape}")  # (32, 32, 32)

# Obtenir les infos d'adaptation
prediction, info = predictor.predict(input_data, return_adaptation_info=True)
print(f"Adaptation info: {info}")

# Batch prediction
batch = np.random.randn(4, 16, 16, 16)
predictions = predictor.predict_batch(batch)
print(f"Predictions shape: {predictions.shape}")  # (4, 32, 32, 32)
```

### 6.3 Configuration des Cas

Les cas sont configurés dans `MLPredictorFactory.CASE_CONFIGS` :

```python
CASE_CONFIGS = {
    "h2_pipeline": {
        "model_input_shape": (32, 32, 32),
        "model_name": "fno_h2_pipeline",
        "normalization_required": True
    },
    "lh2_storage": {
        "model_input_shape": (32, 32, 32),
        "model_name": "fno_lh2_storage",
        "normalization_required": True
    },
    "nh3_synthesis": {
        "model_input_shape": (32, 32, 32),
        "model_name": "fno_nh3_synthesis",
        "normalization_required": True
    }
}
```

Pour ajouter un nouveau cas :

```python
MLPredictorFactory.register_case_config("new_case", {
    "model_input_shape": (32, 32, 32),
    "model_name": "fno_new_case",
    "normalization_required": True
})
```

## 7. API REST

### 7.1 Endpoints de Validation

#### Valider un cas par nom

```
POST /validate/case-path
Content-Type: application/json

{
  "case_name": "h2_pipeline"
}

Response (200):
{
  "is_valid": true,
  "case_name": "h2_pipeline",
  "path": "/home/ubuntu/cases/h2_pipeline",
  "details": {
    "size_mb": 5.2
  }
}

Response (400):
{
  "error_code": "CASE_NOT_FOUND",
  "error_message": "Case directory not found: /home/ubuntu/cases/h2_pipeline",
  "details": {...}
}
```

#### Valider un chemin absolu

```
POST /validate/absolute-path
Content-Type: application/json

{
  "absolute_path": "/home/ubuntu/cases/h2_pipeline"
}
```

#### Lister les cas disponibles

```
GET /cases/list

Response (200):
{
  "available_cases": [
    {
      "name": "h2_pipeline",
      "path": "/home/ubuntu/cases/h2_pipeline",
      "details": {"size_mb": 5.2}
    }
  ],
  "invalid_cases": [],
  "total_available": 1,
  "total_invalid": 0
}
```

### 7.2 Endpoints de Simulation

#### Lancer une simulation hybride

```
POST /hybrid/run-simulation
Content-Type: application/json

{
  "case_name": "h2_pipeline",
  "simulation_name": "h2_test_001",
  "ml_weight": 0.5,
  "timeout_seconds": 3600
}

Response (202):
{
  "job_id": "80a0d1f9-1178-4b06-9a4f-72c3fbcc9bc8",
  "case_name": "h2_pipeline",
  "simulation_name": "h2_test_001",
  "status": "PENDING",
  "created_at": "2026-05-04T02:24:30.000000",
  "message": "Simulation job 80a0d1f9-1178-4b06-9a4f-72c3fbcc9bc8 accepted and queued for execution"
}

Response (400):
{
  "error": "Case path validation failed",
  "error_code": "CASE_NOT_FOUND",
  "error_message": "Case directory not found: /home/ubuntu/cases/h2_pipeline",
  "details": {...}
}
```

#### Obtenir le statut d'un job

```
GET /hybrid/job/{job_id}

Response (200):
{
  "job_id": "80a0d1f9-1178-4b06-9a4f-72c3fbcc9bc8",
  "case_name": "h2_pipeline",
  "simulation_name": "h2_test_001",
  "status": "RUNNING",
  "created_at": "2026-05-04T02:24:30.000000",
  "ml_weight": 0.5,
  "timeout_seconds": 3600,
  "case_path": "/home/ubuntu/cases/h2_pipeline",
  "case_details": {...}
}
```

#### Lister tous les jobs

```
GET /hybrid/jobs

Response (200):
{
  "total_jobs": 3,
  "jobs": [...]
}
```

## 8. Tests et Validation

### 8.1 Exécuter les Tests

```bash
cd /home/ubuntu/quantum-hybrid-pinn
python3 -m unittest tests.test_path_validator -v
```

### 8.2 Résultats Attendus

```
test_invalid_result_to_dict ... ok
test_valid_result_to_dict ... ok
test_list_available_cases_empty ... ok
test_list_available_cases_mixed ... ok
test_validate_absolute_path_file ... ok
test_validate_absolute_path_nonexistent ... ok
test_validate_case_missing_directories ... ok
test_validate_nonexistent_case ... ok
test_validate_valid_case ... ok

Ran 9 tests in 0.005s
OK
```

## 9. Déploiement

### 9.1 Installation des Dépendances

```bash
pip install -r requirements.txt
```

### 9.2 Lancer l'API

```bash
cd /home/ubuntu/quantum-hybrid-pinn/api
python3 main.py
```

L'API sera disponible sur `http://0.0.0.0:8080`.

### 9.3 Vérifier la Santé de l'API

```bash
curl http://localhost:8080/health
```

## 10. Bonnes Pratiques

### 10.1 Gestion des Erreurs

Toujours vérifier le statut de validation avant de lancer une simulation :

```python
result = validator.validate_case_path("h2_pipeline")
if not result.is_valid:
    print(f"Validation failed: {result.error_message}")
    # Prendre une action corrective
else:
    # Procéder à la simulation
```

### 10.2 Normalisation des Données

Charger les statistiques de normalisation avant les prédictions :

```python
predictor.load_normalization_stats("path/to/stats.npz")
prediction = predictor.predict(input_data)
```

### 10.3 Monitoring

Surveiller les jobs en arrière-plan :

```python
import time

job_id = "80a0d1f9-1178-4b06-9a4f-72c3fbcc9bc8"
while True:
    status = get_job_status(job_id)
    if status["status"] in ["COMPLETED", "FAILED"]:
        break
    time.sleep(5)
```

## 11. Troubleshooting

### Problème : "Case path not found"

**Cause** : Le répertoire du cas n'existe pas au chemin spécifié.

**Solution** :
1. Vérifier le chemin avec `validator.list_available_cases()`
2. Créer le cas avec `create_master_case.py`
3. Vérifier les permissions du répertoire

### Problème : "MISSING_DIRECTORIES"

**Cause** : La structure OpenFOAM est incomplète.

**Solution** :
1. Utiliser le cas Master comme référence
2. Copier les répertoires manquants
3. Vérifier la structure avec `validator.validate_case_path()`

### Problème : Dimensions incompatibles

**Cause** : Les données OpenFOAM ont une taille différente de celle attendue par le modèle.

**Solution** :
1. L'interpolation est appliquée automatiquement
2. Vérifier les logs pour les infos d'adaptation
3. Ajuster les paramètres d'interpolation si nécessaire

## 12. Conclusion

Cette implémentation fournit une solution robuste et industrielle pour le système Quantum-Hybrid-PINN. Les corrections adressent les défaillances observées et améliorent la flexibilité et la fiabilité de la plateforme.

Pour toute question ou problème, consulter les logs détaillés et les messages d'erreur spécifiques fournis par chaque module.
