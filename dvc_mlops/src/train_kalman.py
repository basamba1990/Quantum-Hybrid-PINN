
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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Kalman-Production-Trainer")

def add_api_to_path():
    current = Path(__file__).resolve()
    for parent in current.parents:
        potential_api = parent / 'apps' / 'api'
        if potential_api.exists():
            sys.path.append(str(potential_api))
            return True
    return False

add_api_to_path()

try:
    from deep_kalman_filter import DeepKalmanFilter
except ImportError:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../apps/api')))
    from deep_kalman_filter import DeepKalmanFilter

class KalmanDataset(torch.utils.data.Dataset):
    def __init__(self, file_path):
        data = np.load(file_path)
        self.states = torch.from_numpy(data["states"]).float()
        self.observations = torch.from_numpy(data["observations"]).float()
        
        # Ajustement automatique des dimensions si nécessaire
        if self.states.dim() > 2:
            self.states = self.states.view(self.states.size(0), -1)
        if self.observations.dim() > 2:
            self.observations = self.observations.view(self.observations.size(0), -1)

    def __len__(self):
        return len(self.states)

    def __getitem__(self, idx):
        return self.states[idx], self.observations[idx]

def upload_to_supabase(file_path: str, bucket: str, destination_path: str):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key: return None
    try:
        supabase: Client = create_client(url, key)
        with open(file_path, 'rb') as f:
            supabase.storage.from_(bucket).upload(path=destination_path, file=f, file_options={"x-upsert": "true"})
        return f"{url}/storage/v1/object/public/{bucket}/{destination_path}"
    except: return None

def train_kalman_production(train_path: str, val_path: str, model_path: str, 
                            epochs: int, lr: float, hidden_dim: int):
    mlflow.set_experiment("Kalman_Production")
    
    with mlflow.start_run():
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        if not Path(train_path).exists():
            logger.error(f"Données manquantes : {train_path}")
            return

        train_ds = KalmanDataset(train_path)
        val_ds = KalmanDataset(val_path)
        
        train_loader = torch.utils.data.DataLoader(train_ds, batch_size=32, shuffle=True)
        val_loader = torch.utils.data.DataLoader(val_ds, batch_size=32)
        
        state_dim = train_ds.states.shape[1]
        obs_dim = train_ds.observations.shape[1]
        
        model = DeepKalmanFilter(state_dim, obs_dim, hidden_dim).to(device)
        optimizer = torch.optim.Adam(model.parameters(), lr=lr)
        criterion = nn.MSELoss()
        
        mlflow.log_params({"state_dim": state_dim, "obs_dim": obs_dim, "epochs": epochs, "lr": lr})
        
        best_val_loss = float('inf')
        
        for epoch in range(epochs):
            model.train()
            train_loss = 0
            for states, obs in train_loader:
                states, obs = states.to(device), obs.to(device)
                optimizer.zero_grad()
                pred_obs = model.predict_observation(states)
                loss = criterion(pred_obs, obs)
                loss.backward()
                optimizer.step()
                train_loss += loss.item()
            
            model.eval()
            val_loss = 0
            with torch.no_grad():
                for states, obs in val_loader:
                    states, obs = states.to(device), obs.to(device)
                    pred_obs = model.predict_observation(states)
                    val_loss += criterion(pred_obs, obs).item()
            
            avg_train, avg_val = train_loss/len(train_loader), val_loss/len(val_loader)
            mlflow.log_metrics({"train_loss": avg_train, "val_loss": avg_val}, step=epoch)
            
            if avg_val < best_val_loss:
                best_val_loss = avg_val
                Path(model_path).parent.mkdir(parents=True, exist_ok=True)
                torch.save(model.state_dict(), model_path)
                logger.info(f"Epoch {epoch}: Best loss {best_val_loss:.6f}")

        # Export final
        url = upload_to_supabase(model_path, os.getenv('SUPABASE_BUCKET_NAME', 'pinn-models'), f"kalman/kalman_prod_{datetime.now().strftime('%Y%m%d')}.pt")
        logger.info(f"✅ Modèle exporté : {url or 'Local'}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--train_data_path", default="data/processed/train_kalman.npz")
    parser.add_argument("--val_data_path", default="data/processed/val_kalman.npz")
    parser.add_argument("--model_output_path", default="models/deep_kalman_filter.pt")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--hidden_dim", type=int, default=128)
    args = parser.parse_args()
    
    train_kalman_production(args.train_data_path, args.val_data_path, 
                            args.model_output_path, args.epochs, args.lr, args.hidden_dim)
