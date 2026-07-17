# Spécifications Industrielles LH2 (Cryogénie)

D'après les recherches effectuées (NASA, BMW, Ansys, MDPI), voici les paramètres clés pour une simulation "Truly-Industrial" :

### 1. Propriétés Thermophysiques de l'Hydrogène Liquide (LH2)
*   **Température d'ébullition** : ~20.28 K à 1 atm.
*   **Densité (Liquide)** : ~70.8 kg/m³.
*   **Densité (Vapeur)** : ~1.3 kg/m³ à 20 K.
*   **Chaleur latente de vaporisation** : 447 kJ/kg.

### 2. Paramètres de Simulation (Volume Plein)
*   **Stratification Thermique** : Gradient de température dans la phase vapeur (ullage) pouvant aller de 20 K à l'interface jusqu'à 300 K près des parois supérieures.
*   **Pression de Service** : 0.1 MPa à 0.5 MPa (Standard stockage stationnaire).
*   **Interface Liquide-Gaz** : Modélisée par VOF (Volume of Fluid) ou capture d'interface PINN avec saut de densité de 50x.

### 3. Standards de Validation (Kelly Senecal)
*   **Principe 1 (Fondamentaux)** : Conservation de la masse stricte.
*   **Principe 3 (Validation)** : Résidus de Navier-Stokes < 10^-6.
*   **Principe 5 (IA-Physique)** : Utilisation de PINN pour capturer la couche limite thermique sans maillage dense.

### 4. Sources de Données
*   *Thermo-Fluid Dynamics Modelling of Liquid Hydrogen Storage* (MDPI 2025).
*   *Validation of CFD models for Hydrogen Fast Filling* (H2Tools).
*   *Numerical simulation of LH2 evaporation* (HySafe 2023).
