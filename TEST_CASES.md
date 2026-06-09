# Exemples de Test Complets - Quantum-Hybrid-PINN

## Test 1: H2-Pipeline-100km (Hydrogène en conduite longue distance)

### Configuration
```json
{
  "project_id": "H2-CONDUITE-PINN-001",
  "job_name": "H2_Pipeline_Prediction",
  "case_path": "/app/cases/h2_pipeline",
  "n_steps": 50,
  "time_step": 0.01,
  "residual_threshold": 0.01,
  "fields": ["U", "p", "T", "rho", "k", "epsilon"],
  "ml_weight": 0.5
}
```

### Paramètres Physiques
- **Géométrie**: Conduite de 100 km, diamètre 0.5 m
- **Entrée**: Pression 80 bar (8 MPa), Température 300 K
- **Débit**: 2 kg/s (hydrogène gazeux)
- **Conditions**: 
  - Zone 1 (0-30 km): Pergélisol, T_sol = 250 K
  - Zone 2 (30-70 km): Régulier, T_sol = 300 K
  - Zone 3 (70-100 km): Désertique, T_sol = 350 K
- **Rugosité paroi**: 0.05 mm

### Résultats Attendus
- **Pression sortie**: 75-78 bar (chute ~2-5%)
- **Température sortie**: 280-320 K (variation selon zones)
- **Vitesse moyenne**: 5.2 m/s
- **Crédibilité**: 85-95%
- **Convergence**: ~30-40 itérations

### Données de Test
```python
# Profil de pression tous les 10 km
pressure_profile = [
    80.0,   # km 0
    79.5,   # km 10
    79.0,   # km 20
    78.5,   # km 30
    78.2,   # km 40
    77.8,   # km 50
    77.5,   # km 60
    77.2,   # km 70
    76.8,   # km 80
    76.5    # km 90
]

# Profil de température tous les 10 km
temperature_profile = [
    300.0,  # km 0
    295.0,  # km 10
    290.0,  # km 20
    285.0,  # km 30
    288.0,  # km 40
    295.0,  # km 50
    305.0,  # km 60
    315.0,  # km 70
    325.0,  # km 80
    330.0   # km 90
]
```

---

## Test 2: H2-Reservoir-Storage (Stockage en réservoir haute pression)

### Configuration
```json
{
  "project_id": "H2-RESERVOIR-PINN-002",
  "job_name": "H2_Reservoir_Validation",
  "case_path": "/app/cases/h2_reservoir",
  "n_steps": 75,
  "time_step": 0.01,
  "residual_threshold": 0.005,
  "fields": ["U", "p", "T", "rho", "k", "epsilon"],
  "ml_weight": 0.6
}
```

### Paramètres Physiques
- **Géométrie**: Réservoir sphérique, diamètre 5 m
- **Entrée**: Pression 100 bar (10 MPa), Température 298 K
- **Débit**: 0.5 kg/s (injection lente)
- **Conditions**: 
  - Paroi externe: T = 300 K (refroidissement ambiant)
  - Injecteur: Diamètre 50 mm, position bas-centre
  - Sortie: Diamètre 40 mm, position haut-centre
- **Rugosité paroi**: 0.1 mm

### Résultats Attendus
- **Pression équilibre**: 98-102 bar (stabilisation)
- **Température équilibre**: 305-310 K (échauffement adiabatique)
- **Vitesse max**: 8-12 m/s (zone d'injection)
- **Crédibilité**: 88-98%
- **Convergence**: ~50-60 itérations
- **Anomalies détectées**: Kalman Filter correction 15-25%

### Données de Test
```python
# Évolution de pression dans le réservoir
pressure_evolution = [
    50.0,   # t=0s (initial)
    65.0,   # t=5s
    75.0,   # t=10s
    82.0,   # t=15s
    87.0,   # t=20s
    91.0,   # t=25s
    94.0,   # t=30s
    96.0,   # t=35s
    97.5,   # t=40s
    98.5,   # t=45s
    99.0,   # t=50s
]

# Évolution de température
temperature_evolution = [
    298.0,  # t=0s
    300.5,  # t=5s
    303.0,  # t=10s
    305.5,  # t=15s
    307.0,  # t=20s
    308.0,  # t=25s
    308.5,  # t=30s
    309.0,  # t=35s
    309.2,  # t=40s
    309.3,  # t=45s
    309.5,  # t=50s
]
```

---

## Exécution des Tests

### Via API FastAPI
```bash
# Test 1: Pipeline
curl -X POST http://localhost:8000/hybrid/run-simulation \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "H2-CONDUITE-PINN-001",
    "job_name": "H2_Pipeline_Prediction",
    "case_path": "/app/cases/h2_pipeline",
    "n_steps": 50,
    "time_step": 0.01,
    "residual_threshold": 0.01,
    "fields": ["U", "p", "T", "rho", "k", "epsilon"]
  }'

# Récupérer les résultats
curl http://localhost:8000/jobs/{job_id}
```

### Via Interface Web
1. Aller à `/dashboard/projects/new`
2. Créer projet "H2-CONDUITE-PINN-001"
3. Aller à `/dashboard/projects/{id}/simulations`
4. Cliquer "Simulation hybride (CFD+ML)"
5. Remplir les paramètres ci-dessus
6. Cliquer "Run Simulation"
7. Observer les résultats en temps réel (CFD/ML times, résidus, crédibilité)

---

## Validation des Résultats

### Critères de Succès
✅ CFD Time: 150-400ms (pas 0.00s)
✅ ML Time: 30-80ms (pas 0.00s)
✅ Résidus: Convergence exponentielle (1e-1 → 1e-7)
✅ Crédibilité: 85-98% (pas 0%)
✅ Champs: Pression, Température, Vitesse, Densité, k, epsilon
✅ Logs: Détaillés à chaque itération
✅ Archives: Rapports PDF générés automatiquement

### Anomalies Corrigées
- ❌ CFD Time = 0.00s → ✅ 150-400ms
- ❌ ML Time = 0.00s → ✅ 30-80ms
- ❌ Visualiseur inactif → ✅ Affiche résultats en temps réel
- ❌ Archives vides → ✅ Rapports auto-générés
- ❌ Résidus = {} → ✅ 7 champs de résidus
- ❌ Crédibilité = 0 → ✅ 85-98%

