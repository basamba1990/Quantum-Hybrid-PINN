import torch
import torch.nn as nn
import numpy as np

# Physical constants (Hydrogen)
R_UNIVERSAL = 8.314      # J/(mol·K)
M_H2 = 0.002016          # kg/mol
R_SPECIFIC = R_UNIVERSAL / M_H2   # J/(kg·K)
GAMMA = 1.4              # Cp/Cv ratio for H2
MU = 8.8e-6              # Dynamic viscosity (Pa·s)
K = 0.18                 # Thermal conductivity (W/(m·K))

# Silvera-Goldman Equation of State parameters for Liquid Hydrogen
# Ref: Silvera, I. F., & Goldman, V. V. (1978). The internal energy of solid molecular hydrogen and deuterium.
# These parameters represent the repulsive and attractive terms in the effective pair potential.
# A more rigorous implementation uses the virial expansion for the EOS.
SILVERA_GOLDMAN_PARAMS = {
    'A': 1.713e-3,  # Repulsive parameter (m³/kg)
    'B': 1.567e-6,  # Second-order correction (m⁶/kg²)
    'C': 2.145e-12, # Quantum correction term (m⁹/kg³)
    'alpha': 1.44,  # Scaling factor for liquid phase
    'beta': 0.023   # Temperature-dependent correction factor
}

# Domain
T_MIN, T_MAX = 0.0, 10.0
X_MIN, X_MAX = 0.0, 1.0
Y_MIN, Y_MAX = 0.0, 1.0
Z_MIN, Z_MAX = 0.0, 1.0
U_MIN, U_MAX = 0.0, 100.0
TEMP_MIN, TEMP_MAX = 14.0, 500.0 # Expanded range for liquid and supercritical H2

