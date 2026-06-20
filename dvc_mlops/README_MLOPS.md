# Pipeline MLOps - Quantum-Hybrid-PINN V8.1

## 📋 Vue d'ensemble

Ce pipeline DVC automatise l'entraînement complet du système PINN hybride sur **8 scénarios industriels** avec versioning, validation croisée et intégration Supabase.

### Architecture du Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Préparation des Données (Multi-Scénarios)            │
│ - Extraction des données brutes OpenFOAM                       │
│ - Normalisation et augmentation                                │
│ - Split train/val/test                                         │
└──────────────────┬──────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼──────────┐
│ PHASE 2: FNO   │   │ PHASE 3: PINN V8  │
│ Entraînement   │   │ Entraînement      │
│ (200 epochs)   │   │ (5000 epochs)     │
└───────┬────────┘   └────────┬──────────┘
        │                     │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ PHASE 4: Kalman     │
        │ Filter Training     │
        │ (500 epochs)        │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ PHASE 5: Évaluation │
        │ Validation Croisée  │
        │ (Tous Scénarios)    │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ PHASE 6: Rapports   │
        │ Versioning          │
        │ Supabase Upload     │
        └─────────────────────┘
```

---

## 🚀 Démarrage Rapide

### 1. Installation des Dépendances

```bash
cd dvc_mlops
pip install -r requirements.txt
pip install dvc dvc-s3  # Pour le stockage distant
```

### 2. Initialisation du Projet DVC

```bash
dvc init
dvc remote add -d myremote s3://my-bucket/dvc-storage  # Optionnel
```

### 3. Exécution du Pipeline Complet

```bash
# Exécuter toutes les phases
dvc repro

# Ou exécuter une phase spécifique
dvc repro -s prepare
dvc repro -s train_fno
dvc repro -s train_pinn
```

### 4. Visualiser les Résultats

```bash
# Afficher les métriques
dvc metrics show

# Comparer les versions
dvc plots show

# Voir l'historique des exécutions
dvc exp show
```

---

## 📊 Configuration des Scénarios

### Scénarios Supportés

| Scénario | Description | Cas d'Usage |
|----------|-------------|-----------|
| **H2_PIPELINE** | Transport d'hydrogène en pipeline | Infrastructure énergétique |
| **LH2_STORAGE** | Stockage d'hydrogène liquéfié | Stations de ravitaillement |
| **H2_COMPRESSION_STATION** | Station de compression H2 | Augmentation de pression |
| **MINING_INDUSTRIAL_SIM** | Ventilation minière | Sécurité souterraine |
| **CRYOGENIC_TRANSPORT** | Transport cryogénique | Logistique LH2/GNL |
| **PIPELINE_SAFETY** | Détection de fuite pipeline | Surveillance de sécurité |
| **PORT_ENERGY_OPTIMIZATION** | Optimisation énergétique portuaire | Efficacité énergétique |
| **ROCK_ELAST_STRESS** | Contrainte élastique de roche | Génie civil |

### Modifier les Scénarios d'Entraînement

Éditer `params.yaml` :

```yaml
pinn_scenarios: 
  - "H2_PIPELINE"
  - "H2_COMPRESSION_STATION"
  - "MINING_INDUSTRIAL_SIM"
  # Ajouter/retirer des scénarios selon les besoins
```

---

## 🔧 Paramètres d'Entraînement

### PINN V8 (Physics-Informed Neural Network)

```yaml
pinn_epochs: 5000              # Nombre d'itérations
pinn_learning_rate: 0.001      # Taux d'apprentissage
pinn_N_pde: 5000               # Points PDE pour les résidus
pinn_layers: [4, 128, 128, 128, 5]  # Architecture du réseau

# Paramètres physiques
fluid_type: "H2"               # Type de fluide
residual_threshold: 0.01       # Seuil de convergence

# Techniques avancées
enable_mc_dropout: true        # Incertitude via MC Dropout
enable_ood_detection: true     # Détection hors-distribution
```

### FNO (Fourier Neural Operator)

```yaml
epochs: 200                    # Itérations FNO
n_modes: 12                    # Modes de Fourier
width: 32                      # Largeur du réseau
fno_batch_size: 32             # Taille du batch
early_stopping_patience: 20    # Arrêt anticipé
```

### Deep Kalman Filter

```yaml
kalman_state_dim: 5            # Dimension de l'état
kalman_observation_dim: 3      # Dimension des observations
kalman_hidden_dim: 64          # Couche cachée
kalman_epochs: 500             # Itérations d'entraînement
```

---

## 📈 Métriques et Validation

### Métriques Automatiques

Le pipeline génère automatiquement :

- **`metrics/pinn_metrics.json`** - Métriques PINN (résidus, loss)
- **`metrics/fno_metrics.json`** - Métriques FNO (MAE, RMSE)
- **`metrics/kalman_metrics.json`** - Métriques Kalman (innovation, gain)
- **`metrics/eval_metrics.json`** - Évaluation croisée
- **`metrics/residuals_analysis.json`** - Analyse détaillée des résidus
- **`metrics/scenario_performance.json`** - Performance par scénario

### Validation Croisée

```yaml
validation_type: "cross_scenario"  # Tester chaque scénario
```

Options :
- `cross_scenario` : Chaque scénario testé sur tous les modèles
- `temporal` : Validation temporelle (train passé, test futur)
- `spatial` : Validation spatiale (train région A, test région B)
- `hybrid` : Combinaison des trois

### Seuils de Validation

```yaml
residual_tolerance_continuity: 1e-4
residual_tolerance_momentum: 1e-4
residual_tolerance_energy: 1e-3
credibility_score_threshold: 70.0
```

---

## 🔄 Intégration Supabase

### Configuration

```yaml
supabase:
  enabled: true
  project_url: "https://your-project.supabase.co"
  upload_models: true
  upload_metrics: true
  upload_reports: true
  versioning_strategy: "semantic"
