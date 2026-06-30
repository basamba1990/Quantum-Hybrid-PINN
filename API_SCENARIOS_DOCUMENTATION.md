# 📚 Documentation API - Formats de Réponse par Scénario

## Vue d'ensemble

Ce document fournit une spécification détaillée des formats de requête et de réponse pour chaque scénario industriel pris en charge par le moteur de simulation **Quantum Hybrid PINN V8.3**. Il est destiné aux développeurs et aux intégrateurs souhaitant interagir avec l'API de simulation.

---

## 1. Pipeline Hydrogène (H2_PIPELINE)

### Endpoint
`POST /hybrid/run-simulation`

### Requête
```json
{
  "project_id": "proj_12345",
  "job_name": "H2 Pipeline Analysis",
  "scenario_type": "H2_PIPELINE",
  "scenario_inputs": {
    "length": 100.0,        // Longueur du pipeline en mètres
    "diameter": 0.5,        // Diamètre interne du pipeline en mètres
    "pressure": 80.0,       // Pression d'entrée en bar
    "temperature": 300.0,   // Température d'entrée en Kelvin
    "flowRate": 2.0,        // Débit massique en kg/s
    "fluid": "H2"           // Type de fluide (H2 ou CH4)
  },
  "n_steps": 100            // Nombre d'étapes de simulation
}
```

### Réponse (Succès)
```json
{
  "job_id": "job_abc123",
  "status": "completed",
  "scenario_type": "H2_PIPELINE",
  "results": {
    "pressureDrop": 2.45,           // Chute de pression totale en bar
    "velocity": 12.47,              // Vitesse moyenne d'écoulement en m/s
    "turbulence": 45.3,             // Intensité de turbulence en %
    "thermalStability": 298.5,      // Température de sortie en Kelvin
    "leakRisk": 15.2,               // Probabilité de fuite en %
    "safetyScore": 84.8,            // Score de sécurité global (sur 100)
    "predictions3d": [
      { "x": 0.5, "y": 0.5, "z": 0.5, "temperature": 298.5, "pressure": 101.3, "velocity_magnitude": 12.47 },
      // ... autres points 3D
    ]
  },
  "timestamp": "2026-06-30T12:00:00Z"
}
```

### Paramètres d'Entrée

| Paramètre | Type   | Unité | Plage       | Description                                        |
|-----------|--------|-------|-------------|----------------------------------------------------|
| `length`  | `float`| `m`   | `10 - 500`  | Longueur du pipeline                               |
| `diameter`| `float`| `m`   | `0.1 - 2.0` | Diamètre interne du pipeline                       |
| `pressure`| `float`| `bar` | `1 - 500`   | Pression d'entrée                                  |
| `temperature`| `float`| `K`   | `250 - 350` | Température d'entrée                               |
| `flowRate`| `float`| `kg/s`| `0.1 - 100` | Débit massique                                     |
| `fluid`   | `string`| —     | `H2, CH4`   | Type de fluide (Hydrogène ou Méthane)              |

### Paramètres de Sortie

| Paramètre          | Unité   | Plage       | Description                                        |
|--------------------|---------|-------------|----------------------------------------------------|
| `pressureDrop`     | `bar`   | `0 - 50`    | Chute de pression totale                           |
| `velocity`         | `m/s`   | `5 - 50`    | Vitesse moyenne d'écoulement                       |
| `turbulence`       | `%`     | `0 - 100`   | Intensité de turbulence                            |
| `thermalStability` | `K`     | `250 - 350` | Température de sortie                              |
| `leakRisk`         | `%`     | `0 - 100`   | Probabilité de fuite                               |
| `safetyScore`      | `/100`  | `0 - 100`   | Score de sécurité global                           |
| `predictions3d`    | `array` | —           | Tableau de points 3D avec propriétés (x,y,z,temp,press,vel) |

---

## 2. Stockage Hydrogène Liquéfié (LH2_STORAGE)

### Endpoint
`POST /hybrid/run-simulation`

### Requête
```json
{
  "project_id": "proj_12345",
  "job_name": "LH2 Storage Analysis",
  "scenario_type": "LH2_STORAGE",
  "scenario_inputs": {
    "volume": 50.0,         // Volume du réservoir en m³
    "pressure": 1.2,        // Pression interne en bar
    "temperature": 20.3,    // Température du liquide en Kelvin
    "ambientTemp": 300.0    // Température ambiante en Kelvin
  },
  "n_steps": 100
}
```

