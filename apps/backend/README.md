# Quantum-Hybrid-PINN Backend Industriel

Ce répertoire contient le moteur de simulation hybride CFD-ML corrigé et prêt pour l'industrialisation.

## Améliorations Clés

1.  **Validation des Chemins** : Élimination des erreurs "Case path not found" via `PathValidator`.
2.  **Cas Master OpenFOAM** : Générateur de cas paramétrables pour éviter les erreurs "zero state".
3.  **Interpolation Dynamique** : Adaptation automatique des grilles OpenFOAM au modèle FNO (32x32x32).
4.  **Prédicteur ML Généraliste** : Support multi-cas (H2 Pipeline, LH2 Storage, NH3 Synthesis).

## Structure

- `api/` : Endpoints FastAPI et logique de validation.
- `ml_models/` : Emplacement pour les modèles `.pth` ou `.onnx`.
- `scripts/` : Utilitaires pour la génération de cas OpenFOAM.
- `tests/` : Suite de tests unitaires et d'intégration.
- `docs/` : Guide d'implémentation détaillé.

## Lancement Rapide

```bash
pip install -r requirements.txt
python api/main.py
```

Ou via Docker :

```bash
docker build -t quantum-pinn-backend .
docker run -p 8080:8080 quantum-pinn-backend
```
