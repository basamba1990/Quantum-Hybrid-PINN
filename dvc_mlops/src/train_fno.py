import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np
import argparse
import mlflow
import json
import os
from pathlib import Path
import logging
from datetime import datetime
from supabase import create_client, Client

# Configuration du logging industriel
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("FNO-Trainer")

class IndustrialFNODataset(Dataset):
    """Dataset PyTorch robuste pour FNO 3D."""
    def __init__(self, file_path, in_channels, out_channels):
        logger.info(f"Chargement du dataset : {file_path}")
        data_struct = np.load(file_path)
        self.data = torch.from_numpy(data_struct['data']).float()
        self.in_channels = in_channels
        self.out_channels = out_channels
        
        if self.data.dim() != 5:
            raise ValueError(f"Format de données invalide : attendu 5D (B,X,Y,Z,C), reçu {self.data.dim()}D")
            
    def __len__(self):
        return len(self.data)
        
    def __getitem__(self, idx):
        sample = self.data[idx]
        x = sample[..., :self.in_channels]
        y = sample[..., :self.out_channels]
        return x, y

def upload_to_supabase(file_path: str, bucket: str, destination_path: str):
    """Télécharge un fichier vers Supabase Storage."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("Supabase credentials missing, skipping upload.")
        return None
        
    try:
        supabase: Client = create_client(url, key)
        with open(file_path, 'rb') as f:
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

def save_metrics_to_supabase(metrics: dict, model_url: str):
    """Enregistre les métriques dans la base de données Supabase."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key: return
    
    try:
        supabase: Client = create_client(url, key)
        supabase.table("model_trainings").insert({
            "model_type": "FNO",
            "metrics": metrics,
            "model_url": model_url,
            "timestamp": datetime.utcnow().isoformat()
        }).execute()
        logger.info("✅ Métriques enregistrées dans Supabase DB.")
    except Exception as e:
        logger.error(f"❌ Échec enregistrement DB Supabase : {e}")

def train():
    parser = argparse.ArgumentParser()
    parser.add_argument('--train_data_path', type=str, required=True)
    parser.add_argument('--val_data_path', type=str, required=True)
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--batch_size', type=int, default=32)
    parser.add_argument('--learning_rate', type=float, default=0.001)
    parser.add_argument('--in_channels', type=int, default=1)
    parser.add_argument('--out_channels', type=int, default=1)
    parser.add_argument('--model_output_path', type=str, default='models/fno_model.pt')
    parser.add_argument('--n_modes', type=int, default=12)
    parser.add_argument('--width', type=int, default=32)
    parser.add_argument('--early_stopping_patience', type=int, default=20)
    parser.add_argument('--scenarios', type=str, default='all')
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Device: {device}")

    # Datasets
    train_ds = IndustrialFNODataset(args.train_data_path, args.in_channels, args.out_channels)
    val_ds = IndustrialFNODataset(args.val_data_path, args.in_channels, args.out_channels)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False)

    # Modèle
    # On importe ici pour s'assurer que le chemin est correct dans l'environnement d'exécution
    import sys
    sys.path.append(os.getcwd())
    from apps.api.fno_3d_navier_stokes import FNO3d
    
    model = FNO3d(
        modes1=args.n_modes, modes2=args.n_modes, modes3=args.n_modes, 
        width=args.width, in_channels=args.in_channels, out_channels=args.out_channels
    ).to(device)
    
    optimizer = torch.optim.Adam(model.parameters(), lr=args.learning_rate)
    criterion = nn.MSELoss()
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min', patience=5, factor=0.5)

    mlflow.set_experiment("FNO_Training_Industrial")
    with mlflow.start_run():
        mlflow.log_params(vars(args))
        best_val_loss = float('inf')
        patience_counter = 0
        
        for epoch in range(args.epochs):
            model.train()
            train_loss = 0
            for x, y in train_loader:
                x, y = x.to(device), y.to(device)
                optimizer.zero_grad()
                out = model(x)
                loss = criterion(out, y)
                loss.backward()
                optimizer.step()
                train_loss += loss.item()
            
            avg_train_loss = train_loss / len(train_loader)
            
            model.eval()
            val_loss = 0
            with torch.no_grad():
                for x, y in val_loader:
                    x, y = x.to(device), y.to(device)
                    out = model(x)
                    val_loss += criterion(out, y).item()
            
            avg_val_loss = val_loss / len(val_loader)
            scheduler.step(avg_val_loss)
            
            mlflow.log_metric("train_loss", avg_train_loss, step=epoch)
            mlflow.log_metric("val_loss", avg_val_loss, step=epoch)
            
            logger.info(f"Epoch {epoch}: Train Loss {avg_train_loss:.6f}, Val Loss {avg_val_loss:.6f}")

            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                patience_counter = 0
                Path(args.model_output_path).parent.mkdir(parents=True, exist_ok=True)
                torch.save(model.state_dict(), args.model_output_path)
            else:
                patience_counter += 1
                
            if patience_counter >= args.early_stopping_patience:
                logger.info("Early stopping triggered.")
                break

        # Finalisation et Upload Supabase
        metrics = {"final_val_loss": best_val_loss, "epochs_completed": epoch + 1}
        with open("metrics/fno_metrics.json", "w") as f:
            json.dump(metrics, f)
            
        model_url = upload_to_supabase(
            args.model_output_path, 
            "models", 
            f"fno/{datetime.now().strftime('%Y%m%d_%H%M%S')}_fno_model.pt"
        )
        save_metrics_to_supabase(metrics, model_url or "local_only")

    logger.info("✅ Entraînement et export Supabase terminés.")

if __name__ == "__main__":
    train()