### Réponse
```json
{
  "job_id": "job_def456",
  "status": "completed",
  "scenario_type": "LH2_STORAGE",
  "results": {
    "boilOffRate": 0.45,            // Taux d'évaporation quotidien en %/jour
    "internalPressure": 1.35,       // Pression interne actuelle en bar
    "convectionVelocity": 0.0025,   // Vitesse de convection naturelle en m/s
    "stabilityScore": 97.75,        // Score de stabilité (sur 100)
    "predictions3d": [...]
  },
  "timestamp": "2026-06-30T12:00:00Z"
}
```

### Paramètres d'Entrée

| Paramètre   | Type   | Unité | Plage       | Description                                        |
|-------------|--------|-------|-------------|----------------------------------------------------|
| `volume`    | `float`| `m³`  | `10 - 500`  | Volume du réservoir                                |
| `pressure`  | `float`| `bar` | `0.5 - 10`  | Pression interne                                   |
| `temperature`| `float`| `K`   | `20 - 25`   | Température du liquide                             |
| `ambientTemp`| `float`| `K`   | `250 - 320` | Température ambiante                               |

### Paramètres de Sortie

| Paramètre          | Unité   | Plage       | Description                                        |
|--------------------|---------|-------------|----------------------------------------------------|
| `boilOffRate`      | `% / jour`| `0 - 5`     | Taux d'évaporation quotidien                       |
| `internalPressure` | `bar`   | `0.5 - 15`  | Pression interne actuelle                          |
| `convectionVelocity`| `m/s`   | `0.001 - 0.1`| Vitesse de convection naturelle                    |
| `stabilityScore`   | `/100`  | `0 - 100`   | Score de stabilité                                 |

---

## 3. Station de Compression H₂ (H2_COMPRESSION_STATION)

### Endpoint
`POST /hybrid/run-simulation`

### Requête
```json
{
  "project_id": "proj_12345",
  "job_name": "H2 Compression Station",
  "scenario_type": "H2_COMPRESSION_STATION",
  "scenario_inputs": {
    "pressure_in": 10.0,    // Pression d'entrée en bar
    "pressure_out": 60.0,   // Pression de sortie en bar
    "temperature_in": 290.0,// Température d'entrée en Kelvin
    "temperature_out": 570.0,// Température de sortie en Kelvin
    "flowRate": 5.0,        // Débit massique en kg/s
    "power": 2.5,           // Puissance nominale en MW
    "efficiency": 0.85      // Efficacité nominale (0-1)
  },
  "n_steps": 100
}
```

### Réponse
```json
{
  "job_id": "job_ghi789",
  "status": "completed",
  "scenario_type": "H2_COMPRESSION_STATION",
  "results": {
    "compressionRatio": 6.0,            // Rapport de compression
    "isentropicEfficiency": 82.5,       // Efficacité isentropique en %
    "powerActual": 2.45,                // Puissance réelle consommée en MW
    "thermalDelta": 90.0,               // Augmentation de température en Kelvin
    "coherenceScore": 92.3,             // Score de cohérence physique (sur 100)
    "status": "NORMAL",                 // Statut de la simulation (NORMAL ou ANOMALIE)
    "predictions3d": [...]
  },
  "timestamp": "2026-06-30T12:00:00Z"
}
```

### Paramètres d'Entrée

| Paramètre        | Type   | Unité | Plage       | Description                                        |
|------------------|--------|-------|-------------|----------------------------------------------------|
| `pressure_in`    | `float`| `bar` | `1 - 100`   | Pression d'entrée                                  |
| `pressure_out`   | `float`| `bar` | `10 - 500`  | Pression de sortie                                 |
| `temperature_in` | `float`| `K`   | `250 - 320` | Température d'entrée                               |
| `temperature_out`| `float`| `K`   | `300 - 450` | Température de sortie                              |
| `flowRate`       | `float`| `kg/s`| `0.1 - 50`  | Débit massique                                     |
| `power`          | `float`| `MW`  | `0.1 - 100` | Puissance nominale                                 |
| `efficiency`     | `float`| —     | `0.4 - 0.95`| Efficacité nominale (0-1)                          |

