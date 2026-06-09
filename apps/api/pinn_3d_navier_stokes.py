import torch
import torch.nn as nn
import numpy as np
from fluid_properties import FLUID_CONFIGS, get_eos

# Domain (Default Industrial Scale)
T_MIN, T_MAX = 0.0, 3600.0   # 1 hour
X_MIN, X_MAX = 0.0, 100000.0 # 100 km pipeline
Y_MIN, Y_MAX = -0.25, 0.25   # Diameter 0.5m
Z_MIN, Z_MAX = -0.25, 0.25
U_MIN, U_MAX = 0.0, 20.0     # Max velocity 20 m/s
TEMP_MIN, TEMP_MAX = 200.0, 400.0


class PINN3DNavierStokes(nn.Module):
    """PINN for 3D compressible Navier-Stokes equations with multi-fluid support and MC Dropout"""

    def __init__(self, layers=None, fluid_type='H2', dropout_rate=0.1, enable_dropout=False):
        super().__init__()
        if layers is None:
            layers = [4, 256, 256, 256, 256, 5]
        self.layers_list = layers
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
        self.enable_dropout = enable_dropout
        self.dropout_rate = dropout_rate

        # Construction du réseau avec des couches linéaires et Dropout optionnel
        self.linears = nn.ModuleList()
        self.dropouts = nn.ModuleList() if enable_dropout else None
        for i in range(len(layers) - 1):
            self.linears.append(nn.Linear(layers[i], layers[i + 1]))
            nn.init.xavier_normal_(self.linears[-1].weight)
            nn.init.zeros_(self.linears[-1].bias)
            if enable_dropout and i < len(layers) - 2:  # pas de dropout sur la dernière couche
                self.dropouts.append(nn.Dropout(dropout_rate))

    def forward(self, t, x, y, z):
        # Normalize inputs
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

        # Denormalize outputs
        rho = out[..., 0:1] * 100 + 0.1
        u = out[..., 1:2] * (U_MAX - U_MIN) + U_MIN
        v = out[..., 2:3] * (U_MAX - U_MIN) + U_MIN
        w = out[..., 3:4] * (U_MAX - U_MIN) + U_MIN
        T = out[..., 4:5] * (TEMP_MAX - TEMP_MIN) + TEMP_MIN
        return rho, u, v, w, T

    # =========================================================================
    # MC Dropout inference methods
    # =========================================================================
    def predict_with_uncertainty(self, t, x, y, z, n_samples=20):
        """
        Effectue n_samples prédictions stochastiques avec Dropout actif.
        Retourne (mean, variance) pour chaque variable de sortie.
        """
        if not self.enable_dropout:
            raise RuntimeError("Model not configured with dropout. Set enable_dropout=True in __init__.")

        self.train()  # active Dropout
        predictions = []
        with torch.no_grad():
            for _ in range(n_samples):
                rho, u, v, w, T = self.forward(t, x, y, z)
                predictions.append(torch.stack([rho, u, v, w, T], dim=-1))
        self.eval()
        pred_tensor = torch.stack(predictions, dim=0)  # (n_samples, batch, 5)
        mean = pred_tensor.mean(dim=0)
        var = pred_tensor.var(dim=0)
        return mean, var

    def compute_uncertainty_map(self, t, x, y, z, field_index=0, n_samples=20):
        """
        Calcule la variance spatiale pour un champ donné (0=rho, 1=u, 2=v, 3=w, 4=T).
        Retourne un numpy array de la variance.
        """
        mean, var = self.predict_with_uncertainty(t, x, y, z, n_samples)
        var_field = var[..., field_index].cpu().numpy()
        return var_field

    # =========================================================================
    # Physics residual computation (Navier-Stokes)
    # =========================================================================
    def compute_residuals(self, t, x, y, z, rho, u, v, w, T):
        t.requires_grad_(True)
        x.requires_grad_(True)
        y.requires_grad_(True)
        z.requires_grad_(True)

        # First derivatives
        rho_t = torch.autograd.grad(rho.sum(), t, create_graph=True, allow_unused=True)[0]
        if rho_t is None:
            rho_t = torch.zeros_like(t)
        rho_x = torch.autograd.grad(rho.sum(), x, create_graph=True, allow_unused=True)[0]
        if rho_x is None:
            rho_x = torch.zeros_like(x)
        rho_y = torch.autograd.grad(rho.sum(), y, create_graph=True, allow_unused=True)[0]
        if rho_y is None:
            rho_y = torch.zeros_like(y)
        rho_z = torch.autograd.grad(rho.sum(), z, create_graph=True, allow_unused=True)[0]
        if rho_z is None:
            rho_z = torch.zeros_like(z)

        u_t = torch.autograd.grad(u.sum(), t, create_graph=True, allow_unused=True)[0]
        if u_t is None:
            u_t = torch.zeros_like(t)
        u_x = torch.autograd.grad(u.sum(), x, create_graph=True, allow_unused=True)[0]
        if u_x is None:
            u_x = torch.zeros_like(x)
        u_y = torch.autograd.grad(u.sum(), y, create_graph=True, allow_unused=True)[0]
        if u_y is None:
            u_y = torch.zeros_like(y)
        u_z = torch.autograd.grad(u.sum(), z, create_graph=True, allow_unused=True)[0]
        if u_z is None:
            u_z = torch.zeros_like(z)

        v_t = torch.autograd.grad(v.sum(), t, create_graph=True, allow_unused=True)[0]
        if v_t is None:
            v_t = torch.zeros_like(t)
        v_x = torch.autograd.grad(v.sum(), x, create_graph=True, allow_unused=True)[0]
        if v_x is None:
            v_x = torch.zeros_like(x)
        v_y = torch.autograd.grad(v.sum(), y, create_graph=True, allow_unused=True)[0]
        if v_y is None:
            v_y = torch.zeros_like(y)
        v_z = torch.autograd.grad(v.sum(), z, create_graph=True, allow_unused=True)[0]
        if v_z is None:
            v_z = torch.zeros_like(z)

        w_t = torch.autograd.grad(w.sum(), t, create_graph=True, allow_unused=True)[0]
        if w_t is None:
            w_t = torch.zeros_like(t)
        w_x = torch.autograd.grad(w.sum(), x, create_graph=True, allow_unused=True)[0]
        if w_x is None:
            w_x = torch.zeros_like(x)
        w_y = torch.autograd.grad(w.sum(), y, create_graph=True, allow_unused=True)[0]
        if w_y is None:
            w_y = torch.zeros_like(y)
        w_z = torch.autograd.grad(w.sum(), z, create_graph=True, allow_unused=True)[0]
        if w_z is None:
            w_z = torch.zeros_like(z)

        T_t = torch.autograd.grad(T.sum(), t, create_graph=True, allow_unused=True)[0]
        if T_t is None:
            T_t = torch.zeros_like(t)
        T_x = torch.autograd.grad(T.sum(), x, create_graph=True, allow_unused=True)[0]
        if T_x is None:
            T_x = torch.zeros_like(x)
        T_y = torch.autograd.grad(T.sum(), y, create_graph=True, allow_unused=True)[0]
        if T_y is None:
            T_y = torch.zeros_like(y)
        T_z = torch.autograd.grad(T.sum(), z, create_graph=True, allow_unused=True)[0]
        if T_z is None:
            T_z = torch.zeros_like(z)

        # Second derivatives for viscous terms
        u_xx = torch.autograd.grad(u_x.sum(), x, create_graph=True, allow_unused=True)[0]
        if u_xx is None:
            u_xx = torch.zeros_like(x)
        u_yy = torch.autograd.grad(u_y.sum(), y, create_graph=True, allow_unused=True)[0]
        if u_yy is None:
            u_yy = torch.zeros_like(y)
        u_zz = torch.autograd.grad(u_z.sum(), z, create_graph=True, allow_unused=True)[0]
        if u_zz is None:
            u_zz = torch.zeros_like(z)

        v_xx = torch.autograd.grad(v_x.sum(), x, create_graph=True, allow_unused=True)[0]
        if v_xx is None:
            v_xx = torch.zeros_like(x)
        v_yy = torch.autograd.grad(v_y.sum(), y, create_graph=True, allow_unused=True)[0]
        if v_yy is None:
            v_yy = torch.zeros_like(y)
        v_zz = torch.autograd.grad(v_z.sum(), z, create_graph=True, allow_unused=True)[0]
        if v_zz is None:
            v_zz = torch.zeros_like(z)

        w_xx = torch.autograd.grad(w_x.sum(), x, create_graph=True, allow_unused=True)[0]
        if w_xx is None:
            w_xx = torch.zeros_like(x)
        w_yy = torch.autograd.grad(w_y.sum(), y, create_graph=True, allow_unused=True)[0]
        if w_yy is None:
            w_yy = torch.zeros_like(y)
        w_zz = torch.autograd.grad(w_z.sum(), z, create_graph=True, allow_unused=True)[0]
        if w_zz is None:
            w_zz = torch.zeros_like(z)

        T_xx = torch.autograd.grad(T_x.sum(), x, create_graph=True, allow_unused=True)[0]
        if T_xx is None:
            T_xx = torch.zeros_like(x)
        T_yy = torch.autograd.grad(T_y.sum(), y, create_graph=True, allow_unused=True)[0]
        if T_yy is None:
            T_yy = torch.zeros_like(y)
        T_zz = torch.autograd.grad(T_z.sum(), z, create_graph=True, allow_unused=True)[0]
        if T_zz is None:
            T_zz = torch.zeros_like(z)

        # Pressure via Fluid-Specific EOS
        p = get_eos(self.fluid_type, rho, T)
        p_x = torch.autograd.grad(p.sum(), x, create_graph=True, allow_unused=True)[0]
        if p_x is None:
            p_x = torch.zeros_like(x)
        p_y = torch.autograd.grad(p.sum(), y, create_graph=True, allow_unused=True)[0]
        if p_y is None:
            p_y = torch.zeros_like(y)
        p_z = torch.autograd.grad(p.sum(), z, create_graph=True, allow_unused=True)[0]
        if p_z is None:
            p_z = torch.zeros_like(z)

        # Continuity Equation (Mass Conservation)
        mass_res = rho_t + (rho_x * u + rho * u_x) + (rho_y * v + rho * v_y) + (rho_z * w + rho * w_z)

        # Momentum Equations (Navier-Stokes)
        mu = self.config['mu']
        momentum_x_res = rho * (u_t + u * u_x + v * u_y + w * u_z) + p_x - mu * (u_xx + u_yy + u_zz)
        momentum_y_res = rho * (v_t + u * v_x + v * v_y + w * v_z) + p_y - mu * (v_xx + v_yy + v_zz)
        momentum_z_res = rho * (w_t + u * w_x + v * w_y + w * w_z) + p_z - mu * (w_xx + w_yy + w_zz)

        # Energy Equation (Temperature)
        Cp = self.config['Cp']
        k_therm = self.config['k']
        dissipation = mu * (2 * (u_x ** 2 + v_y ** 2 + w_z ** 2) +
                           (u_y + v_x) ** 2 + (u_z + w_x) ** 2 + (v_z + w_y) ** 2)

        # Chemical Source Term (Temkin-Pyzhev for NH3)
        source_term = 0.0
        if self.config.get('kinetics') == 'temkin_pyzhev':
            Ea = self.config['Ea']
            delta_H = self.config['delta_H']
            R_gas = 8.314
            rate = torch.exp(-Ea / (R_gas * T)) * (p / 1e6) ** 1.5
            source_term = -delta_H * rate * rho

        # Industrial Correction: Pressure work term (-p * div(v) - v * grad(p))
        work_pressure = -(p_x * u + p_y * v + p_z * w) - p * (u_x + v_y + w_z)

        energy_res = (rho * Cp * (T_t + u * T_x + v * T_y + w * T_z) -
                      k_therm * (T_xx + T_yy + T_zz) - dissipation - source_term - work_pressure)

        return mass_res, momentum_x_res, momentum_y_res, momentum_z_res, energy_res

    def loss(self, t_pde, x_pde, y_pde, z_pde, t_bc=None, x_bc=None, y_bc=None, z_bc=None, u_bc_target=None):
        """
        Calcul de la perte combinée : PDE (collocation) + Conditions aux limites (BC).
        """
        # 1. PDE Loss (Points de collocation)
        rho, u, v, w, T = self.forward(t_pde, x_pde, y_pde, z_pde)
        mass, mom_x, mom_y, mom_z, energy = self.compute_residuals(t_pde, x_pde, y_pde, z_pde, rho, u, v, w, T)
        pde_loss = (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()

        # 2. Boundary Condition Loss (No-slip walls by default if provided)
        bc_loss = torch.tensor(0.0, device=t_pde.device)
        if t_bc is not None:
            _, u_bc, v_bc, w_bc, _ = self.forward(t_bc, x_bc, y_bc, z_bc)
            if u_bc_target is not None:
                bc_loss = ((u_bc - u_bc_target)**2).mean() + (v_bc**2).mean() + (w_bc**2).mean()
            else:
                # Default: No-slip (velocity = 0)
                bc_loss = (u_bc**2).mean() + (v_bc**2).mean() + (w_bc**2).mean()

        return pde_loss + 10.0 * bc_loss
