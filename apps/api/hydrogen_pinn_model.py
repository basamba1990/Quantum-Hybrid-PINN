"""
Physics-Informed Neural Network (PINN) for Hydrogen Storage Simulation
Implements conservation laws and real gas equation for H2 at high pressure
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Tuple, Dict, List

# Physical constants for hydrogen
MU_H2 = 8.8e-6  # Dynamic viscosity (Pa·s)
R_UNIVERSAL = 8.314  # Universal gas constant (J/(mol·K))
M_H2 = 0.002016  # Molar mass of H2 (kg/mol)

# Computational domain
T_MIN, T_MAX = 0.0, 10.0  # Time (seconds)
X_MIN, X_MAX = 0.0, 1.0   # Position (normalized)
P_MIN, P_MAX = 1e5, 700e5  # Pressure (1 bar to 700 bar)
U_MIN, U_MAX = 0.0, 100.0  # Velocity (m/s)
TEMP_MIN, TEMP_MAX = 250.0, 350.0  # Temperature (K)


class HydrogenPINN(nn.Module):
    """Physics-Informed Neural Network for hydrogen dynamics"""

    def __init__(self, layers: List[int] = None):
        super().__init__()
        if layers is None:
            layers = [2, 64, 64, 64, 3]

        self.layers = nn.ModuleList()
        for i in range(len(layers) - 1):
            self.layers.append(nn.Linear(layers[i], layers[i + 1]))

        # Xavier initialization
        for layer in self.layers:
            nn.init.xavier_normal_(layer.weight)
            nn.init.zeros_(layer.bias)

    def forward(self, t: torch.Tensor, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass: predict pressure, velocity, temperature
        Args:
            t: Time tensor (normalized)
            x: Position tensor (normalized)
        Returns:
            p: Pressure (Pa)
            u: Velocity (m/s)
            T: Temperature (K)
        """
        # Normalize inputs
        t_norm = (t - T_MIN) / (T_MAX - T_MIN)
        x_norm = (x - X_MIN) / (X_MAX - X_MIN)

        # Stack inputs
        inputs = torch.cat([t_norm, x_norm], dim=-1)

        # Forward through network with tanh activation
        for i, layer in enumerate(self.layers[:-1]):
            inputs = torch.tanh(layer(inputs))

        # Output layer
        outputs = self.layers[-1](inputs)

        # Denormalize outputs
        p = outputs[..., 0:1] * (P_MAX - P_MIN) + P_MIN
        u = outputs[..., 1:2] * (U_MAX - U_MIN) + U_MIN
        T = outputs[..., 2:3] * (TEMP_MAX - TEMP_MIN) + TEMP_MIN

        return p, u, T

    def compute_physics_loss(
        self,
        t: torch.Tensor,
        x: torch.Tensor,
        p: torch.Tensor,
        u: torch.Tensor,
        T: torch.Tensor,
    ) -> torch.Tensor:
        """
        Compute physics loss from conservation laws
        Implements:
        - Mass conservation (continuity)
        - Momentum conservation (Navier-Stokes 1D)
        - Real gas equation (Redlich-Kwong)
        """
        # Enable gradient computation
        t.requires_grad_(True)
        x.requires_grad_(True)

        # Compute density from real gas law
        z = self.compressibility_factor(p, T)
        rho = (p * M_H2) / (z * R_UNIVERSAL * T)

        # Compute derivatives
        dp_dt = torch.autograd.grad(p.sum(), t, create_graph=True)[0]
        dp_dx = torch.autograd.grad(p.sum(), x, create_graph=True)[0]
        du_dt = torch.autograd.grad(u.sum(), t, create_graph=True)[0]
        du_dx = torch.autograd.grad(u.sum(), x, create_graph=True)[0]
        d2u_dx2 = torch.autograd.grad(du_dx.sum(), x, create_graph=True)[0]
        dT_dt = torch.autograd.grad(T.sum(), t, create_graph=True)[0]

        # Mass conservation: ∂ρ/∂t + ∂(ρu)/∂x = 0
        drho_dt = torch.autograd.grad(rho.sum(), t, create_graph=True)[0]
        drho_dx = torch.autograd.grad(rho.sum(), x, create_graph=True)[0]
        mass_loss = (drho_dt + rho * du_dx + u * drho_dx) ** 2

        # Momentum conservation: ∂(ρu)/∂t + ∂(ρu²)/∂x + ∂p/∂x = μ∂²u/∂x²
        momentum_loss = (
            rho * du_dt + rho * u * du_dx + dp_dx - MU_H2 * d2u_dx2
        ) ** 2

        # Energy equation (simplified)
        energy_loss = (dT_dt + u * torch.autograd.grad(T.sum(), x, create_graph=True)[0]) ** 2

        return mass_loss.mean() + momentum_loss.mean() + energy_loss.mean()

    @staticmethod
    def compressibility_factor(p: torch.Tensor, T: torch.Tensor) -> torch.Tensor:
        """
        Redlich-Kwong equation of state for compressibility factor
        z = p*V/(n*R*T)
        """
        # Redlich-Kwong constants for H2
        a = 0.4278 * (R_UNIVERSAL ** 2) * (154.3 ** 2) / 40.53e5
        b = 0.0867 * R_UNIVERSAL * 154.3 / 40.53e5

        # Simplified compressibility factor
        z = 1 + (b * p) / (R_UNIVERSAL * T) - (a / (torch.sqrt(T) * (R_UNIVERSAL ** 2) * T)) * (p / (R_UNIVERSAL * T))
        return torch.clamp(z, min=0.1, max=2.0)


