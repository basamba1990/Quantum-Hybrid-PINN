"""
Hydrogen PINN with TFC (Theory of Functional Connections) – Version industrielle.
Intègre la géométrie du réservoir, l'EOS quantique et le filtre de Kalman profond.
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Optional, Tuple

# Imports internes corrigés
from pinn_3d_navier_stokes import PINN3DNavierStokes, T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
from deep_kalman_filter import DeepKalmanFilter
from quantum_eos_torch import SilveraGoldmanEOS, integrate_eos_in_pinn_loss
from tank_geometry import TankGeometry

# Helper pour le device
def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")


class TFCPINN3DNavierStokes(nn.Module):
    """
    PINN avec contraintes TFC (Théorie des Connexions Fonctionnelles) pour 3D.
    Les conditions aux limites sont satisfaites exactement via une fonction de support.
    """
    def __init__(self, layers: List[int], fluid_type: str = 'H2', geometry: Optional[TankGeometry] = None):
        super().__init__()
        self.layers = layers
        self.fluid_type = fluid_type
        self.geometry = geometry if geometry else TankGeometry(geometry_type="cylindrical", radius=0.5, length=2.0)

        # Réseau de neurones pour la fonction libre (renommé en linears pour compatibilité state_dict)
        self.linears = nn.ModuleList([nn.Linear(layers[i], layers[i+1]) for i in range(len(layers)-1)])
        self.net = nn.Sequential() # Gardé pour compatibilité interne si besoin
        for i in range(len(layers)-2):
            self.net.append(self.linears[i])
            self.net.append(nn.Tanh())
        self.net.append(self.linears[-1])

        # Paramètres d'échelle pour la sortie (bornes physiques)
        self.register_buffer('rho_min', torch.tensor(0.0))
        self.register_buffer('rho_max', torch.tensor(150.0))
        self.register_buffer('T_min', torch.tensor(14.0))
        self.register_buffer('T_max', torch.tensor(500.0))
        self.register_buffer('vel_max', torch.tensor(100.0))

    def forward(self, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> Tuple[torch.Tensor, ...]:
        """
        Retourne (rho, u, v, w, T) satisfaisant les conditions aux limites via TFC.
        """
        # Entrée: (t, x, y, z)
        inp = torch.cat([t, x, y, z], dim=-1)
        raw = self.net(inp)  # (batch, 5)

        # Fonction de support (nulle sur la frontière, positive à l'intérieur)
        mask = self.geometry.get_mask(x, y, z).unsqueeze(-1)  # (batch, 1)

        # Contrainte de Dirichlet: u = 0 sur les parois -> u = mask * u_net
        # On applique mask à toutes les variables pour satisfaire BC homogènes
        rho_net = torch.sigmoid(raw[:, 0:1])  # entre 0 et 1
        rho = self.rho_min + mask * (self.rho_max - self.rho_min) * rho_net

        u = mask * torch.tanh(raw[:, 1:2]) * self.vel_max
        v = mask * torch.tanh(raw[:, 2:3]) * self.vel_max
        w = mask * torch.tanh(raw[:, 3:4]) * self.vel_max

        T_net = torch.sigmoid(raw[:, 4:5])  # entre 0 et 1
        T = self.T_min + mask * (self.T_max - self.T_min) * T_net

        return rho, u, v, w, T

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T, scale_dict=None):
        """
        Calcule les résidus des équations de Navier-Stokes.
        """
        from pinn_3d_navier_stokes import PINN3DNavierStokes
        temp_pinn = PINN3DNavierStokes(fluid_type=self.fluid_type).to(t.device)
        
        # S'assurer que les gradients sont activés
        if not t.requires_grad: t.requires_grad_(True)
        if not x.requires_grad: x.requires_grad_(True)
        if not y.requires_grad: y.requires_grad_(True)
        if not z.requires_grad: z.requires_grad_(True)
        
        return temp_pinn.compute_residuals(t, x, y, z, rho, u, v, w, T, scale_dict=scale_dict)

    def loss(self, t, x, y, z, rho, u, v, w, T) -> torch.Tensor:
        """
        Calcule la perte totale basée sur les résidus.
        """
        mass, mom_x, mom_y, mom_z, energy, _ = self.compute_residuals(t, x, y, z, rho, u, v, w, T)
        loss_val = (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()
        return loss_val


class HydrogenPINNTFCV8:
    """
    Version améliorée de HydrogenPINN utilisant TFC, EOS quantique et DKF.
    """
    def __init__(self, layers: List[int] = None, fluid_type: str = 'H2', geometry_type: str = "cylindrical"):
        self.device = get_device()
        self.fluid_type = fluid_type
        if layers is None:
            layers = [4, 128, 128, 128, 128, 5]  # 4 entrées (t,x,y,z), 5 sorties
        self.geometry = TankGeometry(geometry_type=geometry_type, radius=0.5, length=2.0)
        self.pinn_model = TFCPINN3DNavierStokes(layers, fluid_type=fluid_type, geometry=self.geometry).to(self.device)
        self.dkl_model = DeepKalmanFilter(state_dim=5, observation_dim=3).to(self.device)
        self.eos_model = SilveraGoldmanEOS(device=self.device)

    def calculate_residuals(self, t, x, y, z):
        """Calcule les résidus pour un ensemble de points"""
        rho, u, v, w, T = self.pinn_model(t, x, y, z)
        mass, mx, my, mz, energy, _ = self.pinn_model.compute_residuals(t, x, y, z, rho, u, v, w, T)
        return {
            "continuity": mass,
            "momentum_x": mx,
            "momentum_y": my,
            "momentum_z": mz,
            "energy": energy
        }

    def train_pinn(self, epochs: int = 5000, learning_rate: float = 1e-3, N_pde: int = 5000) -> Dict[str, List[float]]:
        """
        Entraîne le modèle PINN avec TFC.
        """
        optimizer = torch.optim.Adam(self.pinn_model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        history = {"loss": []}

        # Points de collocation aléatoires
        t_pde = torch.rand(N_pde, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN
        x_pde = torch.rand(N_pde, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN
        y_pde = torch.rand(N_pde, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN
        z_pde = torch.rand(N_pde, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN

        for epoch in range(epochs):
            optimizer.zero_grad()
            rho, u, v, w, T = self.pinn_model(t_pde, x_pde, y_pde, z_pde)

            pde_loss = self.pinn_model.loss(t_pde, x_pde, y_pde, z_pde, rho, u, v, w, T)
            eos_loss = integrate_eos_in_pinn_loss(self.eos_model, rho, T, weight=0.1)
            total_loss = pde_loss + eos_loss

            total_loss.backward()
            optimizer.step()
            scheduler.step()
            history["loss"].append(total_loss.item())

            if (epoch + 1) % 500 == 0:
                print(f"TFC-PINN Epoch {epoch+1}/{epochs}, Loss: {total_loss.item():.6e}")

        return history

    def predict_state(self, t: float, x: float, y: float, z: float) -> Dict[str, float]:
        """
        Prédiction en un point donné.
        """
        self.pinn_model.eval()
        with torch.no_grad():
            t_t = torch.tensor([[t]], dtype=torch.float32, device=self.device)
            x_t = torch.tensor([[x]], dtype=torch.float32, device=self.device)
            y_t = torch.tensor([[y]], dtype=torch.float32, device=self.device)
            z_t = torch.tensor([[z]], dtype=torch.float32, device=self.device)
            rho, u, v, w, T = self.pinn_model(t_t, x_t, y_t, z_t)
            p = self.eos_model(rho, T)
        return {
            "pressure": p.item(),
            "velocity_u": u.item(),
            "velocity_v": v.item(),
            "velocity_w": w.item(),
            "temperature": T.item(),
            "density": rho.item(),
            "time": t,
            "x": x,
            "y": y,
            "z": z,
            "method": "TFC-Enriched"
        }

    def assimilate_observation(self, current_state: torch.Tensor, observation: torch.Tensor) -> torch.Tensor:
        """
        Assimilate une observation via le filtre de Kalman profond.
        """
        x_new = self.dkl_model.assimilate_batch(current_state, observation)
        return x_new


if __name__ == "__main__":
    model = HydrogenPINNTFCV8(fluid_type='H2', geometry_type="cylindrical")
    print("Modèle Hydrogen PINN TFC V8 initialisé.")
