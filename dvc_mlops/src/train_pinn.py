import torch
import mlflow
import mlflow.pytorch
import argparse
import json
from pathlib import Path
import sys
import os

# Ajout du chemin apps/api
def add_api_to_path():
    current = Path(__file__).resolve()
    for parent in current.parents:
        potential_api = parent / 'apps' / 'api'
        if potential_api.exists() and (potential_api / 'hydrogen_pinn_v8.py').exists():
            sys.path.append(str(potential_api))
            return True
    for root, dirs, files in os.walk(os.getcwd()):
        if 'hydrogen_pinn_v8.py' in files and root.endswith(os.path.join('apps', 'api')):
            sys.path.append(root)
            return True
    potential_api = current.parents[2] / 'apps' / 'api'
    if potential_api.exists():
        sys.path.append(str(potential_api))
        return True
    return False

add_api_to_path()

try:
    from hydrogen_pinn_v8 import HydrogenPINNV8
except ImportError:
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

        pinn_v8 = HydrogenPINNV8(layers=layers or [4, 128, 128, 128, 5])
        history = pinn_v8.train_pinn(epochs=epochs, learning_rate=learning_rate, N_pde=N_pde)

        for epoch, loss_val in enumerate(history["loss"]):
            mlflow.log_metric("total_loss", loss_val, step=epoch)

        torch.save(pinn_v8.pinn_model.state_dict(), model_output_path)
        print(f"PINN model saved to {model_output_path}")

        metrics = {"final_loss": history["loss"][-1]}
        Path("metrics").mkdir(parents=True, exist_ok=True)
        with open("metrics/pinn_metrics.json", "w") as f:
            json.dump(metrics, f)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train PINN model.")
    parser.add_argument("--epochs", type=int, default=5000)
    parser.add_argument("--learning_rate", type=float, default=1e-3)
    parser.add_argument("--N_pde", type=int, default=5000)
    parser.add_argument("--model_output_path", type=str, default="models/pinn_model.pt")
    parser.add_argument("--layers", type=str, default="[4, 128, 128, 128, 5]")
    args = parser.parse_args()
    
    try:
        layers = json.loads(args.layers)
    except:
        layers = [4, 128, 128, 128, 5]

    Path("models").mkdir(parents=True, exist_ok=True)
    train_pinn_model(
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        N_pde=args.N_pde,
        model_output_path=args.model_output_path,
        layers=layers
    )
