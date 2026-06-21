import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np
import argparse
import mlflow
import json
from pathlib import Path
import logging

# Configuration du logging industriel
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("FNO-Industrial-Trainer")

class IndustrialFNODataset(Dataset):
    """Dataset PyTorch robuste pour FNO 3D."""
    def __init__(self, file_path, in_channels, out_channels):
        logger.info(f"Chargement du dataset : {file_path}")
        data_struct = np.load(file_path)
        self.data = torch.from_numpy(data_struct['data']).float()
        self.in_channels = in_channels
        self.out_channels = out_channels
        
        # Validation des dimensions (Batch, X, Y, Z, Channels)
        if self.data.dim() != 5:
            raise ValueError(f"Format de données invalide : attendu 5D, reçu {self.data.dim()}D")
            
    def __len__(self):
        return len(self.data)
        
    def __getitem__(self, idx):
        sample = self.data[idx]
        # Slicing propre des canaux
        x = sample[..., :self.in_channels]
        y = sample[..., :self.out_channels]
        return x, y

def train():
    parser = argparse.ArgumentParser()
    parser.add_argument('--train_data', type=str, required=True)
    parser.add_argument('--val_data', type=str, required=True)
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--batch_size', type=int, default=32)
    parser.add_argument('--lr', type=float, default=0.001)
    parser.add_argument('--in_channels', type=int, default=1)
    parser.add_argument('--out_channels', type=int, default=1)
    parser.add_argument('--model_path', type=str, default='models/fno_industrial.pt')
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Utilisation du device : {device}")

    # Initialisation Datasets
    train_ds = IndustrialFNODataset(args.train_data, args.in_channels, args.out_channels)
    val_ds = IndustrialFNODataset(args.val_data, args.in_channels, args.out_channels)
    
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False)

    # Import dynamique du modèle pour éviter les dépendances circulaires
    from apps.api.fno_3d_navier_stokes import FNO3d
    model = FNO3d(modes1=12, modes2=12, modes3=12, width=32, in_channels=args.in_channels, out_channels=args.out_channels).to(device)
    
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.MSELoss()
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min', patience=5, factor=0.5)

    mlflow.set_experiment("Quantum-Hybrid-FNO-Industrial")
    with mlflow.start_run():
        mlflow.log_params(vars(args))
        
        best_val_loss = float('inf')
        
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
            
            # Validation
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
            
            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                Path(args.model_path).parent.mkdir(parents=True, exist_ok=True)
                torch.save(model.state_dict(), args.model_path)
                logger.info(f"Epoch {epoch}: Nouveau meilleur modèle sauvegardé ({avg_val_loss:.6f})")

    logger.info("Entraînement industriel terminé.")

if __name__ == "__main__":
    train()
