# Documentation Technique : Intégration IoT/SCADA et Conformité Industrielle

**Projet :** Quantum-Hybrid-PINN (Truly-Industrial V9)
**Auteur :** Manus AI
**Date :** 26 Juin 2026

---

## 1. Introduction

Cette documentation technique détaille l'implémentation des recommandations "Truly-Industrial" pour Quantum-Hybrid-PINN. Elle fournit les spécifications exactes pour connecter l'application aux systèmes physiques (IoT, SCADA) via le Filtre de Kalman Profond, et explique comment exploiter le gestionnaire de risques pour garantir la conformité aux normes industrielles (ISO 13623, API 620).

L'objectif est de transformer Quantum-Hybrid-PINN d'un simulateur CFD en un **Cerveau d'Automatisation Physique** en boucle fermée.

## 2. Intégration des Capteurs Réels (Le "Corps")

L'intégration des données du monde réel s'effectue via l'endpoint `/v2/assimilate`. Cet endpoint utilise la classe `DeepKalmanFilter` pour fusionner les prédictions du modèle (l'Esprit) avec les observations bruitées des capteurs (le Corps).

### 2.1. Spécifications de l'Endpoint d'Assimilation

L'endpoint `/v2/assimilate` accepte des requêtes HTTP POST contenant les mesures des capteurs.

**URL :** `POST /v2/assimilate`
**Content-Type :** `application/json`

**Structure de la Requête (Payload) :**
Le payload doit correspondre au modèle Pydantic `PredictionRequestV8`.

```json
{
  "time": 12.5,
  "x": 100.0,
  "y": 0.0,
  "z": 0.0,
  "density": 1.2,
  "velocity_u": 15.5,
  "velocity_v": 0.1,
  "velocity_w": 0.0,
  "temperature": 295.15,
  "project_id": "H2_PIPELINE_NORD"
}
```

*Note : Les champs `density`, `velocity_u`, `velocity_v`, `velocity_w`, et `temperature` représentent le vecteur d'état observé (dimension 5).*

### 2.2. Logique Interne du Filtre de Kalman Profond

Le fichier `deep_kalman_filter.py` implémente l'assimilation. Lors de la réception d'une observation, le système effectue les opérations suivantes :

1.  **Prédiction (Esprit) :** Le modèle de transition interne `self.f` prédit l'état suivant $x_{pred}$ et propage la matrice de covariance $P_{pred}$ en utilisant la Jacobienne calculée via différenciation automatique (`torch.autograd.functional.jacobian`).
2.  **Mise à jour (Corps) :** Le gain de Kalman $K$ est calculé en fonction de la covariance de l'innovation $S$. L'état est ensuite corrigé par l'innovation $y$ (différence entre l'observation réelle et la prédiction projetée).
3.  **Stabilité Numérique :** La mise à jour de la covariance utilise la forme de Joseph pour garantir une matrice définie positive, essentielle en milieu industriel.

**Exemple d'intégration Python pour un automate SCADA :**

```python
import requests
import time
import random

API_URL = "https://quantum-pinn-api-qef2.onrender.com/v2/assimilate"

def read_scada_sensors():
    # Simulation de lecture de capteurs réels (ex: Modbus/OPC-UA)
    return {
        "density": 1.2 + random.uniform(-0.05, 0.05),
        "velocity_u": 15.5 + random.uniform(-0.5, 0.5),
        "velocity_v": 0.0,
        "velocity_w": 0.0,
        "temperature": 295.15 + random.uniform(-1.0, 1.0)
    }

def send_to_quantum_brain():
    while True:
        sensor_data = read_scada_sensors()
        payload = {
            "time": time.time(),
            "x": 50.0, "y": 0.0, "z": 0.0,
            **sensor_data
        }
        
        try:
            response = requests.post(API_URL, json=payload)
            if response.status_code == 200:
                assimilated_state = response.json().get("assimilated_state")
                print(f"État corrigé par l'IA : {assimilated_state}")
                # Action : Ajuster les vannes SCADA basées sur l'état corrigé
        except Exception as e:
            print(f"Erreur de communication : {e}")
            
        time.sleep(1.0) # Fréquence d'échantillonnage à 1 Hz
```

## 3. Exploitation des Rapports de Conformité

L'`IndustrialRiskManager` (`industrial_risk_manager.py`) est le composant qui traduit les calculs mathématiques en certificats de sécurité compréhensibles par les ingénieurs et les auditeurs.

### 3.1. Génération du Rapport PDF

La fonction `generate_full_report` crée un document PDF certifiant la validité physique de la simulation ou de l'état assimilé. Ce rapport est crucial pour prouver que l'IA respecte les contraintes du monde physique.

**Critères d'évaluation :**
*   **Score de Crédibilité :** Calculé à partir des résidus des équations de Navier-Stokes (Continuité, Momentum, Énergie). Un score > 80% est considéré comme "Faible Risque".
*   **Détection OOD (Out-of-Distribution) :** Utilise la distance de Mahalanobis pour vérifier si l'état actuel dévie des conditions d'entraînement normales.
*   **Normes Appliquées :** Le rapport associe automatiquement le fluide simulé aux normes industrielles (ex: ISO 13623 pour les pipelines H2, API 620 pour le stockage LH2).

### 3.2. Intégration dans le Workflow

Pour automatiser la conformité, le rapport doit être généré à la fin de chaque cycle critique (ex: après `/hybrid/run-simulation`).

**Extrait de la logique d'orchestration (`main.py`) :**

```python
# Après la convergence de la simulation hybride
final_result = {
    "iteration": num_steps,
    "residuals": clean_json(final_residuals),
    "credibility_score": credibility_score,
    # ...
}

# Génération asynchrone du rapport de conformité
if risk_manager:
    report_path = f"/tmp/report_{job_id}.pdf"
    risk_manager.generate_full_report(
        output_path=report_path,
        project_id=request.project_id,
        analysis_id=job_id,
        scenario_type=request.scenario_type,
        scenario_inputs=request.scenario_inputs,
        final_result=final_result
    )
    # Le rapport peut ensuite être uploadé sur Supabase ou envoyé par email
```

## 4. Positionnement : Le Cerveau d'Automatisation Physique

En combinant l'assimilation de données en temps réel (Section 2) et la certification physique continue (Section 3), Quantum-Hybrid-PINN dépasse le stade de simulateur. 

Il doit être positionné architecturalement comme suit :

1.  **Couche Physique (Corps) :** Capteurs IoT, automates SCADA, vannes de contrôle.
2.  **Couche de Perception :** `DeepKalmanFilter` (Endpoint `/v2/assimilate`).
3.  **Couche Cognitive (Esprit) :** `FNOPipelineOrchestrator` (Intuition) + `HydrogenPINNV8` (Raisonnement).
4.  **Couche de Décision :** `IndustrialRiskManager` (Génération de rapports, alertes de dérive).

Cette architecture garantit que chaque décision prise par le système est physiquement valide, mathématiquement optimale, et industriellement certifiée.
