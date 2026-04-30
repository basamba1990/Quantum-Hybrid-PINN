"""
Quantum EOS Implementation - Silvera-Goldman (Differentiable PyTorch Version)
Version industrielle avec gestion des limites physiques et gradients stables.
"""

import torch
import torch.nn as nn
from typing import Tuple, Dict, Optional


class SilveraGoldmanEOS(nn.Module):
    """
    Silvera-Goldman Equation of State for Hydrogen (H2)
    Fully differentiable implementation with physical bounds checking.
    """
    def __init__(self, device: torch.device = torch.device('cpu')):
        super().__init__()
        self.device = device

        # Silvera-Goldman parameters (constants, not trainable)
        self.register_buffer('A', torch.tensor(1.713e-3, dtype=torch.float32, device=device))
        self.register_buffer('B', torch.tensor(1.567e-6, dtype=torch.float32, device=device))
        self.register_buffer('C', torch.tensor(2.145e-12, dtype=torch.float32, device=device))
        self.register_buffer('alpha', torch.tensor(1.44, dtype=torch.float32, device=device))

        # Specific gas constant for H2 [J/(kg·K)]
        self.register_buffer('R_specific', torch.tensor(4124.0, dtype=torch.float32, device=device))

    def forward(self, rho: torch.Tensor, T: torch.Tensor) -> torch.Tensor:
        """
        Compute pressure from density and temperature using Silvera-Goldman EOS.

        Args:
            rho: Density [kg/m³]
            T: Temperature [K]

        Returns:
            pressure: Pressure [Pa]
        """
        # Clamp to avoid numerical issues
        rho_safe = torch.clamp(rho, min=1e-6)
        T_safe = torch.clamp(T, min=1.0)

        # Ideal gas pressure
        p_ideal = rho_safe * self.R_specific * T_safe

        # Exponential repulsion term (prevents unphysical high densities)
        repulsion = self.A * rho_safe * torch.exp(self.alpha * rho_safe / 100.0)

        # Attractive term (quadratic)
        attraction = -self.B * (rho_safe ** 2)

        # Quantum correction (cubic, temperature-dependent)
        quantum_corr = self.C * (rho_safe ** 3) / T_safe

        # Total pressure
        pressure = p_ideal * (1.0 + repulsion + attraction + quantum_corr)

        # Ensure non-negative pressure (physical)
        pressure = torch.clamp(pressure, min=0.0)

        return pressure

    def compute_pressure_derivatives(self, rho: torch.Tensor, T: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Compute first and second derivatives of pressure w.r.t. density and temperature.
        """
        rho.requires_grad_(True)
        T.requires_grad_(True)
        p = self.forward(rho, T)

        dp_drho = torch.autograd.grad(p.sum(), rho, create_graph=True, retain_graph=True)[0]
        dp_dT   = torch.autograd.grad(p.sum(), T, create_graph=True, retain_graph=True)[0]
        d2p_drho2 = torch.autograd.grad(dp_drho.sum(), rho, create_graph=True)[0]

        return {
            'dp_drho': dp_drho,
            'dp_dT': dp_dT,
            'd2p_drho2': d2p_drho2,
        }

    def compute_speed_of_sound(self, rho: torch.Tensor, T: torch.Tensor) -> torch.Tensor:
        """Compute isentropic speed of sound."""
        gamma = 1.4  # Heat capacity ratio for H2
        p = self.forward(rho, T)
        return torch.sqrt(gamma * p / (rho + 1e-8))

    def validate_physical_bounds(self, rho: torch.Tensor, T: torch.Tensor, fluid_type: str = "H2") -> Tuple[bool, str]:
        """Check if state is within physically valid ranges."""
        rho_val = rho.detach().cpu().item() if rho.numel() == 1 else rho.detach().cpu().mean().item()
        T_val = T.detach().cpu().item() if T.numel() == 1 else T.detach().cpu().mean().item()

        if fluid_type == "H2":
            if T_val < 14 or T_val > 500:
                return False, f"Temperature {T_val:.1f} K outside [14,500]"
            if rho_val < 0 or rho_val > 150:
                return False, f"Density {rho_val:.1f} kg/m³ outside [0,150]"
        return True, "Within bounds"


def integrate_eos_in_pinn_loss(eos_model: nn.Module, rho_pred: torch.Tensor, T_pred: torch.Tensor,
                               p_target: Optional[torch.Tensor] = None, weight: float = 0.1) -> torch.Tensor:
    """
    Compute EOS-based loss term for PINN training.
    """
    p_eos = eos_model(rho_pred, T_pred)
    if p_target is not None:
        loss = torch.mean((p_eos - p_target) ** 2)
    else:
        # Penalize negative pressure
        loss = torch.mean(torch.relu(-p_eos))
    return weight * loss


if __name__ == "__main__":
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    eos = SilveraGoldmanEOS(device=device)
    rho = torch.tensor([70.0], device=device)
    T = torch.tensor([20.0], device=device)
    p = eos(rho, T)
    print(f"Pressure = {p.item():.2e} Pa")
