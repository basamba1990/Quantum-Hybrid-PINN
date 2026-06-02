# Exemples de Test Complets pour les Scénarios Industriels

Ce document fournit des exemples de test détaillés pour chaque scénario industriel défini dans l'application Quantum-Hybrid-PINN. L'objectif est de valider le comportement de l'application, la précision des simulations et la pertinence des visualisations pour chaque cas d'usage.

## 1. Scénario : Pipeline Gaz/Hydrogène (GTA)

*   **ID :** `H2_PIPELINE`
*   **Nom :** Pipeline Gaz/Hydrogène (GTA)
*   **Description :** Simulation de transport gaz/hydrogène, détection des pertes de pression et optimisation des débits.

### Paramètres d'Entrée (Valeurs par défaut)

| Paramètre         | Label               | Type     | Unité  | Valeur par Défaut |
| :---------------- | :------------------ | :------- | :----- | :---------------- |
| `length`          | Longueur            | `number` | km     | 100               |
| `diameter`        | Diamètre            | `number` | m      | 0.5               |
| `pressure`        | Pression Entrée     | `number` | bar    | 80                |
| `temperature`     | Température         | `number` | K      | 300               |
| `flowRate`        | Débit               | `number` | kg/s   | 2                 |
| `fluid`           | Fluide              | `select` | -      | H2 (Hydrogène)    |

### Paramètres de Sortie Attendus

| Paramètre          | Label                   | Unité   |
| :----------------- | :---------------------- | :------ |
| `pressureDrop`     | Perte de Pression       | bar     |
| `velocity`         | Vitesse Fluide          | m/s     |
| `turbulence`       | Zone de Turbulence      | %       |
| `thermalStability` | Stabilité Thermique     | K       |
| `leakRisk`         | Risque de Fuite         | %       |
| `safetyScore`      | Score de Sécurité       | /100    |

### Cas de Test Spécifique : Analyse de Flux Turbulent

Pour ce scénario, l'analyse de flux turbulent est cruciale pour évaluer la stabilité du transport. Il faut vérifier que :

1.  **Visualisation :** La courbe de vitesse fluide (`velocity`) dans l'onglet "Flux Turbulent" de la visualisation avancée affiche la zone d'incertitude alignée avec la courbe, en vert émeraude sur fond noir, comme corrigé.
2.  **Données :** Les données de `amplitude`, `upper` et `lower` sont cohérentes avec les fluctuations de vitesse attendues pour un flux turbulent dans un pipeline.
3.  **Comportement :** Des variations des paramètres d'entrée (ex: `flowRate`, `diameter`) entraînent des changements logiques dans la `velocity` et la `turbulence`.

## 2. Scénario : Stockage Hydrogène Liquide (LH2)

*   **ID :** `LH2_STORAGE`
*   **Nom :** Stockage Hydrogène Liquide (LH2)
*   **Description :** Simulation de réservoir LH2, stabilité thermique et évaporation.

### Paramètres d'Entrée (Valeurs par défaut)

| Paramètre       | Label               | Type     | Unité | Valeur par Défaut |
| :-------------- | :------------------ | :------- | :---- | :---------------- |
| `volume`        | Volume              | `number` | m3    | 50                |
| `pressure`      | Pression Interne    | `number` | bar   | 1.2               |
| `temperature`   | Température Cryo    | `number` | K     | 20                |
| `ambientTemp`   | Température Ambiante| `number` | K     | 300               |

### Paramètres de Sortie Attendus

| Paramètre            | Label                   | Unité   |
| :------------------- | :---------------------- | :------ |
| `boilOffRate`        | Taux d'évaporation      | %/jour  |
| `internalPressure`   | Pression Interne        | bar     |
| `convectionVelocity` | Vitesse Convection      | m/s     |
| `stabilityScore`     | Score de Stabilité      | /100    |

### Cas de Test Spécifique : Stabilité Thermique

1.  **Visualisation :** Vérifier que les graphiques de `convectionVelocity` et `internalPressure` reflètent les dynamiques de convection et de pression dans le réservoir.
2.  **Données :** S'assurer que le `boilOffRate` augmente avec une `ambientTemp` plus élevée et diminue avec une meilleure isolation (non simulée directement ici, mais conceptuellement).

## 3. Scénario : Optimisation Énergétique Portuaire

*   **ID :** `PORT_ENERGY_OPTIMIZATION`
*   **Nom :** Optimisation Énergétique Portuaire
*   **Description :** Optimisation de la consommation énergétique, refroidissement industriel et logistique.

### Paramètres d'Entrée (Valeurs par défaut)

| Paramètre         | Label                   | Type     | Unité | Valeur par Défaut |
| :---------------- | :---------------------- | :------- | :---- | :---------------- |
| `portLocation`    | Port                    | `select` | -     | Dakar             |
| `energyDemand`    | Demande Énergétique     | `number` | MW    | 10                |
| `coolingLoad`     | Charge de Refroidissement| `number` | kW    | 500               |

