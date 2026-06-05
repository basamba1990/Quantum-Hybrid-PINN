
import torch
import mlflow
import mlflow.pytorch
import argparse
import json
from pathlib import Path
import sys

# Robustly add the apps/api directory to the Python path
import os
def add_api_to_path():
    # Try multiple strategies to find apps/api
    current = Path(__file__).resolve()
    
    # Strategy 1: Look for apps/api relative to any Quantum-Hybrid-PINN folder in the path
    for parent in current.parents:
        potential_api = parent / 'apps' / 'api'
        if potential_api.exists() and (potential_api / 'hydrogen_pinn_v8.py').exists():
            sys.path.append(str(potential_api))
            return True
            
    # Strategy 2: Search in current working directory and its subdirectories
    for root, dirs, files in os.walk(os.getcwd()):
        if 'hydrogen_pinn_v8.py' in files and root.endswith(os.path.join('apps', 'api')):
            sys.path.append(root)
            return True
    
    # Strategy 3: Hardcoded relative path from dvc_mlops/src/train_pinn.py
    # dvc_mlops/src/train_pinn.py -> dvc_mlops/src -> dvc_mlops -> . -> apps/api
    potential_api = current.parents[2] / 'apps' / 'api'
    if potential_api.exists():
        sys.path.append(str(potential_api))
        return True
        
    return False

# Execute path addition
add_api_to_path()

# Now imports should work if the path is correct
try:
    from hydrogen_pinn_v8 import HydrogenPINNV8
except ImportError:
    # Fallback for different environments (like Colab if not structured correctly)
    sys.path.append('/content/Quantum-Hybrid-PINN/apps/api')
    from hydrogen_pinn_v8 import HydrogenPINNV8
from pinn_3d_navier_stokes import T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX

def train_pinn_model(epochs: int, learning_rate: float, N_pde: int, model_output_path: str, layers: list = None):
    mlflow.set_experiment("PINN_Training")
    with mlflow.start_run():
        mlflow.log_params({
            "epochs": epochs,
            "learning_rate": learning_rate,
            "N_pde": N_pde,
            "layers": str(layers)
        })

        pinn_v8 = HydrogenPINNV8(layers=layers or [5, 128, 128, 128, 5])
        history = pinn_v8.train_pinn(epochs=epochs, learning_rate=learning_rate, N_pde=N_pde)

        # Log all losses from history
        for epoch, loss_val in enumerate(history["loss"]):
            mlflow.log_metric("total_loss", loss_val, step=epoch)

        # Save the trained PINN model
        torch.save(pinn_v8.pinn_model.state_dict(), model_output_path)
        print(f"PINN model saved to {model_output_path}")

        # Log metrics to a file for DVC
        metrics = {"final_loss": history["loss"][-1]}
        with open("metrics/pinn_metrics.json", "w") as f:
            json.dump(metrics, f)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train PINN model.")
    parser.add_argument("--epochs", type=int, default=5000, help="Number of training epochs.")
    parser.add_argument("--learning_rate", type=float, default=1e-3, help="Learning rate.")
    parser.add_argument("--N_pde", type=int, default=5000, help="Number of PDE collocation points.")
    parser.add_argument("--model_output_path", type=str, default="models/pinn_model.pt", help="Path to save the trained PINN model.")
    parser.add_argument("--layers", type=str, default="[5, 128, 128, 128, 5]", help="JSON string of layers.")

    args = parser.parse_args()
    
    try:
        layers = json.loads(args.layers)
        # Fix architecture mismatch: 3D model (t,x,y,z) needs 4 inputs, not 5
        if layers[0] == 5:
            print("Correction de l'architecture : passage de 5 à 4 entrées pour le modèle 3D (t, x, y, z)")
            layers[0] = 4
    except:
        layers = [4, 128, 128, 128, 5]

    # Create models and metrics directories if they don't exist
    Path("models").mkdir(parents=True, exist_ok=True)
    Path("metrics").mkdir(parents=True, exist_ok=True)

    train_pinn_model(
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        N_pde=args.N_pde,
        model_output_path=args.model_output_path,
        layers=layers
    )
