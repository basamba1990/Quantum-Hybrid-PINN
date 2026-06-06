import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging

from pinn_3d_navier_stokes import PINN3DNavierStokes, L_REF, U_REF, RHO_REF, T_REF, TIME_REF
from deep_kalman_filter import DeepKalmanFilter
from quantum_eos_torch import SilveraGoldmanEOS

logger = logging.getLogger(__name__)

def get_device():
    if torch.cuda.is_available(): return torch.device("cuda")
    if torch.backends.mps.is_available(): return torch.device("mps")
    return torch.device("cpu")

class HydrogenPINNV8:
    """
    Wrapper de haut niveau pour la simulation hydrogène.
    Gère la conversion entre unités physiques (SI) et unités PINN (Adimensionnelles).
    """
    def __init__(self, layers: List[int] = None, fluid_type: str = 'H2'):
        self.device = get_device()
        self.fluid_type = fluid_type
        
        # Modèle PINN Adimensionnel
        self.pinn_model = PINN3DNavierStokes(layers, fluid_type=fluid_type).to(self.device)
        
        # Assimilation de données (DKF)
        self.dkl_model = DeepKalmanFilter(state_dim=5, observation_dim=3).to(self.device)

        # EOS Quantique
        self.eos_model = SilveraGoldmanEOS(device=self.device)

    def predict_state(self, t_phys: float, x_phys: float, y_phys: float, z_phys: float) -> Dict:
        """
        Prédiction physique réelle.
        Convertit les entrées SI en adimensionnel, exécute le PINN, et reconvertit en SI.
        """
        self.pinn_model.eval()
        
        # Normalisation des entrées
        t_star = torch.tensor([[t_phys / TIME_REF]], dtype=torch.float32, device=self.device)
        x_star = torch.tensor([[x_phys / L_REF]], dtype=torch.float32, device=self.device)
        y_star = torch.tensor([[y_phys / L_REF]], dtype=torch.float32, device=self.device)
        z_star = torch.tensor([[z_phys / L_REF]], dtype=torch.float32, device=self.device)

        with torch.no_grad():
            rho_s, u_s, v_s, w_s, T_s = self.pinn_model(t_star, x_star, y_star, z_star)
            
            # Conversion en SI
            rho = rho_s.item() * RHO_REF
            u = u_s.item() * U_REF
            v = v_s.item() * U_REF
            w = w_s.item() * U_REF
            T = T_s.item() * T_REF
            
            # Pression via EOS Quantique (Réelle)
            p = self.eos_model(torch.tensor([[rho]]), torch.tensor([[T]])).item()

        return {
            "pressure": float(p),
            "velocity_u": float(u),
            "velocity_v": float(v),
            "velocity_w": float(w),
            "temperature": float(T),
            "density": float(rho),
            "time": t_phys,
            "x": x_phys, "y": y_phys, "z": z_phys
        }

    def predict_batch(self, t: np.ndarray, x: np.ndarray, y: np.ndarray, z: np.ndarray) -> Dict:
        """Version vectorisée pour les graphiques."""
        self.pinn_model.eval()
        
        t_s = torch.from_numpy(t).float().view(-1, 1).to(self.device) / TIME_REF
        x_s = torch.from_numpy(x).float().view(-1, 1).to(self.device) / L_REF
        y_s = torch.from_numpy(y).float().view(-1, 1).to(self.device) / L_REF
        z_s = torch.from_numpy(z).float().view(-1, 1).to(self.device) / L_REF

        with torch.no_grad():
            rho_s, u_s, v_s, w_s, T_s = self.pinn_model(t_s, x_s, y_s, z_s)
            
            rho = rho_s * RHO_REF
            u = u_s * U_REF
            v = v_s * U_REF
            w = w_s * U_REF
            T = T_s * T_REF
            p = self.eos_model(rho, T)

        return {
            "pressure": p.cpu().numpy().flatten(),
            "velocity_u": u.cpu().numpy().flatten(),
            "velocity_v": v.cpu().numpy().flatten(),
            "velocity_w": w.cpu().numpy().flatten(),
            "temperature": T.cpu().numpy().flatten(),
            "density": rho.cpu().numpy().flatten(),
        }

    def assimilate_data(self, current_state: List[float], observation: List[float]) -> List[float]:
        """Assimilation via Deep Kalman Filter."""
        self.dkl_model.eval()
        with torch.no_grad():
            state_tensor = torch.tensor([current_state], dtype=torch.float32, device=self.device)
            obs_tensor = torch.tensor([observation], dtype=torch.float32, device=self.device)
            P_init = torch.eye(self.dkl_model.state_dim, device=self.device).unsqueeze(0) * 0.1
            assimilated_state, _ = self.dkl_model.assimilate(state_tensor, P_init, obs_tensor)
        return assimilated_state.squeeze().tolist()
