
import torch
import torch.nn as nn
import numpy as np
from torch.utils.data import DataLoader, TensorDataset
import sys
import os
import argparse
import mlflow
from datetime import datetime

# Ajout du chemin pour importer l'orchestrateur réel
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../apps/api')))
from fno_pipeline_orchestrator import FNO3d

def train_fno_production(data_path, model_output_path, epochs=100, batch_size=8):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🚀 PRODUCTION : Entraînement FNO3D Réel sur {device}")

    # 1. Chargement des données déterministes (Matrice ISO 19880)
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"❌ Erreur Industrielle : Données manquantes à {data_path}")
    
    data = np.load(data_path)
    x_train = torch.tensor(data['x'], dtype=torch.float32)
    y_train = torch.tensor(data['y'], dtype=torch.float32)

    dataset = TensorDataset(x_train, y_train)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # 2. Initialisation de l'architecture FNO3D réelle
    model = FNO3d(modes1=8, modes2=8, modes3=8, width=20).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    criterion = nn.MSELoss()
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    # 3. MLflow Tracking
    mlflow.set_experiment("Quantum-Hybrid-FNO-Industrial")
    with mlflow.start_run():
        mlflow.log_params({"epochs": epochs, "batch_size": batch_size, "device": str(device)})
        
        # 4. Boucle d'entraînement haute-fidélité
        model.train()
        for epoch in range(epochs):
            total_loss = 0
            for x, y in loader:
                x, y = x.to(device), y.to(device)
                optimizer.zero_grad()
                out = model(x)
                loss = criterion(out, y)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
            
            avg_loss = total_loss / len(loader)
            scheduler.step()
            mlflow.log_metric("mse_loss", avg_loss, step=epoch)
            
            if epoch % 10 == 0:
                print(f"Époque {epoch}/{epochs} - Loss: {avg_loss:.8f}")

        # 5. Sauvegarde
        os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
        torch.save(model.state_dict(), model_output_path)
        print(f"✅ MODÈLE FNO PRÊT POUR DÉPLOIEMENT : {model_output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_path", default="data/processed/fno_train.npz")
    parser.add_argument("--output_path", default="models/fno_model.pt")
    parser.add_argument("--epochs", type=int, default=100)
    args = parser.parse_args()

    train_fno_production(
        data_path=args.data_path,
        model_output_path=args.output_path,
        epochs=args.epochs
    )