### Paramètres de Sortie

| Paramètre            | Unité   | Plage       | Description                                        |
|----------------------|---------|-------------|----------------------------------------------------|
| `compressionRatio`   | —       | `1 - 100`   | Rapport de compression                             |
| `isentropicEfficiency`| `%`     | `40 - 95`   | Efficacité isentropique                            |
| `powerActual`        | `MW`    | `0.1 - 100` | Puissance réelle consommée                         |
| `thermalDelta`       | `K`     | `0 - 200`   | Augmentation de température                        |
| `coherenceScore`     | `/100`  | `0 - 100`   | Score de cohérence physique                        |
| `status`             | `string`| —           | Statut de la simulation (NORMAL ou ANOMALIE)       |

---

## 4. Transport Cryogénique (CRYOGENIC_TRANSPORT)

### Endpoint
`POST /hybrid/run-simulation`

### Requête
```json
{
  "project_id": "proj_12345",
  "job_name": "Cryogenic Transport",
  "scenario_type": "CRYOGENIC_TRANSPORT",
  "scenario_inputs": {
    "cargoType": "LH2",     // Type de cargaison (LH2 ou GNL)
    "transitTime": 48.0     // Durée du transit en heures
  },
  "n_steps": 100
}
```

### Réponse
```json
{
  "job_id": "job_jkl012",
  "status": "completed",
  "scenario_type": "CRYOGENIC_TRANSPORT",
  "results": {
    "thermalLoss": 1250.0,          // Flux thermique perdu en Watts
    "evaporationLoss": 45.2,        // Masse évaporée en kg
    "containerSafety": 54.8,        // Score de sécurité conteneur (sur 100)
    "predictions3d": [...]
  },
  "timestamp": "2026-06-30T12:00:00Z"
}
```

### Paramètres d'Entrée

| Paramètre    | Type   | Unité | Plage       | Description                                        |
|--------------|--------|-------|-------------|----------------------------------------------------|
| `cargoType`  | `string`| —     | `LH2, GNL`  | Type de cargaison                                  |
| `transitTime`| `float`| `h`   | `12 - 168`  | Durée du transit                                   |

### Paramètres de Sortie

| Paramètre          | Unité   | Plage       | Description                                        |
|--------------------|---------|-------------|----------------------------------------------------|
| `thermalLoss`      | `W`     | `100 - 10000`| Flux thermique perdu                               |
| `evaporationLoss`  | `kg`    | `0 - 1000`  | Masse évaporée                                     |
| `containerSafety`  | `/100`  | `0 - 100`   | Score de sécurité conteneur                        |

---

## 5. Sécurité Pipeline (PIPELINE_SAFETY)

### Endpoint
`POST /hybrid/run-simulation`

### Requête
```json
{
  "project_id": "proj_12345",
  "job_name": "Pipeline Safety",
  "scenario_type": "PIPELINE_SAFETY",
  "scenario_inputs": {
    "length": 200.0,        // Longueur du pipeline en km
    "sensorInterval": 5.0   // Intervalle entre capteurs en km
  },
  "n_steps": 100
}
```

### Réponse
```json
{
  "job_id": "job_mno345",
  "status": "completed",
  "scenario_type": "PIPELINE_SAFETY",
  "results": {
    "detectionTime": 3.85,          // Temps de détection en secondes
    "predictionAccuracy": 63.2,     // Précision de prédiction en %
    "riskReduction": 72.5,          // Réduction du risque en %
    "operationalStability": 92.6,   // Stabilité opérationnelle (sur 100)
    "predictions3d": [...]
  },
  "timestamp": "2026-06-30T12:00:00Z"
}
```

### Paramètres d'Entrée

| Paramètre       | Type   | Unité | Plage       | Description                                        |
|-----------------|--------|-------|-------------|----------------------------------------------------|
| `length`        | `float`| `km`  | `10 - 1000` | Longueur du pipeline                               |
| `sensorInterval`| `float`| `km`  | `1 - 50`    | Intervalle entre capteurs                          |

### Paramètres de Sortie

| Paramètre            | Unité   | Plage       | Description                                        |
|----------------------|---------|-------------|----------------------------------------------------|
| `detectionTime`      | `s`     | `0.1 - 60`  | Temps de détection                                 |
| `predictionAccuracy` | `%`     | `0 - 100`   | Précision de prédiction                            |
| `riskReduction`      | `%`     | `0 - 100`   | Réduction du risque                                |
| `operationalStability`| `/100`  | `80 - 100`  | Stabilité opérationnelle                           |

