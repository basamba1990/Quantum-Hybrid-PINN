import torch
import torch.nn as nn
import argparse
import json
import mlflow
import mlflow.pytorch
from pathlib import Path
import sys
import os
import numpy as np
from datetime import datetime
from supabase import create_client, Client
import logging

logging.basicConfig(level=logging.INFO, format=\'%(asctime)s - %(name)s - %(levelname)s - %(message)s\')
logger = logging.getLogger("Kalman-Industrial-Trainer")

def add_api_to_path():
    current = Path(__file__).resolve()
    for parent in current.parents:
        potential_api = parent / \'apps\' / \'api\'
        if potential_api.exists() and (potential_api / \'deep_kalman_filter.py\').exists():
            sys.path.append(str(potential_api))
            return True
    potential_api = Path(\'/content/Quantum-Hybrid-PINN/apps/api\')
    if potential_api.exists():
        sys.path.append(str(potential_api))
        return True
    return False

add_api_to_path()

try:
    from deep_kalman_filter import DeepKalmanFilter
except ImportError:
    logger.error("Erreur: impossible d\'importer DeepKalmanFilter. Vérifiez le chemin d\'accès.")
    sys.exit(1)

class KalmanDataset(torch.utils.data.Dataset):
    def __init__(self, file_path):
        data = np.load(file_path)
        self.states = torch.from_numpy(data["states"]).float()
        self.observations = torch.from_numpy(data["observations"]).float()

    def __len__(self):
        return len(self.states)

    def __getitem__(self, idx):
        return self.states[idx], self.observations[idx]

def upload_to_supabase(file_path: str, bucket: str, destination_path: str):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("Supabase credentials missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY), skipping upload.")
        return None
        
    try:
        supabase: Client = create_client(url, key)
        with open(file_path, \'rb\') as f:
            supabase.storage.from_(bucket).upload(
                path=destination_path,
                file=f,
                file_options={"x-upsert": "true"}
            )
        logger.info(f"✅ Fichier {file_path} téléchargé vers Supabase: {destination_path}")
        return f"{url}/storage/v1/object/public/{bucket}/{destination_path}"
    except Exception as e:
        logger.error(f"❌ Échec du téléchargement Supabase : {e}")
        return None

def save_metrics_to_supabase(metrics: dict, model_url: str, scenario: str):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key: return
    
    try:
        supabase: Client = create_client(url, key)
        supabase.table("model_trainings").insert({
            "model_type": "KALMAN_INDUSTRIAL",
            "scenario": scenario,
            "metrics": metrics,
            "model_url": model_url,
            "timestamp": datetime.utcnow().isoformat()
        }).execute()
        logger.info("✅ Métriques enregistrées dans Supabase DB.")
    except Exception as e:
        logger.error(f"❌ Échec enregistrement DB Supabase : {e}")

def train_kalman_model(train_data_path: str, model_output_path: str,
                       state_dim: int, observation_dim: int, hidden_dim: int,
                       epochs: int, learning_rate: float):
    mlflow.set_experiment("Kalman_Training")
    with mlflow.start_run():
        mlflow.log_params({
            "state_dim": state_dim,
            "observation_dim": observation_dim,
            "hidden_dim": hidden_dim,
            "epochs": epochs,
            "learning_rate": learning_rate
        })

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Utilisation du device : {device}")

        # Dummy data for now, as actual data generation is in prepare.py
        # In a real scenario, this would load actual processed data.
        # For demonstration, we'll create dummy data if the file doesn't exist.
        if not Path(train_data_path).exists():
            logger.warning(f"Fichier de données d\'entraînement {train_data_path} non trouvé. Génération de données factices.")
            dummy_states = np.random.rand(100, state_dim).astype(np.float32)
            dummy_observations = np.random.rand(100, observation_dim).astype(np.float32)
            np.savez(train_data_path, states=dummy_states, observations=dummy_observations)

        dataset = KalmanDataset(train_data_path)
        dataloader = torch.utils.data.DataLoader(dataset, batch_size=32, shuffle=True)

        model = DeepKalmanFilter(state_dim, observation_dim, hidden_dim).to(device)
        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
        criterion = nn.MSELoss()

        best_loss = float(\'inf\')

        for epoch in range(epochs):
            model.train()
            epoch_loss = 0
            for states, observations in dataloader:
                states, observations = states.to(device), observations.to(device)
                optimizer.zero_grad()
                
                # Forward pass - simplified for dummy data
                # In a real scenario, DeepKalmanFilter would have a more complex forward method
                # that takes states and observations to predict next state or refine current state.
                # For now, we'll just simulate a prediction.
                predicted_observations = model.predict_observation(states) # Assuming such a method exists
                loss = criterion(predicted_observations, observations)
                
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()
            
            avg_epoch_loss = epoch_loss / len(dataloader)
            mlflow.log_metric("kalman_loss", avg_epoch_loss, step=epoch)
            logger.info(f"Epoch {epoch+1}/{epochs}, Loss: {avg_epoch_loss:.4f}")

            if avg_epoch_loss < best_loss:
                best_loss = avg_epoch_loss
                Path(model_output_path).parent.mkdir(parents=True, exist_ok=True)
                torch.save(model.state_dict(), model_output_path)
                logger.info(f"Meilleur modèle Kalman sauvegardé avec une perte de {best_loss:.4f}")

        final_metrics = {"final_kalman_loss": best_loss}
        metrics_dir = Path("metrics")
        metrics_dir.mkdir(exist_ok=True)
        with open(metrics_dir / "kalman_metrics.json", "w") as f:
            json.dump(final_metrics, f)
        mlflow.log_artifact(str(metrics_dir / "kalman_metrics.json"))

        # Upload du modèle vers Supabase Storage
        timestamp = datetime.now().strftime(\'%Y%m%d_%H%M%S\')
        model_filename = f"deep_kalman_filter_{timestamp}.pt"
        model_url = upload_to_supabase(
            model_output_path, 
            os.getenv(\'SUPABASE_BUCKET_NAME\', \'pinn-models\'), 
            f"kalman/{model_filename}"
        )
        save_metrics_to_supabase(final_metrics, model_url or "local_only", "all_scenarios") # Assuming all_scenarios for Kalman

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--train_data_path", type=str, default="data/processed/train.npz")
    parser.add_argument("--model_output_path", type=str, default="models/deep_kalman_filter.pt")
    parser.add_argument("--state_dim", type=int, default=5)
    parser.add_argument("--observation_dim", type=int, default=3)
    parser.add_argument("--hidden_dim", type=int, default=64)
    parser.add_argument("--epochs", type=int, default=500)
    parser.add_argument("--learning_rate", type=float, default=0.001)
    args = parser.parse_args()

    train_kalman_model(
        train_data_path=args.train_data_path,
        model_output_path=args.model_output_path,
        state_dim=args.state_dim,
        observation_dim=args.observation_dim,
        hidden_dim=args.hidden_dim,
        epochs=args.epochs,
        learning_rate=args.learning_rate
    )
