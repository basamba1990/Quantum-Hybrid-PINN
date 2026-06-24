import torch
import torch.nn as nn
import numpy as np
try:
    from fluid_properties import FLUID_CONFIGS, get_eos
except ImportError:
    from .fluid_properties import FLUID_CONFIGS, get_eos

T_MIN, T_MAX = 0.0, 1000.0 # s
X_MIN, X_MAX = -5.0, 5.0 # m (Réservoir 4.57m)
Y_MIN, Y_MAX = -5.0, 5.0 # m
Z_MIN, Z_MAX = -5.0, 5.0 # m
U_SCALE = 0.1 # m/s (Convection naturelle LH2 lente)
TEMP_SCALE = 50.0 # K (Plage cryogénique)
RHO_SCALE = 71.0 # kg/m3 (Densité LH2 à 20K)

class PINN3DNavierStokes(nn.Module):
    def __init__(self, layers=None, fluid_type='H2', dropout_rate=0.1, enable_dropout=False):
        super().__init__()
        # Architecture par défaut réduite à 64 neurones (correspond au modèle entraîné)
        if layers is None:
            layers = [4, 64, 64, 64, 5]   # <--- MODIFIÉ
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
        self.enable_dropout = enable_dropout

        self.linears = nn.ModuleList()
        for i in range(len(layers) - 1):
            linear = nn.Linear(layers[i], layers[i + 1])
            nn.init.xavier_uniform_(linear.weight, gain=0.5)
            nn.init.zeros_(linear.bias)
            self.linears.append(linear)
        self.dropouts = nn.ModuleList([nn.Dropout(dropout_rate) for _ in range(len(layers)-2)]) if enable_dropout else None

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

        rho = (torch.sigmoid(out[..., 0:1])) * RHO_SCALE + 1.0
        u = (torch.tanh(out[..., 1:2])) * U_SCALE
        v = (torch.tanh(out[..., 2:3])) * U_SCALE
        w = (torch.tanh(out[..., 3:4])) * U_SCALE
        T = (torch.sigmoid(out[..., 4:5])) * TEMP_SCALE + 14.0 # H2 triple point = 13.8K
        return rho, u, v, w, T

    def _safe_grad(self, y, x, create_graph=True):
        grads = torch.autograd.grad(y.sum(), x, create_graph=create_graph, allow_unused=True)
        if grads[0] is None:
            return torch.zeros_like(x, requires_grad=create_graph)
        return grads[0]

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T, scale_dict=None):
        if not t.requires_grad:
            t.requires_grad_(True)
        if not x.requires_grad:
            x.requires_grad_(True)
        if not y.requires_grad:
            y.requires_grad_(True)
        if not z.requires_grad:
            z.requires_grad_(True)

        rho = rho.clone().requires_grad_(True)
        u = u.clone().requires_grad_(True)
        v = v.clone().requires_grad_(True)
        w = w.clone().requires_grad_(True)
        T = T.clone().requires_grad_(True)

        # Dérivées premières
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

        # Dérivées secondes
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

        p = get_eos(self.fluid_type, rho, T)
        p_x = self._safe_grad(p, x)
        p_y = self._safe_grad(p, y)
        p_z = self._safe_grad(p, z)

        mass = rho_t + (rho_x * u + rho * u_x) + (rho_y * v + rho * v_y) + (rho_z * w + rho * w_z)
        mu = self.config['mu']
        mom_x = rho * (u_t + u * u_x + v * u_y + w * u_z) + p_x - mu * (u_xx + u_yy + u_zz)
        mom_y = rho * (v_t + u * v_x + v * v_y + w * v_z) + p_y - mu * (v_xx + v_yy + v_zz)
        mom_z = rho * (w_t + u * w_x + v * w_y + w * w_z) + p_z - mu * (w_xx + w_yy + w_zz)

        Cp = self.config['Cp']
        k_therm = self.config['k']
        dissipation = mu * (2 * (u_x**2 + v_y**2 + w_z**2) +
                           (u_y + v_x)**2 + (u_z + w_x)**2 + (v_z + w_y)**2)
        work_pressure = -(p_x * u + p_y * v + p_z * w) - p * (u_x + v_y + w_z)
        energy = (rho * Cp * (T_t + u * T_x + v * T_y + w * T_z) -
                  k_therm * (T_xx + T_yy + T_zz) - dissipation - work_pressure)

        if scale_dict is not None:
            mass = mass / scale_dict['mass']
            mom_x = mom_x / scale_dict['mom']
            mom_y = mom_y / scale_dict['mom']
            mom_z = mom_z / scale_dict['mom']
            energy = energy / scale_dict['energy']
            return mass, mom_x, mom_y, mom_z, energy
        else:
            if mass.numel() <= 1:
                scales = {'mass': 1.0, 'mom': 1.0, 'energy': 1.0}
            else:
                scales = {
                    'mass': torch.std(mass).item() + 1e-6,
                    'mom': torch.std(mom_x).item() + 1e-6,
                    'energy': torch.std(energy).item() + 1e-6
                }
            return mass, mom_x, mom_y, mom_z, energy, scales

    def loss(self, t_pde, x_pde, y_pde, z_pde, scale_dict):
        rho, u, v, w, T = self.forward(t_pde, x_pde, y_pde, z_pde)
        mass, mom_x, mom_y, mom_z, energy = self.compute_residuals(
            t_pde, x_pde, y_pde, z_pde, rho, u, v, w, T, scale_dict=scale_dict)
        return (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()
