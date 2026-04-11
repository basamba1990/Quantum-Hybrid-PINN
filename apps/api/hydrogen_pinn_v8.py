import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List

from pinn_3d_navier_stokes import PINN3DNavierStokes, T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
from deep_kalman_filter import DeepKalmanFilter

# Utility function to get device
def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")

class HydrogenPINNV8:
    def __init__(self, layers: List[int] = None):
        self.device = get_device()
        self.pinn_model = PINN3DNavierStokes(layers).to(self.device)
        # Assuming state_dim for DKL is (rho, u, v, w, T) = 5
        # Assuming observation_dim is 3 (pressure, temperature, flow rate)
        self.dkl_model = DeepKalmanFilter(state_dim=5, observation_dim=3).to(self.device)

    def train_pinn(self, epochs: int = 5000, learning_rate: float = 1e-3, N_pde: int = 5000) -> Dict[str, List[float]]:
        optimizer = torch.optim.Adam(self.pinn_model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

        history = {"loss": []}

        # Generate training data points for PDE residuals
        t_pde = torch.rand(N_pde, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN
        x_pde = torch.rand(N_pde, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN
        y_pde = torch.rand(N_pde, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN
        z_pde = torch.rand(N_pde, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN

        for epoch in range(epochs):
            optimizer.zero_grad()

            rho_pred, u_pred, v_pred, w_pred, T_pred = self.pinn_model(t_pde, x_pde, y_pde, z_pde)
            pde_loss = self.pinn_model.loss(t_pde, x_pde, y_pde, z_pde, rho_pred, u_pred, v_pred, w_pred, T_pred)

            total_loss = pde_loss

            total_loss.backward()
            optimizer.step()
            scheduler.step()

            history["loss"].append(total_loss.item())

            if (epoch + 1) % 500 == 0:
                print(f"Epoch {epoch + 1}/{epochs}, Loss: {total_loss.item():.6e}")

        return history

    def predict_state(self, t: float, x: float, y: float, z: float):
        self.pinn_model.eval()
        with torch.no_grad():
            t_tensor = torch.tensor([[t]], dtype=torch.float32, device=self.device)
            x_tensor = torch.tensor([[x]], dtype=torch.float32, device=self.device)
            y_tensor = torch.tensor([[y]], dtype=torch.float32, device=self.device)
            z_tensor = torch.tensor([[z]], dtype=torch.float32, device=self.device)
            rho, u, v, w, T = self.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
            p = self.pinn_model.silvera_goldman_eos(rho, T)

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
        }

    def assimilate_data(self, current_state: List[float], observation: List[float]):
        self.dkl_model.eval()
        with torch.no_grad():
            state_tensor = torch.tensor([current_state], dtype=torch.float32, device=self.device)
            obs_tensor = torch.tensor([observation], dtype=torch.float32, device=self.device)
            assimilated_state = self.dkl_model.assimilate(state_tensor, obs_tensor)
        return assimilated_state.squeeze().tolist()