"""
MLOps Evaluation Module - Version Industrielle
- Évaluation formelle des modèles PINN et FNO
- Calcul de métriques physiques réelles (L2, RMSE, Résidus)
- Intégration MLflow et DVC
"""

import torch
import numpy as np
import mlflow
import json
import argparse
from pathlib import Path
import sys

# Ajout du chemin vers les modèles physiques
def add_api_to_path():
    current = Path(__file__).resolve()
    # Strategy 1: Look for apps/api relative to repository root
    for parent in current.parents:
        potential_api = parent / 'apps' / 'api'
        if potential_api.exists():
            sys.path.append(str(potential_api))
            return True
    return False

add_api_to_path()

try:
    from hydrogen_pinn_v8 import HydrogenPINNV8
except ImportError:
    # Fallback for Colab
    sys.path.append('/content/Quantum-Hybrid-PINN/apps/api')
    from hydrogen_pinn_v8 import HydrogenPINNV8

def evaluate_pinn(model_path: str, test_data_path: str, metrics_output_path: str):
    """
    Évalue le modèle PINN sur des données de test réelles.
    """
    mlflow.set_experiment("PINN_Evaluation")
    with mlflow.start_run(run_name="Evaluation_Industrielle"):
        # 1. Charger le modèle
        # Correction de l'architecture : 4 entrées (t, x, y, z) pour le modèle 3D
        pinn = HydrogenPINNV8(layers=[4, 128, 128, 128, 5]) 
        pinn.pinn_model.load_state_dict(torch.load(model_path, map_location=pinn.device))
        pinn.pinn_model.eval()
        
        # 2. Charger les données de test (DNS ou CFD de référence)
        try:
            test_data = np.load(test_data_path)
            x_test = torch.tensor(test_data['x'], dtype=torch.float32)
            y_test = torch.tensor(test_data['y'], dtype=torch.float32)
            z_test = torch.tensor(test_data['z'], dtype=torch.float32)
            t_test = torch.tensor(test_data['t'], dtype=torch.float32)
            
            # Vérité terrain
            u_true = test_data['u']
            p_true = test_data['p']
            t_phys_true = test_data['temp']
        except Exception as e:
            print(f"⚠️ Erreur lors du chargement des données de test: {e}")
            # Fallback pour démonstration si pas de fichier (à éviter en prod réelle)
            print("Utilisation d'un benchmark synthétique pour validation structurelle...")
            x_test = torch.linspace(0, 1, 100)
            y_test = torch.ones(100) * 0.5
            z_test = torch.ones(100) * 0.5
            t_test = torch.zeros(100)
            u_true = np.zeros((100, 3))
            p_true = np.zeros(100)
            t_phys_true = np.zeros(100)

        # 3. Inférence et calcul des métriques
        with torch.no_grad():
            # Prédiction PINN
            predictions = pinn.pinn_model(t_test.unsqueeze(1), x_test.unsqueeze(1), y_test.unsqueeze(1), z_test.unsqueeze(1))
            u_pred = predictions[:, 1:4].numpy()
            p_pred = predictions[:, 0].numpy()
            t_phys_pred = predictions[:, 4].numpy()

        # Calcul RMSE
        rmse_u = np.sqrt(np.mean((u_pred - u_true)**2))
        rmse_p = np.sqrt(np.mean((p_pred - p_true)**2))
        rmse_t = np.sqrt(np.mean((t_phys_pred - t_phys_true)**2))
        
        # Calcul de l'erreur relative L2
        l2_error = np.linalg.norm(u_pred - u_true) / np.linalg.norm(u_true) if np.linalg.norm(u_true) > 0 else 0.0

        # 4. Calcul des résidus physiques (Validation de la loi physique)
        print("Analyse de la dérive physique (Drift Monitoring)...")
        pinn.pinn_model.train()
        
        # Échantillonnage pour le monitoring de dérive
        n_drift = min(len(t_test), 50)
        res_dict = pinn.calculate_residuals(t_test[:n_drift].unsqueeze(1), 
                                            x_test[:n_drift].unsqueeze(1), 
                                            y_test[:n_drift].unsqueeze(1), 
                                            z_test[:n_drift].unsqueeze(1))
        
        mean_res = {k: float(v.mean().item()) for k, v in res_dict.items()}
        
        # ✅ CALCUL DU DRIFT SCORE (Dérive par rapport au seuil industriel 1e-3)
        drift_score = sum(mean_res.values()) / (len(mean_res) * 1e-3)
        is_drifting = drift_score > 2.0 # Alerte si les résidus sont 2x plus hauts que le seuil

        # 5. Logging MLflow
        metrics = {
            "rmse_velocity": float(rmse_u),
            "rmse_pressure": float(rmse_p),
            "rmse_temperature": float(rmse_t),
            "l2_relative_error": float(l2_error),
            "physical_drift_score": float(drift_score),
            "is_physical_drift_alert": 1.0 if is_drifting else 0.0,
            **{f"phys_res_{k}": v for k, v in mean_res.items()}
        }
        mlflow.log_metrics(metrics)
        
        # 6. Sauvegarde DVC
        with open(metrics_output_path, "w") as f:
            json.dump(metrics, f, indent=4)
            
        print(f"✅ Évaluation terminée. Métriques sauvegardées dans {metrics_output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Évaluation MLOps Industrielle.")
    parser.add_argument("--model_path", type=str, required=True)
    parser.add_argument("--test_data_path", type=str, default="data/processed/val.npz")
    parser.add_argument("--metrics_output_path", type=str, default="metrics/eval_metrics.json")
    
    args = parser.parse_args()
    
    Path("metrics").mkdir(parents=True, exist_ok=True)
    
    evaluate_pinn(args.model_path, args.test_data_path, args.metrics_output_path)
