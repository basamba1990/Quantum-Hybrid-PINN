# Analyse Comparative : NASA CHAMPS vs Quantum-Hybrid-PINN
## Pour la Génération de Tableaux de Bord HTML Autonomes

---

## 1. ARCHITECTURE NASA CHAMPS (Amir Khademi)

### Approche Générale
Le projet **Physics_Informed_digital_twins_NASA_CHAMPS** utilise une architecture **deux niveaux** :
- **Niveau 1** : Sélecteur de cycles (RUL, état de santé)
- **Niveau 2** : Étapes temporelles au sein d'un cycle

### Composants Clés

#### 1.1 Génération de Données (`generate_dt_data.py`)
- Lit les données d'entraînement NASA N-CMAPSS DS03
- Calcule les statistiques de baseline pour les capteurs sains (hs=1)
- Génère des **z-scores** par étape temporelle pour chaque capteur
- Exporte en JSON pour le dashboard

#### 1.2 Construction du Dashboard (`build_dt_html.py`)
- **Fichier unique HTML/CSS/JS** (~1577 lignes)
- Intègre les données JSON directement dans le HTML
- **Pas de dépendances externes** (pur vanilla JS)
- **Graphiques Canvas 2D** pour performance
- Calculs de **crédibilité** basés sur résidus physiques (Navier-Stokes)

### Caractéristiques du Dashboard NASA

| Élément | Implémentation |
|---------|-----------------|
| **Thème** | Dark mode (cyber-bleu, cyan, vert, rouge) |
| **Navigation** | Dropdown cycle + progress bar temporelle |
| **Capteurs** | Grille 7 colonnes avec cartes individuelles |
| **Anomalies** | Heatmap 2D (z-scores, senseurs × étapes) |
| **Santé Composants** | Barres de progression avec dégradé couleur |
| **Graphiques** | Canvas + SVG (performance temps réel) |
| **Calculs** | Tous côté client (aucun appel API) |

### Scores et Métriques NASA
```javascript
// Détection d'anomalies
drift = (stepVal - baseline.mean) / baseline.std
composite = Math.min(100, totalDrift * 20)

// États
NOMINAL (< 25%) → WATCH (25-50%) → ABNORMAL (50-75%) → CRITICAL (75%+)

// Couleurs
#00ff88 (vert) → #ffb830 (ambre) → #ff8030 (orange) → #ff3c3c (rouge)
```

---

## 2. ARCHITECTURE QUANTUM-HYBRID-PINN

### Approche Générale
Plateforme **monorepo** avec :
- **Backend FastAPI** : Modèles PINN, EOS quantique, moteurs physiques
- **Frontend Next.js** : Dashboard web avec authentification
- **MLOps** : DVC, MLflow pour reproducibilité

### Composants Clés

#### 2.1 Modèles Physiques (`hydrogen_pinn_v8.py`)
```python
class HydrogenPINNV8:
    - PINN3DNavierStokes (résolution équations fluides)
    - DeepKalmanFilter (assimilation de données)
    - SilveraGoldmanEOS (équation d'état quantique H₂)
    - MahalanobisOODDetector (détection anomalies)
```

#### 2.2 Moteurs de Simulation (`scenario_engines.py`)
**6 scénarios industriels** avec équations physiques réalistes :

| Scénario | Équations | Sortie |
|----------|-----------|--------|
| **H2_PIPELINE** | Navier-Stokes + Colebrook-White + JT | pressureDrop, velocity, turbulence, leakRisk |
| **LH2_STORAGE** | Évaporation + Convection naturelle | boilOffRate, internalPressure, stabilityScore |
| **PORT_ENERGY** | Bilan énergétique + COP | energyEfficiency, costReduction, carbonFootprint |
| **PIPELINE_SAFETY** | Propagation d'ondes acoustiques | detectionTime, predictionAccuracy, riskReduction |
| **CRYOGENIC_TRANSPORT** | Transfert thermique cryogénique | thermalLoss, evaporationLoss, containerSafety |
| **ROCK_ELAST_STRESS** | Contrainte lithostatique + Mazars | lithostaticPressure, maxStress, damageIndex |

#### 2.3 API FastAPI (`hydrogen_api.py`)
```python
POST /model/initialize       # Initialiser PINN
POST /model/train           # Entraîner sur données
POST /predict               # Prédiction unique
POST /predict/batch         # Batch predictions
GET  /model/status          # État du modèle
```

### Caractéristiques du Dashboard Quantum-Hybrid

| Élément | Implémentation |
|---------|-----------------|
| **Thème** | Dark mode (cyan, vert, magenta) |
| **Architecture** | Next.js + React + TypeScript |
| **Authentification** | OAuth2 + JWT |
| **Données** | Supabase + API FastAPI |
| **Graphiques** | Chart.js, Plotly |
| **Calculs** | Côté serveur (API) + client |

