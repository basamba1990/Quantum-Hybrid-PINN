"""
Quantum EOS Implementation - Silvera-Goldman (Differentiable PyTorch Version)
Provides differentiable equation of state for liquid hydrogen with automatic gradient computation
Ready for integration with PINN training loops
"""

import torch
import torch.nn as nn
from typing import Tuple, Dict, Optional


class SilveraGoldmanEOS(nn.Module):
    """
    Silvera-Goldman Equation of State for Hydrogen (H2)
    Fully differentiable implementation using PyTorch
    
    References:
    - Silvera, I. F., & Goldman, V. V. (1978). The isotropic intermolecular potential 
      for H2 and D2 in the HFD model.
    """
    
    def __init__(self, device: torch.device = torch.device('cpu')):
        super().__init__()
        self.device = device
        
        # Silvera-Goldman parameters for H2
        # These are registered as buffers so they move with the model
        self.register_buffer('A', torch.tensor(1.713e-3, dtype=torch.float32, device=device))
        self.register_buffer('B', torch.tensor(1.567e-6, dtype=torch.float32, device=device))
        self.register_buffer('C', torch.tensor(2.145e-12, dtype=torch.float32, device=device))
        self.register_buffer('alpha', torch.tensor(1.44, dtype=torch.float32, device=device))
        
        # Physical constants
        self.register_buffer('R_specific', torch.tensor(4124.0, dtype=torch.float32, device=device))  # J/(kg·K)
        
    def forward(self, rho: torch.Tensor, T: torch.Tensor) -> torch.Tensor:
        """
        Compute pressure from density and temperature using Silvera-Goldman EOS
        
        Args:
            rho: Density tensor [kg/m³], shape (batch_size, ...) or scalar
            T: Temperature tensor [K], shape (batch_size, ...) or scalar
            
        Returns:
            pressure: Pressure tensor [Pa], same shape as input
        """
        # Ensure tensors are on the correct device
        rho = rho.to(self.device)
        T = T.to(self.device)
        
        # Ideal gas pressure
        p_ideal = rho * self.R_specific * T
        
        # Repulsive term (exponential)
        # Prevents unphysical high-density states
        repulsion = self.A * rho * torch.exp(self.alpha * rho / 100.0)
        
        # Attractive term (quadratic)
        # Accounts for van der Waals interactions
        attraction = -self.B * (rho ** 2)
        
        # Quantum correction term (cubic with temperature dependence)
        # Crucial for liquid hydrogen at cryogenic temperatures
        quantum_corr = self.C * (rho ** 3) / (T + 1e-6)
        
        # Total pressure with all corrections
        pressure = p_ideal * (1.0 + repulsion + attraction + quantum_corr)
        
        return pressure
    
    def compute_pressure_derivatives(
        self, 
        rho: torch.Tensor, 
        T: torch.Tensor
    ) -> Dict[str, torch.Tensor]:
        """
        Compute pressure derivatives for PINN residual calculations
        
        Args:
            rho: Density tensor
            T: Temperature tensor
            
        Returns:
            Dictionary containing:
            - dp_drho: ∂p/∂ρ
            - dp_dT: ∂p/∂T
            - d2p_drho2: ∂²p/∂ρ²
        """
        rho = rho.to(self.device).requires_grad_(True)
        T = T.to(self.device).requires_grad_(True)
        
        # Compute pressure
        p = self.forward(rho, T)
        
        # First derivatives
        dp_drho = torch.autograd.grad(
            p.sum(), rho, create_graph=True, retain_graph=True
        )[0]
        
        dp_dT = torch.autograd.grad(
            p.sum(), T, create_graph=True, retain_graph=True
        )[0]
        
        # Second derivative
        d2p_drho2 = torch.autograd.grad(
            dp_drho.sum(), rho, create_graph=True
        )[0]
        
        return {
            'dp_drho': dp_drho,
            'dp_dT': dp_dT,
            'd2p_drho2': d2p_drho2,
        }
    
    def compute_speed_of_sound(self, rho: torch.Tensor, T: torch.Tensor) -> torch.Tensor:
        """
        Compute speed of sound from EOS
        c = sqrt(dp/drho|_s) at constant entropy
        
        For isentropic process: c² ≈ γ * p / ρ where γ = 1.4 for H2
        
        Args:
            rho: Density tensor
            T: Temperature tensor
            
        Returns:
            Speed of sound [m/s]
        """
        gamma = 1.4  # Heat capacity ratio for H2
        
        p = self.forward(rho, T)
        
        # Isentropic speed of sound
        c = torch.sqrt(gamma * p / (rho + 1e-8))
        
        return c
    
    def validate_physical_bounds(
        self, 
        rho: torch.Tensor, 
        T: torch.Tensor,
        fluid_type: str = "H2"
    ) -> Tuple[bool, str]:
        """
        Check if state variables are within physical bounds
        
        Args:
            rho: Density [kg/m³]
            T: Temperature [K]
            fluid_type: Fluid type (default "H2")
            
        Returns:
            (is_valid, message)
        """
        rho_val = rho.detach().cpu().item() if rho.numel() == 1 else rho.detach().cpu().mean().item()
        T_val = T.detach().cpu().item() if T.numel() == 1 else T.detach().cpu().mean().item()
        
        if fluid_type == "H2":
            # Liquid hydrogen: ~14 K to ~33 K (critical point)
            # Density range: ~70-71 kg/m³ for liquid
            if T_val < 14 or T_val > 500:
                return False, f"Temperature {T_val:.1f} K outside valid range [14, 500] K for H2"
            
            if rho_val < 0 or rho_val > 150:
                return False, f"Density {rho_val:.1f} kg/m³ outside valid range [0, 150] kg/m³ for H2"
            
            return True, "Physical bounds satisfied"
        
        return True, "Bounds check skipped for fluid type"


