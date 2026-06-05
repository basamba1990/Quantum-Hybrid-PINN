import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging

from pinn_3d_navier_stokes import PINN3DNavierStokes, T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
from deep_kalman_filter import DeepKalmanFilter
from quantum_eos_torch import SilveraGoldmanEOS, integrate_eos_in_pinn_loss

logger = logging.getLogger(__name__)

def get_device():
    if torch.cuda.is_available(): return torch.device("cuda")
    if torch.backends.mps.is_available(): return torch.device("mps")
    return torch.device("cpu")

class HydrogenPINNV8:
    def __init__(self, layers: List[int] = None, fluid_type: str = 'H2'):
        self.device = get_device()
        self.fluid_type = fluid_type
        self.pinn_model = PINN3DNavierStokes(layers, fluid_type=fluid_type).to(self.device)
        self.dkl_model = DeepKalmanFilter(state_dim=5, observation_dim=3).to(self.device)
        self.eos_model = SilveraGoldmanEOS(device=self.device)

    def predict_batch(self, t: np.ndarray, x: np.ndarray, y: np.ndarray, z: np.ndarray) -> Dict:
        self.pinn_model.eval()
        t_t = torch.from_numpy(t).float().view(-1, 1).to(self.device)
        x_t = torch.from_numpy(x).float().view(-1, 1).to(self.device)
        y_t = torch.from_numpy(y).float().view(-1, 1).to(self.device)
        z_t = torch.from_numpy(z).float().view(-1, 1).to(self.device)

        with torch.no_grad():
            rho, u, v, w, T = self.pinn_model(t_t, x_t, y_t, z_t)
            p = self.eos_model(rho, T)
            
            # Calcul des résidus réels par différenciation automatique
            t_t.requires_grad_(True)
            x_t.requires_grad_(True)
            y_t.requires_grad_(True)
            z_t.requires_grad_(True)
            rho_p, u_p, v_p, w_p, T_p = self.pinn_model(t_t, x_t, y_t, z_t)
            res_dict = self.pinn_model.compute_residuals(t_t, x_t, y_t, z_t, rho_p, u_p, v_p, w_p, T_p)

        return {
            "pressure": p.cpu().numpy().flatten(),
            "velocity_u": u.cpu().numpy().flatten(),
            "velocity_v": v.cpu().numpy().flatten(),
            "velocity_w": w.cpu().numpy().flatten(),
            "temperature": T.cpu().numpy().flatten(),
            "residuals": {k: float(torch.norm(v).cpu().item()) for k, v in res_dict.items()}
        }

    def assimilate(self, state: List[float], observation: List[float]) -> List[float]:
        """Véritable assimilation de données via Deep Kalman Filter"""
        self.dkl_model.eval()
        with torch.no_grad():
            s_t = torch.tensor([state], dtype=torch.float32, device=self.device)
            o_t = torch.tensor([observation], dtype=torch.float32, device=self.device)
            P = torch.eye(5, device=self.device).unsqueeze(0) * 0.1
            assimilated, _ = self.dkl_model.assimilate(s_t, P, o_t)
        return assimilated.squeeze().tolist()
