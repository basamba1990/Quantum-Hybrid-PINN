import torch
import torch.nn as nn
import numpy as np
from fluid_properties import FLUID_CONFIGS, get_eos

T_MIN, T_MAX = 0.0, 3600.0
X_MIN, X_MAX = 0.0, 100000.0
Y_MIN, Y_MAX = -0.25, 0.25
Z_MIN, Z_MAX = -0.25, 0.25
U_MIN, U_MAX = 0.0, 20.0
TEMP_MIN, TEMP_MAX = 200.0, 400.0

class PINN3DNavierStokes(nn.Module):
    def __init__(self, layers=None, fluid_type='H2', dropout_rate=0.1, enable_dropout=False):
        super().__init__()
        if layers is None:
            layers = [4, 128, 128, 128, 5]
        self.layers_list = layers
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
        self.enable_dropout = enable_dropout
        self.dropout_rate = dropout_rate

        self.linears = nn.ModuleList()
        self.dropouts = nn.ModuleList() if enable_dropout else None
        for i in range(len(layers) - 1):
            self.linears.append(nn.Linear(layers[i], layers[i + 1]))
            nn.init.xavier_normal_(self.linears[-1].weight)
            nn.init.zeros_(self.linears[-1].bias)
            if enable_dropout and i < len(layers) - 2:
                self.dropouts.append(nn.Dropout(dropout_rate))

    def forward(self, t, x, y, z):
        t_norm = (t - T_MIN) / (T_MAX - T_MIN)
        x_norm = (x - X_MIN) / (X_MAX - X_MIN)
        y_norm = (y - Y_MIN) / (Y_MAX - Y_MIN)
        z_norm = (z - Z_MIN) / (Z_MAX - Z_MIN)
        inp = torch.cat([t_norm, x_norm, y_norm, z_norm], dim=-1)

        for i, layer in enumerate(self.linears[:-1]):
            inp = torch.tanh(layer(inp))
            if self.enable_dropout and self.dropouts is not None and i < len(self.dropouts):
                inp = self.dropouts[i](inp)
        out = self.linears[-1](inp)

        rho = out[..., 0:1] * 100 + 0.1
        u = out[..., 1:2] * (U_MAX - U_MIN) + U_MIN
        v = out[..., 2:3] * (U_MAX - U_MIN) + U_MIN
        w = out[..., 3:4] * (U_MAX - U_MIN) + U_MIN
        T = out[..., 4:5] * (TEMP_MAX - TEMP_MIN) + TEMP_MIN
        return rho, u, v, w, T

    def _safe_grad(self, y, x, create_graph=True):
        """Retourne le gradient ou un tenseur nul si le gradient est None."""
        grads = torch.autograd.grad(y.sum(), x, create_graph=create_graph, allow_unused=True)
        if grads[0] is None:
            return torch.zeros_like(x)
        return grads[0]

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T):
        t = t.clone().detach().requires_grad_(True)
        x = x.clone().detach().requires_grad_(True)
        y = y.clone().detach().requires_grad_(True)
        z = z.clone().detach().requires_grad_(True)

        # First derivatives
        rho_t = self._safe_grad(rho, t)
        rho_x = self._safe_grad(rho, x)
        rho_y = self._safe_grad(rho, y)
        rho_z = self._safe_grad(rho, z)

        u_t = self._safe_grad(u, t)
        u_x = self._safe_grad(u, x)
        u_y = self._safe_grad(u, y)
        u_z = self._safe_grad(u, z)

        v_t = self._safe_grad(v, t)
        v_x = self._safe_grad(v, x)
        v_y = self._safe_grad(v, y)
        v_z = self._safe_grad(v, z)

        w_t = self._safe_grad(w, t)
        w_x = self._safe_grad(w, x)
        w_y = self._safe_grad(w, y)
        w_z = self._safe_grad(w, z)

        T_t = self._safe_grad(T, t)
        T_x = self._safe_grad(T, x)
        T_y = self._safe_grad(T, y)
        T_z = self._safe_grad(T, z)

        # Second derivatives
        u_xx = self._safe_grad(u_x, x)
        u_yy = self._safe_grad(u_y, y)
        u_zz = self._safe_grad(u_z, z)

        v_xx = self._safe_grad(v_x, x)
        v_yy = self._safe_grad(v_y, y)
        v_zz = self._safe_grad(v_z, z)

        w_xx = self._safe_grad(w_x, x)
        w_yy = self._safe_grad(w_y, y)
        w_zz = self._safe_grad(w_z, z)

        T_xx = self._safe_grad(T_x, x)
        T_yy = self._safe_grad(T_y, y)
        T_zz = self._safe_grad(T_z, z)

        # Pressure via EOS
        p = get_eos(self.fluid_type, rho, T)
        p_x = self._safe_grad(p, x)
        p_y = self._safe_grad(p, y)
        p_z = self._safe_grad(p, z)

        # Continuity
        mass_res = rho_t + (rho_x * u + rho * u_x) + (rho_y * v + rho * v_y) + (rho_z * w + rho * w_z)

        # Viscosity
        mu = self.config['mu']

        # Momentum
        momentum_x_res = rho * (u_t + u * u_x + v * u_y + w * u_z) + p_x - mu * (u_xx + u_yy + u_zz)
        momentum_y_res = rho * (v_t + u * v_x + v * v_y + w * v_z) + p_y - mu * (v_xx + v_yy + v_zz)
        momentum_z_res = rho * (w_t + u * w_x + v * w_y + w * w_z) + p_z - mu * (w_xx + w_yy + w_zz)

        # Energy
        Cp = self.config['Cp']
        k_therm = self.config['k']
        dissipation = mu * (2 * (u_x**2 + v_y**2 + w_z**2) +
                           (u_y + v_x)**2 + (u_z + w_x)**2 + (v_z + w_y)**2)

        source_term = 0.0
        if self.config.get('kinetics') == 'temkin_pyzhev':
            Ea = self.config['Ea']
            delta_H = self.config['delta_H']
            R_gas = 8.314
            rate = torch.exp(-Ea / (R_gas * T)) * (p / 1e6) ** 1.5
            source_term = -delta_H * rate * rho

        work_pressure = -(p_x * u + p_y * v + p_z * w) - p * (u_x + v_y + w_z)
        energy_res = (rho * Cp * (T_t + u * T_x + v * T_y + w * T_z) -
                      k_therm * (T_xx + T_yy + T_zz) - dissipation - source_term - work_pressure)

        return mass_res, momentum_x_res, momentum_y_res, momentum_z_res, energy_res

    def loss(self, t_pde, x_pde, y_pde, z_pde, t_bc=None, x_bc=None, y_bc=None, z_bc=None, u_bc_target=None):
        rho, u, v, w, T = self.forward(t_pde, x_pde, y_pde, z_pde)
        mass, mom_x, mom_y, mom_z, energy = self.compute_residuals(t_pde, x_pde, y_pde, z_pde, rho, u, v, w, T)
        pde_loss = (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()

        bc_loss = torch.tensor(0.0, device=t_pde.device)
        if t_bc is not None:
            _, u_bc, v_bc, w_bc, _ = self.forward(t_bc, x_bc, y_bc, z_bc)
            if u_bc_target is not None:
                bc_loss = ((u_bc - u_bc_target)**2).mean() + (v_bc**2).mean() + (w_bc**2).mean()
            else:
                bc_loss = (u_bc**2).mean() + (v_bc**2).mean() + (w_bc**2).mean()
        return pde_loss + 10.0 * bc_loss