---

## 6. Optimisation Portuaire (PORT_ENERGY_OPTIMIZATION)

### Endpoint
`POST /hybrid/run-simulation`

### Requête
```json
{
  "project_id": "proj_12345",
  "job_name": "Port Energy Optimization",
  "scenario_type": "PORT_ENERGY_OPTIMIZATION",
  "scenario_inputs": {
    "portLocation": "Dakar",    // Localisation du port
    "energyDemand": 10.0,       // Demande énergétique en MW
    "coolingLoad": 500.0        // Charge de refroidissement en kW
  },
  "n_steps": 100
}
```

### Réponse
```json
{
  "job_id": "job_pqr678",
  "status": "completed",
  "scenario_type": "PORT_ENERGY_OPTIMIZATION",
  "results": {
    "energyEfficiency": 105.5,      // Efficacité énergétique en %
    "costReduction": 15.0,          // Réduction des coûts en %
    "carbonFootprint": 450.0,       // Empreinte carbone annuelle en tonnes CO₂
    "hvacOptimization": 15.0,       // Optimisation HVAC en %
    "predictions3d": [...]
  },
  "timestamp": "2026-06-30T12:00:00Z"
}
```

### Paramètres d'Entrée

| Paramètre      | Type   | Unité | Plage       | Description                                        |
|----------------|--------|-------|-------------|----------------------------------------------------|
| `portLocation` | `string`| —     | `Dakar, Abidjan, Tanger Med, Durban` | Localisation du port                               |
| `energyDemand` | `float`| `MW`  | `1 - 100`   | Demande énergétique                                |
| `coolingLoad`  | `float`| `kW`  | `100 - 10000`| Charge de refroidissement                          |

### Paramètres de Sortie

| Paramètre          | Unité   | Plage       | Description                                        |
|--------------------|---------|-------------|----------------------------------------------------|
| `energyEfficiency` | `%`     | `100 - 110` | Efficacité énergétique                            |
| `costReduction`    | `%`     | `0 - 50`    | Réduction des coûts                                |
| `carbonFootprint`  | `tonnes CO₂`| `0 - 10000` | Empreinte carbone annuelle                         |
| `hvacOptimization` | `%`     | `0 - 50`    | Optimisation HVAC                                  |

---

## 7. Ventilation Minière (MINING_INDUSTRIAL_SIM)

### Endpoint
`POST /hybrid/run-simulation`

### Requête
```json
{
  "project_id": "proj_12345",
  "job_name": "Mining Ventilation",
  "scenario_type": "MINING_INDUSTRIAL_SIM",
  "scenario_inputs": {
    "mineType": "Cobalt",   // Type de mine
    "depth": 500.0,         // Profondeur de la mine en mètres
    "ventilationRate": 100.0// Débit de ventilation en m³/s
  },
  "n_steps": 100
}
```

### Réponse
```json
{
  "job_id": "job_stu901",
  "status": "completed",
  "scenario_type": "MINING_INDUSTRIAL_SIM",
  "results": {
    "airQuality": 78.5,             // Qualité de l'air (sur 100)
    "thermalComfort": 28.5,         // Température de confort en °C
    "gasSafety": 82.3,              // Sécurité gaz (sur 100)
    "fluidCirculation": 360000.0,   // Circulation d'air en m³/h
    "predictions3d": [...]
  },
  "timestamp": "2026-06-30T12:00:00Z"
}
```

### Paramètres d'Entrée

| Paramètre        | Type   | Unité | Plage       | Description                                        |
|------------------|--------|-------|-------------|----------------------------------------------------|
| `mineType`       | `string`| —     | `Cuivre, Cobalt, Lithium, Uranium` | Type de mine                                       |
| `depth`          | `float`| `m`   | `100 - 2000`| Profondeur de la mine                              |
| `ventilationRate`| `float`| `m³/s`| `10 - 500`  | Débit de ventilation                               |

### Paramètres de Sortie