---

## 3. STRATÉGIE DE FUSION POUR TABLEAUX DE BORD AUTONOMES H₂

### Objectif
Créer un **générateur Python** qui produit des **fichiers HTML autonomes** (sans serveur) pour :
- **Pipeline H₂** (100-200 km)
- **Réservoir LH₂** (50-100 m³)
- **Stockage Géologique** (roche, contrainte, endommagement)

### Architecture Proposée

```
┌─────────────────────────────────────────────────────┐
│   H2-Digital-Twin-Generator (Python)                │
│                                                     │
│  1. Moteur SciML (scenario_engines + PINN)         │
│     ↓ Génère données physiques réalistes            │
│                                                     │
│  2. Calculateur de Résidus                         │
│     ↓ Navier-Stokes, thermodynamique, contrainte   │
│                                                     │
│  3. Détecteur d'Anomalies                          │
│     ↓ Mahalanobis OOD + z-scores                    │
│                                                     │
│  4. Générateur HTML Autonome                        │
│     ↓ Template NASA CHAMPS + données H₂             │
│                                                     │
└─────────────────────────────────────────────────────┘
         ↓
    digital_twin_H2_PIPELINE_100km.html
    digital_twin_LH2_STORAGE_50m3.html
    digital_twin_ROCK_STRESS_1000m.html
```

### Composants du Dashboard Autonome

#### 3.1 Structure HTML
```html
<!DOCTYPE html>
<html>
<head>
  <style>/* CSS autonome (Nexus Scientifique) */</style>
</head>
<body>
  <!-- Barre de titre avec paramètres -->
  <!-- Sélecteur de scénario / temps -->
  <!-- Cartes capteurs (pression, température, vitesse) -->
  <!-- Heatmap anomalies (z-scores) -->
  <!-- Graphiques Canvas (trajectoires, résiduels) -->
  <!-- Scores de crédibilité (physique validée) -->
  
  <script>
    const DATA = { /* JSON complet des données */ };
    const PINN_OUTPUTS = { /* Prédictions PINN */ };
    const RESIDUALS = { /* Résidus Navier-Stokes */ };
    const ANOMALY_SCORES = { /* Scores OOD */ };
    
    // Tous les calculs côté client
  </script>
</body>
</html>
```

#### 3.2 Données Intégrées (JSON)
```javascript
{
  "meta": {
    "scenario": "H2_PIPELINE",
    "geometry": { "length": 100000, "diameter": 0.5 },
    "conditions": { "pressure": 80e5, "temperature": 300 },
    "timestamp": "2026-06-07T12:00:00Z"
  },
  "pinn_predictions": {
    "pressure": [80e5, 79.5e5, ...],
    "velocity": [12.3, 12.2, ...],
    "temperature": [300, 298, ...],
    "density": [0.08, 0.081, ...]
  },
  "residuals": {
    "continuity": [1e-4, 1.2e-4, ...],
    "momentum": [2e-3, 2.1e-3, ...],
    "energy": [5e-4, 5.1e-4, ...]
  },
  "anomaly_scores": {
    "mahalanobis_distance": [0.5, 0.6, ...],
    "ood_detected": [false, false, ...],
    "credibility_score": 94.5
  }
}
```

#### 3.3 Calculs Côté Client (JavaScript)
```javascript
// Détection d'anomalies (z-scores)
function computeAnomalyScore(residuals, baseline) {
  const zscores = residuals.map((r, i) => 
    (r - baseline.mean[i]) / baseline.std[i]
  );
  return Math.min(100, zscores.reduce((a,b) => a + Math.abs(b)) * 10);
}

// Validation physique
function validateNavierStokes(rho, u, v, w, T) {
  // Calcul des résidus par différences finies
  const residual_continuity = computeContinuity(rho, u, v, w);
  const residual_momentum = computeMomentum(rho, u, v, w, T);
  return { residual_continuity, residual_momentum };
}

// Graphiques Canvas (performance)
function drawSensorHeatmap(canvas, sensors, anomalies) {
  const ctx = canvas.getContext('2d');
  // Rendu heatmap 2D (z-scores)
}
```

---

## 4. DONNÉES PHYSIQUES PAR SCÉNARIO

### 4.1 Pipeline H₂ (100 km)
```python
inputs = {
    'length': 100,           # km
    'diameter': 0.5,         # m
    'pressure': 80,          # bar
    'temperature': 300,      # K
    'flowRate': 2,           # kg/s
    'fluid': 'H2'
}

outputs = {
    'pressureDrop': 2.5,     # bar
    'velocity': 12.3,        # m/s
    'turbulence': 45.2,      # % (Re-based)
    'thermalStability': 298, # K
    'leakRisk': 15.3,        # %
    'safetyScore': 84.7      # %
}
```

