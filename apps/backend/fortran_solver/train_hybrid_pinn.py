import torch
import torch.nn as nn
import torch.optim as optim
from fortran_autograd import FortranPINNLoss
import numpy as np

# 1. Définition d'un modèle PINN simple
class SimplePINN(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(3, 64),
            nn.Tanh(),
            nn.Linear(64, 64),
            nn.Tanh(),
            nn.Linear(64, 4) # Sorties: u, v, p, rho
        )
        
    def forward(self, x, y, z):
        inputs = torch.cat([x, y, z], dim=1)
        return self.net(inputs)

def train():
    print("Démarrage de l'entraînement hybride PINN (Moteur Fortran)...")
    
    model = SimplePINN()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    fortran_loss_fn = FortranPINNLoss()
    
    # Données d'entraînement (coordonnées)
    x = torch.rand(100, 1, requires_grad=True)
    y = torch.rand(100, 1, requires_grad=True)
    z = torch.rand(100, 1, requires_grad=True)
    viscosity = torch.full((100, 1), 1.2e-6)
    
    for epoch in range(10):
        optimizer.zero_grad()
        
        # Prédiction
        pred = model(x, y, z)
        u, v, p, rho = pred[:, 0:1], pred[:, 1:2], pred[:, 2:3], pred[:, 3:4]
        
        # Calcul de la perte via le noyau Fortran O3
        loss = fortran_loss_fn(u, v, p, rho, viscosity)
        
        # Backpropagation
        loss.backward()
        optimizer.step()
        
        if epoch % 2 == 0:
            print(f"Epoch {epoch} | Loss (Fortran): {loss.item():.2e}")

    print("Entraînement terminé. Le pont Fortran est opérationnel dans le pipeline.")

if __name__ == "__main__":
    train()