| Paramètre          | Unité   | Plage       | Description                                        |
|--------------------|---------|-------------|----------------------------------------------------|
| `airQuality`       | `/100`  | `0 - 100`   | Qualité de l'air                                   |
| `thermalComfort`   | `°C`    | `20 - 50`   | Température de confort                             |
| `gasSafety`        | `/100`  | `0 - 100`   | Sécurité gaz                                       |
| `fluidCirculation` | `m³/h`  | `0 - 1000000`| Circulation d'air                                  |

---

## 8. Géomécanique Rocheuse (ROCK_ELAST_STRESS)

### Endpoint
`POST /hybrid/run-simulation`

### Requête
```json
{
  "project_id": "proj_12345",
  "job_name": "Rock Stress Analysis",
  "scenario_type": "ROCK_ELAST_STRESS",
  "scenario_inputs": {
    "depth": 1000.0,        // Profondeur en mètres
    "rockType": "generic_rock" // Type de roche
  },
  "n_steps": 100
}
```

### Réponse
```json
{
  "job_id": "job_vwx234",
  "status": "completed",
  "scenario_type": "ROCK_ELAST_STRESS",
  "results": {
    "lithostaticPressure": 25.0,    // Pression lithostatique en MPa
    "maxStress": 37.5,              // Contrainte maximale en MPa
    "damageIndex": 0.562,           // Indice d'endommagement (0-1)
    "stabilityScore": 43.8,         // Score de stabilité (sur 100)
    "predictions3d": [...]
  },
  "timestamp": "2026-06-30T12:00:00Z"
}
```

### Paramètres d'Entrée

| Paramètre   | Type   | Unité | Plage       | Description                                        |
|-------------|--------|-------|-------------|----------------------------------------------------|
| `depth`     | `float`| `m`   | `100 - 5000`| Profondeur                                         |
| `rockType`  | `string`| —     | `generic_rock, granite, sandstone, shale` | Type de roche                                      |

### Paramètres de Sortie

| Paramètre          | Unité   | Plage       | Description                                        |
|--------------------|---------|-------------|----------------------------------------------------|
| `lithostaticPressure`| `MPa`   | `0 - 500`   | Pression lithostatique                             |
| `maxStress`        | `MPa`   | `0 - 750`   | Contrainte maximale                                |
| `damageIndex`      | `0-1`   | `0 - 1`     | Indice d'endommagement                             |
| `stabilityScore`   | `/100`  | `0 - 100`   | Score de stabilité                                 |

---

## Codes d'Erreur

| Code | Message                       | Solution                                           |
|------|-------------------------------|----------------------------------------------------|
| `400`| `Invalid scenario_type`       | Vérifier la liste des scénarios valides            |
| `400`| `Missing required parameters` | Fournir tous les paramètres obligatoires           |
| `500`| `Simulation failed`           | Vérifier les logs du serveur pour plus de détails  |
| `503`| `Service unavailable`         | Réessayer ultérieurement                            |

---

## Exemple de Requête Complète

```bash
curl -X POST https://quantum-hybrid-pinn-jdoj.onrender.com/hybrid/run-simulation \
  -H "Content-Type: application/json" \
  -d 
  '{
    "project_id": "proj_12345",
    "job_name": "H2 Pipeline Analysis",
    "scenario_type": "H2_PIPELINE",
    "scenario_inputs": {
      "length": 100.0,
      "diameter": 0.5,
      "pressure": 80.0,
      "temperature": 300.0,
      "flowRate": 2.0,
      "fluid": "H2"
    },
    "n_steps": 100
  }'
```

---

## Notes Importantes

1.  **Unités** : Toutes les unités sont en SI (Système International) ou en unités industrielles courantes (bar, MW, °C) avec des conversions internes gérées par l'API.
2.  **Précision** : Les résultats sont arrondis à une précision raisonnable pour l'ingénierie (généralement 1 à 3 décimales).
3.  **Validation** : Tous les paramètres d'entrée sont validés par l'API. Des erreurs 400 seront retournées en cas de données invalides.
4.  **Timeout** : Les simulations ont un timeout par défaut de 5 minutes. Les requêtes dépassant ce délai seront annulées.
5.  **Caching** : Les résultats des simulations identiques sont mis en cache pendant 1 heure pour optimiser les performances et réduire la charge de calcul.

---

**Version** : 8.3  
**Date** : 2026-06-30  
**Auteur** : Manus AI (Quantum Hybrid PINN Team)
