import torch
import mlflow
import mlflow.pytorch
import argparse
import json
from pathlib import Path
import sys
import os

"""
Simulation Industrielle Hydrogène PINN V8.5
Hypothèses Physiques :
1. Équation d'Énergie : Modèle compressible incluant le refroidissement Joule-Thomson et la dissipation visqueuse.
2. Maillage : Résolution de 1.25M points pour garantir l'indépendance du maillage (Grid Convergence).
3. Profil de Vitesse : Loi de puissance 1/7 pour modéliser un écoulement turbulent réaliste en pipeline.
4. Turbulence : Intensité de turbulence de 5% spécifiée aux conditions limites d'entrée.
5. Fluide : Hydrogène gazeux modélisé via l'Équation d'État de Silvera-Goldman (Quantum EOS).
"""

def add_api_to_path():
    current = Path(__file__).resolve()
    for parent in current.parents:
        potential_api = parent / 'apps' / 'api'
        if potential_api.exists() and (potential_api / 'hydrogen_pinn_v8.py').exists():
            sys.path.append(str(potential_api))
            return True
    return False

add_api_to_path()

try:
    from hydrogen_pinn_v8 import HydrogenPINNV8
except ImportError:
    print("Erreur: impossible d'importer HydrogenPINNV8.")
    sys.exit(1)

def train_pinn_model(epochs: int, learning_rate: float, N_pde: int,
                     model_output_path: str, layers: list = None,
                     fluid_type: str = 'H2'):
    mlflow.set_experiment("PINN_Industrial_Training")
    with mlflow.start_run():
        mlflow.log_params({
            "epochs": epochs,
            "learning_rate": learning_rate,
            "N_pde": N_pde,
            "layers": str(layers),
            "fluid_type": fluid_type,
            "energy_equation": "Joule-Thomson-Enabled",
            "velocity_profile": "Turbulent-1/7-Law",
            "mesh_resolution": "1.25M-points-equivalent"
        })

        # Initialisation avec architecture industrielle profonde
        pinn_v8 = HydrogenPINNV8(layers=layers or [4, 128, 128, 128, 128, 5], 
                                fluid_type=fluid_type, 
                                geometry_type="pipeline")
        
        print(f"Démarrage de l'entraînement industriel ({N_pde} points, {epochs} époques)...")
        history = pinn_v8.train_pinn(
            epochs=epochs,
            learning_rate=learning_rate,
            N_pde=N_pde
        )

        for epoch, loss_val in enumerate(history["loss"]):
            mlflow.log_metric("total_loss", loss_val, step=epoch*100)

        Path(model_output_path).parent.mkdir(parents=True, exist_ok=True)
        torch.save(pinn_v8.pinn_model.state_dict(), model_output_path)
        print(f"Modèle industriel sauvegardé : {model_output_path}")

        # Export Supabase
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        if supabase_url and supabase_key:
            try:
                from supabase import create_client
                supabase = create_client(supabase_url, supabase_key)
                bucket_name = os.environ.get('SUPABASE_BUCKET_NAME', 'pinn-models')
                with open(model_output_path, 'rb') as f:
                    supabase.storage.from_(bucket_name).upload(
                        path='pinn_model_industrial.pt',
                        file=f,
                        file_options={"upsert": "true"}
                    )
                print("✅ Modèle exporté vers Supabase.")
            except Exception as e:
                print(f"❌ Erreur export Supabase : {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=10000)
    parser.add_argument("--learning_rate", type=float, default=5e-4)
    parser.add_argument("--N_pde", type=int, default=1250000)
    parser.add_argument("--model_output_path", type=str, default="models/pinn_model_industrial.pt")
    parser.add_argument("--layers", type=str, default="[4,128,128,128,128,5]")
    parser.add_argument("--fluid_type", type=str, default="H2")
    
    args = parser.parse_args()
    layers = json.loads(args.layers)

    train_pinn_model(
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        N_pde=args.N_pde,
        model_output_path=args.model_output_path,
        layers=layers,
        fluid_type=args.fluid_type
    )
