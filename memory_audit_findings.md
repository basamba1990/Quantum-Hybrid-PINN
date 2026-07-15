# Audit de Consommation Mémoire - Quantum-Hybrid-PINN API

## Problèmes Identifiés (OOM sur Render 512MB)

1. **Architecture Surdimensionnée** :
   - `QuantumHybridPGDPINN` (dans `pgd_pinn_hybrid.py`) utilise par défaut un `output_size` de **1,000,000**.
   - Le correcteur PINN utilise des couches `nn.Linear(1000000, 500000)` puis `nn.Linear(500000, 1000000)`.
   - Rien que la première couche linéaire pèse environ **2,000 Go** (1M * 0.5M * 4 octets pour float32) si elle est instanciée sur CPU, ce qui garantit un OOM immédiat.

2. **Imports Lourds au Démarrage** :
   - `main.py` importe `HydrogenPINNTFCV8`, `DeepKalmanFilter`, `CFDValidationService`, `SCENARIO_ENGINES`, etc.
   - Ces classes chargent souvent des poids de modèles par défaut ou instancient des réseaux de neurones volumineux dès l'importation.
   - `tensorflow` et `tensorflow-probability` sont dans `requirements.txt` mais ne semblent pas être utilisés de manière critique (l'application utilise principalement `torch`). Ils consomment énormément de RAM au chargement.

3. **Chargement de Modèles en Parallèle** :
   - `startup_event` lance `load_pinn_model_background` qui télécharge et charge simultanément le modèle PINN, le modèle FNO, et le détecteur OOD.

4. **Échantillonnage de Points PDE** :
   - `HydrogenPINNTFCV8.train_pinn` utilise par défaut `N_pde=5000`. Avec les gradients activés, cela peut consommer beaucoup de mémoire pendant l'entraînement.

## Stratégie d'Optimisation

1. **Réduction Drastique de l'Architecture** : Passer de 1,000,000 à 10,000 pour `output_size` par défaut dans les tests et environnements limités.
2. **Lazy Loading** : Ne charger les modèles que lorsqu'une requête arrive, et non au démarrage.
3. **Nettoyage de `requirements.txt`** : Supprimer `tensorflow` et `jax` s'ils ne sont pas strictement nécessaires.
4. **Quantisation/Inférence Légère** : Utiliser `torch.inference_mode()` et éventuellement des modèles plus petits pour le plan gratuit.
5. **Nettoyage Agressif de la RAM** : Appels fréquents à `gc.collect()` et `torch.cuda.empty_cache()`.