### 4.2 Réservoir LH₂ (50 m³)
```python
inputs = {
    'volume': 50,            # m³
    'pressure': 1.2,         # bar
    'temperature': 20.3,     # K (point d'ébullition)
    'ambientTemp': 300       # K
}

outputs = {
    'boilOffRate': 0.45,     # % par jour
    'internalPressure': 1.25,# bar
    'convectionVelocity': 0.0012,  # m/s
    'stabilityScore': 97.8   # %
}
```

### 4.3 Stockage Géologique (Roche, 1000 m)
```python
inputs = {
    'depth': 1000,           # m
    'rock_type': 'generic_rock'
}

outputs = {
    'lithostaticPressure': 25.0,  # MPa
    'maxStress': 37.5,            # MPa
    'damageIndex': 0.056,         # (Mazars)
    'stabilityScore': 94.4        # %
}
```

---

## 5. RÉSIDUS PHYSIQUES À AFFICHER

### 5.1 Navier-Stokes (Pipeline)
```
∂ρ/∂t + ∇·(ρu) = 0                    (Continuité)
ρ(∂u/∂t + u·∇u) = -∇p + μ∇²u + f    (Momentum)
ρCp(∂T/∂t + u·∇T) = k∇²T + Φ        (Énergie)
```

**Résidus affichés** :
- L2-norm continuity : ||∂ρ/∂t + ∇·(ρu)||
- L2-norm momentum : ||ρ(∂u/∂t + u·∇u) + ∇p - μ∇²u||
- L2-norm energy : ||ρCp(∂T/∂t + u·∇T) - k∇²T||

### 5.2 Thermodynamique (Réservoir)
```
Évaporation : Q = U·A·ΔT
Pression : P = nRT/V (avec Z de Silvera-Goldman)
Stratification : Ra = g·β·ΔT·H³/(ν·α)
```

### 5.3 Élasticité (Roche)
```
σ_lith = ρ·g·h                        (Contrainte lithostatique)
σ_max = σ_lith × (1 + K₀)             (Contrainte maximale)
d = (σ_max / σ_c)² (Mazars)           (Endommagement)
```

---

## 6. SCORES DE CRÉDIBILITÉ

### Calcul Composite
```
credibility_score = 100 × (1 - mean(normalized_residuals))

normalized_residuals = [
    residual_continuity / threshold_continuity,
    residual_momentum / threshold_momentum,
    residual_energy / threshold_energy,
    ood_distance / threshold_ood
]
```

### Seuils par Scénario
| Scénario | Continuité | Momentum | Énergie | OOD |
|----------|-----------|----------|---------|-----|
| Pipeline | 1e-3 | 1e-2 | 5e-4 | 3.0 |
| Réservoir | 5e-4 | 5e-3 | 1e-4 | 2.5 |
| Roche | 1e-2 | 1e-1 | - | 2.0 |

---

## 7. FICHIERS À GÉNÉRER

### 7.1 Python Generator
```
h2_digital_twin_generator.py
├── ScenarioEngine (classe abstraite)
├── PipelineH2Engine
├── ReservoirLH2Engine
├── RockStressEngine
├── PhysicsValidator
├── AnomalyDetector
└── HTMLGenerator
```

### 7.2 HTML Templates
```
templates/
├── base_dashboard.html       (structure commune)
├── pipeline_dashboard.html   (spécifique)
├── reservoir_dashboard.html  (spécifique)
└── rock_dashboard.html       (spécifique)
```

### 7.3 Sorties
```
outputs/
├── digital_twin_H2_PIPELINE_100km_20260607.html
├── digital_twin_LH2_STORAGE_50m3_20260607.html
└── digital_twin_ROCK_STRESS_1000m_20260607.html
```

---

## 8. AVANTAGES DE L'APPROCHE

| Aspect | Bénéfice |
|--------|----------|
| **Autonomie** | Aucun serveur requis, fichier HTML unique |
| **Portabilité** | Fonctionne hors-ligne, partage facile |
| **Performance** | Calculs côté client (Canvas 2D) |
| **Validation** | Résidus physiques affichés en temps réel |
| **Transparence** | Données et équations visibles dans le HTML |
| **Démonstration** | Outil parfait pour clients/stakeholders |

---

## 9. PROCHAINES ÉTAPES

1. **Moteur SciML** : Implémenter les 3 scenario engines avec équations validées
2. **Calculateur Résidus** : Différences finies pour Navier-Stokes, thermodynamique, élasticité
3. **Template HTML** : Adapter le style NASA CHAMPS au contexte H₂
4. **Générateur Python** : Orchestrer la génération end-to-end
5. **Validation** : Tester avec données réelles de l'API Quantum-Hybrid-PINN
6. **Livraison** : Fournir 3 exemples + documentation

