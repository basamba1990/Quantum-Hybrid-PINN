# Guide de Remplissage Industriel - Nouveau Projet PINN V8

Voici les données exactes à copier-coller dans le formulaire pour obtenir une simulation haute fidélité.

---

### 1. Identifiant du Projet
**Valeur :** `H2-PIPELINE-TRANS-100KM-V8`

---

### 2. Résumé Scientifique
**Valeur :**
> Simulation de transport d'hydrogène gazeux haute pression sur une conduite de 100 km. L'objectif est de prédire la chute de pression et le profil thermique en tenant compte des variations de température du sol (pergélisol vs désert) et de la rugosité de la paroi. Analyse hybride Navier-Stokes avec couplage PINN-FNO pour la prédiction des zones de turbulence.

---

### 3. Données Physiques (Crucial pour PINN)
**Valeur :**
```text
PARAMÈTRES D'ENTRÉE :
- Fluide : Hydrogène Gazeux (H2)
- Longueur Conduite : 100,000 m
- Diamètre Intérieur : 0.5 m
- Pression d'Entrée (P_in) : 80 bar (8.0 MPa)
- Température d'Entrée (T_in) : 300 K
- Débit Massique (m_dot) : 2.0 kg/s
- Rugosité de Paroi (epsilon) : 0.05 mm

CONDITIONS ENVIRONNEMENTALES :
- Zone A (0-30km) : T_sol = 250 K (Pergélisol)
- Zone B (30-70km) : T_sol = 300 K (Tempéré)
- Zone C (70-100km) : T_sol = 350 K (Désertique)

OBJECTIFS DE SIMULATION :
- Résolution Navier-Stokes 3D
- Seuil de changement résiduel : 0.01
- Pas de temps : 0.01s
- Solveur : Hybride CFD+ML (Poids ML 0.5)
```

---

### 4. Média Source
**Action :** Chargez une vidéo de simulation OpenFOAM (MP4/WebM) ou laissez vide si vous utilisez uniquement les paramètres textuels.

---

## Pourquoi les données étaient manquantes ?
Le moteur PINN V8 attendait une transcription structurée. En utilisant le format ci-dessus, l'IA (GPT-4o) extraira automatiquement les variables pour alimenter les graphiques de pression, vitesse et température.

---

## Prochaine étape
Cliquez sur **"Démarrer Simulation"**. Le système Nexus v8.0 initialisera l'infrastructure DeepTech et vous verrez les graphiques se remplir en temps réel.
