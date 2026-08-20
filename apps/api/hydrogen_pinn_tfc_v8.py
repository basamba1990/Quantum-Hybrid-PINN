import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Optional, Any

# Imports internes corrigés
from generic_pinn_solver import GenericPINNSolver
from deep_kalman_filter import DeepKalmanFilter
from quantum_eos_torch import SilveraGoldmanEOS, integrate_eos_in_pinn_loss
from geometry_handler import GeometryHandler
from salt_cavern_physics import SaltCavernPhysics
from pinn_3d_navier_stokes import T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX

# Helper pour le device
def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")


class HydrogenPINNTFCV8:
    """
    Version améliorée de HydrogenPINN utilisant un solveur PINN générique, EOS quantique et DKF.
    """
    def __init__(self, layers: List[int] = None, fluid_type: str = 'H2', geometry_type: str = "pipeline", geometry_params: Dict[str, Any] = None):
        self.device = get_device()
        self.fluid_type = fluid_type
        if layers is None:
            # Rétabli à l'architecture originale pour compatibilité avec les poids entraînés
            layers = [4, 128, 128, 128, 128, 5]  # 4 entrées (t,x,y,z), 5 sorties (rho, u, v, w, T)
        
        # Initialisation du GeometryHandler
        if geometry_params is None:
            if geometry_type == "pipeline":
                geometry_params = {"radius": 0.5, "length": 12.0}
            elif geometry_type == "lh2_storage":
                geometry_params = {"radius": 2.285} # Exemple pour un réservoir sphérique
            elif geometry_type == "salt_cavern":
                geometry_params = {"x_center": 0.0, "y_center": 0.0, "z_center": -1000.0, "major_radius": 100.0, "minor_radius": 50.0}
            else:
                geometry_params = {}

        self.geometry_handler = GeometryHandler(geometry_type=geometry_type, params=geometry_params)
        
        # Initialisation de SaltCavernPhysics si applicable
        self.salt_cavern_physics = None
        if geometry_type == "salt_cavern":
            self.salt_cavern_physics = SaltCavernPhysics(params=geometry_params)

        # Utilisation du GenericPINNSolver
        self.pinn_model = GenericPINNSolver(layers, fluid_type=fluid_type, geometry_handler=self.geometry_handler, salt_cavern_physics=self.salt_cavern_physics).to(self.device)
        self.dkl_model = DeepKalmanFilter(state_dim=5, observation_dim=3).to(self.device)
        self.eos_model = SilveraGoldmanEOS(device=self.device)

        # Échelles de normalisation pour les résidus (initialisées à None, calculées au premier entraînement)
        self.scales = None

    def calculate_residuals(self, t, x, y, z):
        """Calcule les résidus pour un ensemble de points"""
        rho, u, v, w, T = self.pinn_model(t, x, y, z)
        mass, mx, my, mz, energy = self.pinn_model.compute_residuals(t, x, y, z, rho, u, v, w, T, scale_dict=self.scales)
        return {
            "continuity": mass,
            "momentum_x": mx,
            "momentum_y": my,
            "momentum_z": mz,
            "energy": energy
        }

    def train_pinn(self, epochs: int = 5000, learning_rate: float = 1e-3, N_pde: int = 5000) -> Dict[str, List[float]]:
        """
        Entraîne le modèle PINN générique.
        """
        optimizer = torch.optim.Adam(self.pinn_model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        history = {"loss": []}

        for epoch in range(epochs):
            optimizer.zero_grad()
            
            # Génération des points de collocation à l'intérieur de la géométrie
            t_pde, x_pde, y_pde, z_pde = self.geometry_handler.get_sampling_points(N_pde)
            t_pde = t_pde.to(self.device).requires_grad_(True)
            x_pde = x_pde.to(self.device).requires_grad_(True)
            y_pde = y_pde.to(self.device).requires_grad_(True)
            z_pde = z_pde.to(self.device).requires_grad_(True)

            # Calcul des résidus et des échelles si c'est la première itération
            if self.scales is None:
                rho, u, v, w, T = self.pinn_model(t_pde, x_pde, y_pde, z_pde)
                _, _, _, _, _, self.scales = self.pinn_model.compute_residuals(t_pde, x_pde, y_pde, z_pde, rho, u, v, w, T, scale_dict=None)
            
            total_loss = self.pinn_model.loss(t_pde, x_pde, y_pde, z_pde, self.scales)

            total_loss.backward()
            optimizer.step()
            scheduler.step()
            history["loss"].append(total_loss.item())

            if (epoch + 1) % 500 == 0:
                print(f"Generic PINN Epoch {epoch+1}/{epochs}, Loss: {total_loss.item():.6e}")

        return history

    def predict_state_with_uncertainty(self, t: float, x: float, y: float, z: float, n_samples: int = 20) -> Dict[str, any]:
        """
        Prédiction avec quantification d'incertitude via MC Dropout.
        Indispensable pour le caractère "Truly-Industrial".
        """
        self.pinn_model.train() # Activer le dropout pour MC Dropout
        t_t = torch.tensor([[t]] * n_samples, dtype=torch.float32, device=self.device)
        x_t = torch.tensor([[x]] * n_samples, dtype=torch.float32, device=self.device)
        y_t = torch.tensor([[y]] * n_samples, dtype=torch.float32, device=self.device)
        z_t = torch.tensor([[z]] * n_samples, dtype=torch.float32, device=self.device)
        
        with torch.no_grad():
            rho, u, v, w, T = self.pinn_model(t_t, x_t, y_t, z_t)
            p = self.eos_model(rho, T)
            
        # Moyenne et écart-type (incertitude)
        return {
            "pressure": {"mean": p.mean().item(), "std": p.std().item()},
            "velocity_u": {"mean": u.mean().item(), "std": u.std().item()},
            "velocity_v": {"mean": v.mean().item(), "std": v.std().item()},
            "velocity_w": {"mean": w.mean().item(), "std": w.std().item()},
            "temperature": {"mean": T.mean().item(), "std": T.std().item()},
            "density": {"mean": rho.mean().item(), "std": rho.std().item()},
            "uncertainty_score": (p.std().item() / (p.mean().item() + 1e-6)) * 100, # % relatif
            "time": t, "x": x, "y": y, "z": z,
            "method": "MC-Dropout-Uncertainty"
        }

    def predict_state(self, t: float, x: float, y: float, z: float) -> Dict[str, float]:
        """
        Prédiction simple (rétro-compatibilité).
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
            "pressure": p.mean().item(),
            "velocity_u": u.mean().item(),
            "velocity_v": v.mean().item(),
            "velocity_w": w.mean().item(),
            "temperature": T.mean().item(),
            "density": rho.mean().item(),
            "time": t, "x": x, "y": y, "z": z,
            "method": "TFC-Enriched"
        }

    def assimilate_data(self, current_state: List[float], observation: List[float]) -> List[float]:
        """
        Assimilate des données via le filtre de Kalman profond (interface API).
        """
        self.dkl_model.eval()
        with torch.no_grad():
            c_t = torch.tensor([current_state], dtype=torch.float32, device=self.device)
            o_t = torch.tensor([observation], dtype=torch.float32, device=self.device)
            x_new = self.dkl_model.assimilate_batch(c_t, o_t)
            return x_new.cpu().numpy()[0].tolist()

    def assimilate_observation(self, current_state: torch.Tensor, observation: torch.Tensor) -> torch.Tensor:
        """
        Assimilate une observation via le filtre de Kalman profond.
        """
        x_new = self.dkl_model.assimilate_batch(current_state, observation)
        return x_new


if __name__ == "__main__":
    # Exemple d'utilisation avec une géométrie de cylindre
    cyl_params = {"radius": 0.5, "length": 10.0}
    model = HydrogenPINNTFCV8(fluid_type='H2', geometry_type="cylinder", geometry_params=cyl_params)
    print("Modèle Hydrogen PINN TFC V8 avec géométrie cylindrique initialisé.")

    # Exemple d'utilisation avec une géométrie de cavité saline
    salt_cavern_params = {"x_center": 0.0, "y_center": 0.0, "z_center": -1000.0, "major_radius": 100.0, "minor_radius": 50.0}
    model_salt_cavern = HydrogenPINNTFCV8(fluid_type='H2', geometry_type="salt_cavern", geometry_params=salt_cavern_params)
    print("Modèle Hydrogen PINN TFC V8 avec géométrie de cavité saline initialisé.")

    # Entraînement (exemple simplifié)
    # history = model.train_pinn(epochs=100) # Pour un entraînement réel, augmenter les epochs
    # print(f"Perte finale: {history['loss'][-1]}")

    # Prédiction
    # pred = model.predict_state(t=0.1, x=0.1, y=0.1, z=0.1)
    # print(f"Prédiction: {pred}")

    # Prédiction avec incertitude
    # pred_unc = model.predict_state_with_uncertainty(t=0.1, x=0.1, y=0.1, z=0.1)
    # print(f"Prédiction avec incertitude: {pred_unc}")