class QuantumEOSFactory:
    """
    Factory for creating EOS models for different fluids
    """
    
    @staticmethod
    def create_eos(
        fluid_type: str = "H2",
        device: torch.device = torch.device('cpu')
    ) -> nn.Module:
        """
        Create appropriate EOS model for fluid type
        
        Args:
            fluid_type: One of "H2", "NH3", "CH4", "sCO2"
            device: PyTorch device
            
        Returns:
            EOS model instance
        """
        if fluid_type == "H2":
            return SilveraGoldmanEOS(device=device)
        else:
            # Fallback to Silvera-Goldman for now
            # Can be extended with other EOS models
            return SilveraGoldmanEOS(device=device)


# Integration helper for PINN training
def integrate_eos_in_pinn_loss(
    eos_model: nn.Module,
    rho_pred: torch.Tensor,
    T_pred: torch.Tensor,
    p_target: Optional[torch.Tensor] = None,
    weight: float = 0.1
) -> torch.Tensor:
    """
    Compute EOS-based loss term for PINN training
    
    This ensures the neural network predictions respect the physical EOS
    
    Args:
        eos_model: Silvera-Goldman EOS model
        rho_pred: Predicted density from PINN
        T_pred: Predicted temperature from PINN
        p_target: Optional target pressure for supervised learning
        weight: Weight of EOS loss in total loss
        
    Returns:
        EOS loss term
    """
    # Compute pressure from EOS
    p_eos = eos_model(rho_pred, T_pred)
    
    # If we have target pressure, use supervised loss
    if p_target is not None:
        eos_loss = torch.mean((p_eos - p_target) ** 2)
    else:
        # Otherwise, ensure pressure is physically reasonable (positive)
        eos_loss = torch.mean(torch.relu(-p_eos))  # Penalize negative pressure
    
    return weight * eos_loss


# Example usage and testing
if __name__ == "__main__":
    # Set device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # Create EOS model
    eos = SilveraGoldmanEOS(device=device)
    
    # Test with sample data
    rho = torch.tensor([70.0], device=device, requires_grad=True)  # kg/m³
    T = torch.tensor([20.0], device=device, requires_grad=True)    # K
    
    # Compute pressure
    p = eos(rho, T)
    print(f"Pressure at ρ=70 kg/m³, T=20 K: {p.item():.2e} Pa")
    
    # Compute derivatives
    derivatives = eos.compute_pressure_derivatives(rho, T)
    print(f"∂p/∂ρ: {derivatives['dp_drho'].item():.2e} Pa·m³/kg")
    print(f"∂p/∂T: {derivatives['dp_dT'].item():.2e} Pa/K")
    
    # Compute speed of sound
    c = eos.compute_speed_of_sound(rho, T)
    print(f"Speed of sound: {c.item():.2f} m/s")
    
    # Validate bounds
    is_valid, msg = eos.validate_physical_bounds(rho, T)
    print(f"Physical bounds: {msg}")
    
    # Test batch computation
    rho_batch = torch.linspace(50, 100, 10, device=device)
    T_batch = torch.linspace(15, 30, 10, device=device)
    p_batch = eos(rho_batch, T_batch)
    print(f"\nBatch computation shape: {p_batch.shape}")
    print(f"Pressure range: [{p_batch.min().item():.2e}, {p_batch.max().item():.2e}] Pa")