def generate_training_data(
    N_pde: int = 5000,
    N_ic: int = 500,
    N_bc: int = 500,
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """
    Generate training data for PDE, initial conditions, and boundary conditions
    """
    # PDE points (interior)
    t_pde = torch.rand(N_pde, 1) * (T_MAX - T_MIN) + T_MIN
    x_pde = torch.rand(N_pde, 1) * (X_MAX - X_MIN) + X_MIN

    # Initial conditions (t=0)
    t_ic = torch.zeros(N_ic, 1)
    x_ic = torch.rand(N_ic, 1) * (X_MAX - X_MIN) + X_MIN

    # Boundary conditions (x=0, x=1)
    t_bc = torch.rand(N_bc, 1) * (T_MAX - T_MIN) + T_MIN
    x_bc = torch.cat([torch.zeros(N_bc // 2, 1), torch.ones(N_bc // 2, 1)])

    return (t_pde, x_pde), (t_ic, x_ic), (t_bc, x_bc)


def train_pinn(
    model: HydrogenPINN,
    epochs: int = 5000,
    learning_rate: float = 1e-3,
    N_pde: int = 5000,
    N_ic: int = 500,
    N_bc: int = 500,
) -> Dict[str, List[float]]:
    """
    Train the PINN model
    """
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1000, gamma=0.5)

    history = {"loss": [], "pde_loss": [], "ic_loss": [], "bc_loss": []}

    (t_pde, x_pde), (t_ic, x_ic), (t_bc, x_bc) = generate_training_data(N_pde, N_ic, N_bc)

    for epoch in range(epochs):
        optimizer.zero_grad()

        # PDE loss
        p_pde, u_pde, T_pde = model(t_pde, x_pde)
        pde_loss = model.compute_physics_loss(t_pde, x_pde, p_pde, u_pde, T_pde)

        # Initial conditions loss
        p_ic, u_ic, T_ic = model(t_ic, x_ic)
        ic_loss = (
            ((p_ic - 1e5) ** 2).mean()
            + (u_ic ** 2).mean()
            + ((T_ic - 300) ** 2).mean()
        )

        # Boundary conditions loss
        p_bc, u_bc, T_bc = model(t_bc, x_bc)
        bc_loss = ((u_bc) ** 2).mean() + ((T_bc - 300) ** 2).mean()

        # Total loss
        total_loss = pde_loss + ic_loss + bc_loss

        total_loss.backward()
        optimizer.step()
        scheduler.step()

        history["loss"].append(total_loss.item())
        history["pde_loss"].append(pde_loss.item())
        history["ic_loss"].append(ic_loss.item())
        history["bc_loss"].append(bc_loss.item())

        if (epoch + 1) % 500 == 0:
            print(f"Epoch {epoch + 1}/{epochs}, Loss: {total_loss.item():.6e}")

    return history


def predict_hydrogen_state(
    model: HydrogenPINN,
    t: float,
    x: float,
) -> Dict[str, float]:
    """
    Make a prediction at a specific time and position
    """
    with torch.no_grad():
        t_tensor = torch.tensor([[t]], dtype=torch.float32)
        x_tensor = torch.tensor([[x]], dtype=torch.float32)
        p, u, T = model(t_tensor, x_tensor)

    return {
        "pressure": p.item(),
        "velocity": u.item(),
        "temperature": T.item(),
        "time": t,
        "position": x,
    }