### Paramètres de Sortie Attendus

| Paramètre          | Label                   | Unité   |
| :----------------- | :---------------------- | :------ |
| `energyEfficiency` | Efficacité Énergétique  | %       |
| `costReduction`    | Réduction Coûts         | %       |
| `carbonFootprint`  | Empreinte Carbone       | tCO2/an |
| `hvacOptimization` | Optimisation HVAC       | %       |

### Cas de Test Spécifique : Impact de la Localisation

1.  **Visualisation :** Les graphiques devraient montrer l'évolution des métriques d'efficacité.
2.  **Données :** Comparer les résultats pour différentes `portLocation` (ex: Dakar vs Tanger Med) pour observer l'impact des conditions climatiques et opérationnelles sur l'`energyEfficiency` et le `carbonFootprint`.

## 4. Scénario : Sécurité Pipeline Pétrole/Gaz

*   **ID :** `PIPELINE_SAFETY`
*   **Nom :** Sécurité Pipeline Pétrole/Gaz
*   **Description :** Détection d'anomalies de pression, prédiction de fuites et de ruptures.

### Paramètres d'Entrée (Valeurs par défaut)

| Paramètre         | Label                   | Type     | Unité | Valeur par Défaut |
| :---------------- | :---------------------- | :------- | :---- | :---------------- |
| `length`          | Longueur                | `number` | km    | 200               |
| `sensorInterval`  | Intervalle Capteurs     | `number` | km    | 5                 |

### Paramètres de Sortie Attendus

| Paramètre            | Label                   | Unité   |
| :------------------- | :---------------------- | :------ |
| `detectionTime`      | Temps Détection         | s       |
| `predictionAccuracy` | Précision Prédiction    | %       |
| `riskReduction`      | Réduction Risques       | %       |
| `operationalStability`| Stabilité Opérationnelle| %       |

### Cas de Test Spécifique : Détection de Fuites

1.  **Visualisation :** Les graphiques devraient illustrer la détection d'anomalies.
2.  **Données :** Simuler une fuite (via des données d'entrée spécifiques si l'API le permet) et vérifier que le `detectionTime` est minimal et que la `predictionAccuracy` est élevée.

## 5. Scénario : Transport Cryogénique (GNL/LH2)

*   **ID :** `CRYOGENIC_TRANSPORT`
*   **Nom :** Transport Cryogénique (GNL/LH2)
*   **Description :** Simulation des pertes thermiques et de la sécurité pendant le transport.

### Paramètres d'Entrée (Valeurs par défaut)

| Paramètre         | Label                   | Type     | Unité | Valeur par Défaut |
| :---------------- | :---------------------- | :------- | :---- | :---------------- |
| `cargoType`       | Type de Cargaison       | `select` | -     | LH2               |
| `transitTime`     | Temps de Transit        | `number` | h     | 48                |

### Paramètres de Sortie Attendus

| Paramètre           | Label                   | Unité   |
| :------------------ | :---------------------- | :------ |
| `thermalLoss`       | Pertes Thermiques       | W       |
| `evaporationLoss`   | Pertes Évaporation      | kg      |
| `containerSafety`   | Sécurité Container      | /100    |

### Cas de Test Spécifique : Impact du Type de Cargaison

1.  **Visualisation :** Les graphiques devraient montrer les pertes thermiques et d'évaporation.
2.  **Données :** Comparer les `thermalLoss` et `evaporationLoss` entre `LH2` et `GNL` pour un même `transitTime`.

## 6. Scénario : Simulation Industrielle Minière

*   **ID :** `MINING_INDUSTRIAL_SIM`
*   **Nom :** Simulation Industrielle Minière
*   **Description :** Ventilation, transfert thermique et sécurité gaz dans les mines (Cuivre, Cobalt, Lithium).

### Paramètres d'Entrée (Valeurs par défaut)

| Paramètre         | Label                   | Type     | Unité | Valeur par Défaut |
| :---------------- | :---------------------- | :------- | :---- | :---------------- |
| `mineType`        | Type de Mine            | `select` | -     | Cobalt            |
| `depth`           | Profondeur              | `number` | m     | 500               |
| `ventilationRate` | Taux Ventilation        | `number` | m3/s  | 100               |

### Paramètres de Sortie Attendus

| Paramètre           | Label                   | Unité   |
| :------------------ | :---------------------- | :------ |
| `airQuality`        | Qualité de l'Air        | %       |
| `thermalComfort`    | Confort Thermique       | K       |
| `gasSafety`         | Sécurité Gaz            | /100    |
| `fluidCirculation`  | Circulation Fluides     | m3/h    |

### Cas de Test Spécifique : Efficacité de la Ventilation

1.  **Visualisation :** Les graphiques devraient montrer l'impact de la ventilation sur la qualité de l'air et le confort thermique.
2.  **Données :** Faire varier le `ventilationRate` et observer l'impact sur l'`airQuality` et le `gasSafety`.

---

**Auteur :** Manus AI
**Date :** 02 Juin 2026
