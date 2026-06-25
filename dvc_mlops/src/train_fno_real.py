
import torch
import torch.nn as nn
import numpy as np
from torch.utils.data import DataLoader, TensorDataset
import sys
import os

# Ajout du chemin pour importer l'orchestrateur
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../apps/api')))
from fno_pipeline_orchestrator import FNO3d

def train_fno_industrial(data_path, model_output_path, epochs=100, batch_size=4):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🚀 Entraînement FNO Industriel sur {device}")

    # 1. Chargement des données OpenFOAM traitées
    if not os.path.exists(data_path):
        print(f"❌ Données non trouvées à {data_path}. Génération de données synthétiques pour la structure.")
        x_train = torch.randn(20, 16, 16, 16, 5)
        y_train = torch.randn(20, 16, 16, 16, 5)
    else:
        data = np.load(data_path)
        # On suppose que les données sont déjà au format (N, 16, 16, 16, 5)
        x_train = torch.tensor(data['x'], dtype=torch.float32)
        y_train = torch.tensor(data['y'], dtype=torch.float32)

    dataset = TensorDataset(x_train, y_train)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # 2. Initialisation du modèle réel
    model = FNO3d(modes1=8, modes2=8, modes3=8, width=20).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    criterion = nn.MSELoss()

    # 3. Boucle d'entraînement
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
        
        if epoch % 10 == 0:
            print(f"Époque {epoch}/{epochs} - Perte: {total_loss/len(loader):.6f}")

    # 4. Sauvegarde
    os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
    torch.save(model.state_dict(), model_output_path)
    print(f"✅ Modèle FNO Industriel sauvegardé : {model_output_path}")

if __name__ == "__main__":
    train_fno_industrial(
        data_path="data/processed/fno_train.npz",
        model_output_path="models/fno_model.pt"
    )