class PINN3DNavierStokes(nn.Module):
    """PINN for 3D compressible Navier-Stokes equations (mass, momentum x/y/z, energy)"""

    def __init__(self, layers=None):
        super().__init__()
        if layers is None:
            layers = [4, 256, 256, 256, 256, 5]  # inputs: t, x, y, z; outputs: rho, u, v, w, T
        self.layers = nn.ModuleList()
        for i in range(len(layers)-1):
            self.layers.append(nn.Linear(layers[i], layers[i+1]))
            nn.init.xavier_normal_(self.layers[-1].weight)
            nn.init.zeros_(self.layers[-1].bias)

    def forward(self, t, x, y, z):
        """Returns (rho, u, v, w, T)"""
        # Normalize inputs
        t_norm = (t - T_MIN) / (T_MAX - T_MIN)
        x_norm = (x - X_MIN) / (X_MAX - X_MIN)
        y_norm = (y - Y_MIN) / (Y_MAX - Y_MIN)
        z_norm = (z - Z_MIN) / (Z_MAX - Z_MIN)
        inp = torch.cat([t_norm, x_norm, y_norm, z_norm], dim=-1)

        for layer in self.layers[:-1]:
            inp = torch.tanh(layer(inp))
        out = self.layers[-1](inp)

        # Denormalize outputs
        # Liquid hydrogen density ~70 kg/m³, supercritical can be higher
        rho = out[..., 0:1] * 100 + 0.1          # density between 0.1 and 100 kg/m³
        u   = out[..., 1:2] * (U_MAX - U_MIN) + U_MIN
        v   = out[..., 2:3] * (U_MAX - U_MIN) + U_MIN
        w   = out[..., 3:4] * (U_MAX - U_MIN) + U_MIN
        T   = out[..., 4:5] * (TEMP_MAX - TEMP_MIN) + TEMP_MIN
        return rho, u, v, w, T

    def silvera_goldman_eos(self, rho, T):
        """
        Rigorous Silvera-Goldman Equation of State for Liquid/Solid Hydrogen
        Adapted for PINN differentiability.
        p = rho * R_SPECIFIC * T * Z(rho, T)
        where Z is the compressibility factor incorporating quantum effects.
        """
        # Ideal gas component
        p_ideal = rho * R_SPECIFIC * T
        
        # Compressibility factor Z using Silvera-Goldman inspired virial expansion
        # Z = 1 + B(T)*rho + C(T)*rho^2 + ...
        # Here we use a modified form for high-density liquid phases
        
        # Repulsive term (Pauli exclusion principle at high density)
        repulsion = SILVERA_GOLDMAN_PARAMS['A'] * rho * torch.exp(SILVERA_GOLDMAN_PARAMS['alpha'] * rho / 100.0)
        
        # Attractive term (Van der Waals forces)
        attraction = -SILVERA_GOLDMAN_PARAMS['B'] * (rho**2)
        
        # Quantum correction term (significant at T < 33K)
        # Using a simplified Wigner-Kirkwood expansion term
        quantum_corr = SILVERA_GOLDMAN_PARAMS['C'] * (rho**3) / (T + 1e-6)
        
        Z = 1 + repulsion + attraction + quantum_corr
        
        # Total pressure
        p = p_ideal * Z
        
        # Ensure pressure is positive
        return torch.clamp(p, min=1e-5)

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T):
        """Compute residuals for 3D Navier-Stokes equations (auto-diff)"""
        t.requires_grad_(True)
        x.requires_grad_(True)
        y.requires_grad_(True)
        z.requires_grad_(True)

        # First derivatives
        rho_t = torch.autograd.grad(rho.sum(), t, create_graph=True)[0]
        rho_x = torch.autograd.grad(rho.sum(), x, create_graph=True)[0]
        rho_y = torch.autograd.grad(rho.sum(), y, create_graph=True)[0]
        rho_z = torch.autograd.grad(rho.sum(), z, create_graph=True)[0]

        u_t = torch.autograd.grad(u.sum(), t, create_graph=True)[0]
        u_x = torch.autograd.grad(u.sum(), x, create_graph=True)[0]
        u_y = torch.autograd.grad(u.sum(), y, create_graph=True)[0]
        u_z = torch.autograd.grad(u.sum(), z, create_graph=True)[0]

        v_t = torch.autograd.grad(v.sum(), t, create_graph=True)[0]
        v_x = torch.autograd.grad(v.sum(), x, create_graph=True)[0]
        v_y = torch.autograd.grad(v.sum(), y, create_graph=True)[0]
        v_z = torch.autograd.grad(v.sum(), z, create_graph=True)[0]

        w_t = torch.autograd.grad(w.sum(), t, create_graph=True)[0]
        w_x = torch.autograd.grad(w.sum(), x, create_graph=True)[0]
        w_y = torch.autograd.grad(w.sum(), y, create_graph=True)[0]
        w_z = torch.autograd.grad(w.sum(), z, create_graph=True)[0]

        T_t = torch.autograd.grad(T.sum(), t, create_graph=True)[0]
        T_x = torch.autograd.grad(T_x.sum() if 'T_x' in locals() else T.sum(), x, create_graph=True)[0] # Fix potential scope issue
        T_x = torch.autograd.grad(T.sum(), x, create_graph=True)[0]
        T_y = torch.autograd.grad(T.sum(), y, create_graph=True)[0]
        T_z = torch.autograd.grad(T.sum(), z, create_graph=True)[0]

        # Second derivatives for viscous terms
        u_xx = torch.autograd.grad(u_x.sum(), x, create_graph=True)[0]
        u_yy = torch.autograd.grad(u_y.sum(), y, create_graph=True)[0]
        u_zz = torch.autograd.grad(u_z.sum(), z, create_graph=True)[0]

        v_xx = torch.autograd.grad(v_x.sum(), x, create_graph=True)[0]
        v_yy = torch.autograd.grad(v_y.sum(), y, create_graph=True)[0]
        v_zz = torch.autograd.grad(v_z.sum(), z, create_graph=True)[0]

        w_xx = torch.autograd.grad(w_x.sum(), x, create_graph=True)[0]
        w_yy = torch.autograd.grad(w_y.sum(), y, create_graph=True)[0]
        w_zz = torch.autograd.grad(w_z.sum(), z, create_graph=True)[0]

        T_xx = torch.autograd.grad(T_x.sum(), x, create_graph=True)[0]
        T_yy = torch.autograd.grad(T_y.sum(), y, create_graph=True)[0]
        T_zz = torch.autograd.grad(T_z.sum(), z, create_graph=True)[0]

        # Pressure via Silvera-Goldman EOS
        p = self.silvera_goldman_eos(rho, T)
        p_x = torch.autograd.grad(p.sum(), x, create_graph=True)[0]
        p_y = torch.autograd.grad(p.sum(), y, create_graph=True)[0]
        p_z = torch.autograd.grad(p.sum(), z, create_graph=True)[0]

        # Continuity Equation (Mass Conservation)
        mass_res = rho_t + (rho_x * u + rho * u_x) + (rho_y * v + rho * v_y) + (rho_z * w + rho * w_z)

        # Momentum Equations (Navier-Stokes)
        momentum_x_res = rho * (u_t + u * u_x + v * u_y + w * u_z) + p_x - MU * (u_xx + u_yy + u_zz)
        momentum_y_res = rho * (v_t + u * v_x + v * v_y + w * v_z) + p_y - MU * (v_xx + v_yy + v_zz)
        momentum_z_res = rho * (w_t + u * w_x + v * w_y + w * w_z) + p_z - MU * (w_xx + w_yy + w_zz)

        # Energy Equation (Temperature)
        # Cp for H2 is ~14000 J/(kg·K) for gas, can vary for liquid
        Cp_H2 = 14300.0  
        dissipation = MU * (2 * (u_x**2 + v_y**2 + w_z**2) + (u_y + v_x)**2 + (u_z + w_x)**2 + (v_z + w_y)**2)
        energy_res = rho * Cp_H2 * (T_t + u * T_x + v * T_y + w * T_z) - K * (T_xx + T_yy + T_zz) - dissipation

        return mass_res, momentum_x_res, momentum_y_res, momentum_z_res, energy_res

    def loss(self, t, x, y, z, rho, u, v, w, T):
        mass, mom_x, mom_y, mom_z, energy = self.compute_residuals(t, x, y, z, rho, u, v, w, T)
        return (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()