```

### Automatisation

Le pipeline pousse automatiquement vers Supabase :

1. **Modèles entraînés** → Table `model_registry`
2. **Métriques** → Table `training_metrics`
3. **Rapports** → Storage `mlops_reports`

### Requête Supabase pour Récupérer les Modèles

```sql
SELECT 
  id, 
  model_name, 
  version, 
  scenario, 
  credibility_score, 
  created_at
FROM model_registry
WHERE version = '8.1.0'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📝 Exécution Manuelle des Phases

### Phase 1 : Préparation

```bash
python src/prepare.py \
  --case_path data/raw/simulations \
  --output_dir data/processed \
  --scenarios all
```

### Phase 2 : Entraînement FNO

```bash
python src/train_fno.py \
  --train_data_path data/processed/train.npz \
  --val_data_path data/processed/val.npz \
  --model_output_path models/fno_model.pt \
  --epochs 200 \
  --scenarios H2_PIPELINE,LH2_STORAGE
```

### Phase 3 : Entraînement PINN

```bash
python src/train_pinn.py \
  --epochs 5000 \
  --learning_rate 0.001 \
  --N_pde 5000 \
  --model_output_path models/pinn_model.pt \
  --scenarios H2_PIPELINE,H2_COMPRESSION_STATION
```

### Phase 4 : Entraînement Kalman

```bash
python src/train_kalman.py \
  --train_data_path data/processed/train.npz \
  --model_output_path models/deep_kalman_filter.pt \
  --epochs 500
```

### Phase 5 : Évaluation

```bash
python src/evaluate.py \
  --pinn_model_path models/pinn_model.pt \
  --fno_model_path models/fno_model.pt \
  --kalman_model_path models/deep_kalman_filter.pt \
  --test_data_path data/processed/val.npz \
  --scenarios H2_PIPELINE,H2_COMPRESSION_STATION
```

---

## 🔍 Debugging et Troubleshooting

### Vérifier l'État du Pipeline

```bash
# Voir les dépendances
dvc dag

# Voir les fichiers de sortie
dvc status

# Voir les fichiers manquants
dvc status --check
```

### Réinitialiser une Phase

```bash
# Supprimer les sorties d'une phase
dvc remove dvc.yaml:train_pinn

# Réexécuter la phase
dvc repro -s train_pinn
```

### Logs Détaillés

```bash
# Exécuter avec logs verbeux
dvc repro -v

# Voir les logs d'une phase spécifique
dvc repro -s train_pinn -v
```

---

## 📦 Artefacts Générés

Après une exécution complète, le pipeline génère :

```
models/
├── pinn_model.pt                 # Modèle PINN entraîné
├── pinn_checkpoint_best.pt       # Checkpoint meilleur modèle
├── pinn_scaler.pkl               # Normalisateur des données
├── fno_model.pt                  # Modèle FNO entraîné
├── fno_checkpoint_best.pt        # Checkpoint FNO
└── deep_kalman_filter.pt         # Filtre Kalman entraîné

metrics/
├── pinn_metrics.json             # Métriques PINN
├── fno_metrics.json              # Métriques FNO
├── kalman_metrics.json           # Métriques Kalman
├── eval_metrics.json             # Évaluation croisée
├── residuals_analysis.json       # Analyse résidus
└── scenario_performance.json     # Performance par scénario

reports/
├── mlops_report.md               # Rapport complet
└── model_registry.json           # Registre des modèles

data/processed/
├── train.npz                     # Données d'entraînement
├── val.npz                       # Données de validation
├── metadata.json                 # Métadonnées
└── scenarios_manifest.json       # Manifeste des scénarios
```

---

## 🎯 Objectifs de Performance

| Métrique | Cible | Statut |
|----------|-------|--------|
| **Résidu Continuité** | < 1e-4 | ⏳ À valider |
| **Résidu Momentum** | < 1e-4 | ⏳ À valider |
| **Résidu Énergie** | < 1e-3 | ⏳ À valider |
| **Score Crédibilité** | > 70% | ⏳ À valider |
| **Temps d'Inférence** | < 100ms | ⏳ À valider |
| **Couverture Scénarios** | 8/8 | ⏳ À valider |

---

## 📚 Ressources Supplémentaires

- **DVC Documentation:** https://dvc.org/doc
- **PINN Research:** https://arxiv.org/abs/1711.10566
- **FNO Paper:** https://arxiv.org/abs/2010.08895
- **Kalman Filter:** https://en.wikipedia.org/wiki/Kalman_filter

---

## 📞 Support

Pour des questions ou des problèmes :
- Consultez le document `CORRECTIONS_CRITIQUES_V8.md`
- Vérifiez les logs dans `dvc.log`
- Ouvrez une issue sur GitHub

---

**Version:** 8.1.0  
**Dernière mise à jour:** 20 Juin 2026  
**Auteur:** Manus AI
