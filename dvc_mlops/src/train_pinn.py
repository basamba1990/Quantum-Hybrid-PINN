import torch
import mlflow
import mlflow.pytorch
import argparse
import json
from pathlib import Path
import sys
import os

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
    potential_api = Path('/content/Quantum-Hybrid-PINN/apps/api')
    if potential_api.exists():
        sys.path.append(str(potential_api))
        return True
    return False

add_api_to_path()

try:
    from hydrogen_pinn_v8 import HydrogenPINNV8
except ImportError:
    print("Erreur: impossible d'importer HydrogenPINNV8. Vérifiez le chemin d'accès.")
    sys.exit(1)

def train_pinn_model(epochs: int, learning_rate: float, N_pde: int,
                     adapt_every: int, n_refine: int,
                     model_output_path: str, layers: list = None,
                     fluid_type: str = 'H2', enable_mc_dropout: bool = False,
                     enable_ood_detection: bool = False, residual_threshold: float = 0.01):
    mlflow.set_experiment("PINN_Training")
    with mlflow.start_run():
        mlflow.log_params({
            "epochs": epochs,
            "learning_rate": learning_rate,
            "N_pde": N_pde,
            "adapt_every": adapt_every,
            "n_refine": n_refine,
            "layers": str(layers),
            "fluid_type": fluid_type,
            "enable_mc_dropout": enable_mc_dropout,
            "enable_ood_detection": enable_ood_detection,
            "residual_threshold": residual_threshold
        })

        pinn_v8 = HydrogenPINNV8(layers=layers or [4, 128, 128, 128, 5], fluid_type=fluid_type)
        
        # Configuration optionnelle
        if enable_ood_detection:
            pinn_v8.enable_ood_detection = True
            # Note: L'initialisation réelle du détecteur OOD nécessite des données de fit
            
        history = pinn_v8.train_pinn(
            epochs=epochs,
            learning_rate=learning_rate,
            N_pde=N_pde,
            adapt_every=adapt_every,
            n_refine=n_refine
        )

        for epoch, loss_val in enumerate(history["loss"]):
            mlflow.log_metric("total_loss", loss_val, step=epoch)
        mlflow.log_metric("final_loss", history["loss"][-1])

        Path(model_output_path).parent.mkdir(parents=True, exist_ok=True)
        torch.save(pinn_v8.pinn_model.state_dict(), model_output_path)
        print(f"PINN model saved to {model_output_path}")

        Path("metrics").mkdir(parents=True, exist_ok=True)
        with open("metrics/pinn_metrics.json", "w") as f:
            json.dump({"final_loss": history["loss"][-1]}, f)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=5000)
    parser.add_argument("--learning_rate", type=float, default=1e-3)
    parser.add_argument("--N_pde", type=int, default=5000)
    parser.add_argument("--adapt_every", type=int, default=500)
    parser.add_argument("--n_refine", type=int, default=500)
    parser.add_argument("--model_output_path", type=str, default="models/pinn_model.pt")
    parser.add_argument("--layers", type=str, default="[4,128,128,128,5]")
    
    # Nouveaux arguments demandés
    parser.add_argument("--scenarios", type=str, default="all", help="Scénarios à traiter")
    parser.add_argument("--fluid_type", type=str, default="H2", help="Type de fluide (H2, LH2, etc.)")
    parser.add_argument("--enable_mc_dropout", action="store_true", help="Activer le MC Dropout")
    parser.add_argument("--enable_ood_detection", action="store_true", help="Activer la détection OOD")
    parser.add_argument("--residual_threshold", type=float, default=0.01, help="Seuil des résidus")
    
    args = parser.parse_args()

    try:
        layers = json.loads(args.layers)
    except:
        layers = [4, 128, 128, 128, 5]

    train_pinn_model(
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        N_pde=args.N_pde,
        adapt_every=args.adapt_every,
        n_refine=args.n_refine,
        model_output_path=args.model_output_path,
        layers=layers,
        fluid_type=args.fluid_type,
        enable_mc_dropout=args.enable_mc_dropout,
        enable_ood_detection=args.enable_ood_detection,
        residual_threshold=args.residual_threshold
    )
