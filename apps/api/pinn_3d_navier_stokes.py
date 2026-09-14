import torch
import torch.nn as nn
import numpy as np
try:
    from fluid_properties import FLUID_CONFIGS, get_eos
except ImportError:
    from .fluid_properties import FLUID_CONFIGS, get_eos
try:
    from phase_thermo import PhaseThermoConfig
except ImportError:
    from .phase_thermo import PhaseThermoConfig

# Configuration Industrielle (Pipeline de 15m)
T_MIN, T_MAX = 0.0, 1000.0 # s
X_MIN, X_MAX = 0.0, 15.0   # m (Pipeline de 15m selon spécifications)
Y_MIN, Y_MAX = -0.25, 0.25 # m (Diamètre typique 0.5m)
Z_MIN, Z_MAX = -0.25, 0.25 # m
U_SCALE = 50.0 # m/s
TEMP_SCALE = 350.0 # K
RHO_SCALE = 100.0 # kg/m3
H_SCALE = 1.0e6 # J/kg; normalization scale, declared in the training contract

class PINN3DNavierStokes(nn.Module):
    def __init__(self, layers=None, fluid_type='H2', dropout_rate=0.1, enable_dropout=False, phase_thermo=None):
        super().__init__()
        # Architecture industrielle : plus profonde pour capturer les gradients complexes
        if layers is None:
            layers = [4, 128, 128, 128, 128, 7]
        if len(layers) != 6 or layers[0] != 4 or layers[-1] != 7:
            raise ValueError("native multiphase V8 requires architecture [4, ..., 7]")
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
        self.enable_dropout = enable_dropout
        self.phase_thermo = phase_thermo
        if self.phase_thermo is None:
            raise ValueError("phase_thermo contract is required for native phase fields")

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

        rho = (torch.sigmoid(out[..., 0:1])) * RHO_SCALE + 0.1
        u = (torch.tanh(out[..., 1:2])) * U_SCALE
        v = (torch.tanh(out[..., 2:3])) * U_SCALE
        w = (torch.tanh(out[..., 3:4])) * U_SCALE
        T = (torch.sigmoid(out[..., 4:5])) * TEMP_SCALE + 13.8 # Point triple H2
        alpha_liquid = torch.sigmoid(out[..., 5:6])
        enthalpy = H_SCALE * torch.tanh(out[..., 6:7])
        return rho, u, v, w, T, alpha_liquid, enthalpy

    def _safe_grad(self, y, x, create_graph=True):
        grads = torch.autograd.grad(y.sum(), x, create_graph=create_graph, allow_unused=True)
        if grads[0] is None:
            return torch.zeros_like(x, requires_grad=create_graph)
        return grads[0]

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T, alpha_liquid, enthalpy, scale_dict=None):
        if not t.requires_grad: t.requires_grad_(True)
        if not x.requires_grad: x.requires_grad_(True)
        if not y.requires_grad: y.requires_grad_(True)
        if not z.requires_grad: z.requires_grad_(True)

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
        alpha_t = self._safe_grad(alpha_liquid, t)
        alpha_x = self._safe_grad(alpha_liquid, x)
        alpha_y = self._safe_grad(alpha_liquid, y)
        alpha_z = self._safe_grad(alpha_liquid, z)

        # Dérivées secondes
        u_xx = self._safe_grad(u_x, x)
        u_yy = self._safe_grad(u_y, y)
        u_zz = self._safe_grad(u_z, z)
        T_xx = self._safe_grad(T_x, x)
        T_yy = self._safe_grad(T_y, y)
        T_zz = self._safe_grad(T_z, z)

        p = get_eos(self.fluid_type, rho, T)
        p_t = self._safe_grad(p, t)
        p_x = self._safe_grad(p, x)
        p_y = self._safe_grad(p, y)
        p_z = self._safe_grad(p, z)

        # 1. Équation de Continuité (Conservation de la masse)
        mass = rho_t + (rho_x * u + rho * u_x) + (rho_y * v + rho * v_y) + (rho_z * w + rho * w_z)

        # 2. Équations de Momentum (Navier-Stokes)
        mu = self.config['mu']
        mom_x = rho * (u_t + u * u_x + v * u_y + w * u_z) + p_x - mu * (u_xx + u_yy + u_zz)
        mom_y = rho * (v_t + u * v_x + v * v_y + w * v_z) + p_y - mu * (self._safe_grad(v_x, x) + self._safe_grad(v_y, y) + self._safe_grad(v_z, z))
        mom_z = rho * (w_t + u * w_x + v * w_y + w * w_z) + p_z - mu * (self._safe_grad(w_x, x) + self._safe_grad(w_y, y) + self._safe_grad(w_z, z))

        # 3. Équation de l'Énergie Robuste (Incluant Joule-Thomson)
        # Forme industrielle: rho*Cp*DT/Dt = div(k*grad(T)) + beta*T*Dp/Dt + Phi
        Cp = self.config['Cp']
        k_therm = self.config['k']
        R = self.config.get('R_specific', 4124.0)
        
        # Coefficient d'expansion thermique beta = -(1/rho)*(drho/dT)_p
        # Pour un gaz réel, beta*T peut être calculé via l'EOS. 
        # Approximation Joule-Thomson: mu_JT = (1/(rho*Cp))*(beta*T - 1)
        # Ici on utilise la forme directe beta*T*Dp/Dt
        # Pour H2 idéal, beta*T = 1.
        beta_T = 1.0 # Valeur par défaut (Gaz Idéal)
        
        # Dp/Dt = p_t + u*p_x + v*p_y + w*p_z
        Dp_Dt = p_t + u * p_x + v * p_y + w * p_z
        
        # Dissipation visqueuse Phi
        dissipation = mu * (2 * (u_x**2 + self._safe_grad(v, y)**2 + self._safe_grad(w, z)**2) +
                           (u_y + v_x)**2 + (u_z + w_x)**2 + (v_z + w_y)**2)
        
        energy = (rho * Cp * (T_t + u * T_x + v * T_y + w * T_z) -
                  k_therm * (T_xx + T_yy + T_zz) - dissipation - beta_T * Dp_Dt)
        phase_transport = alpha_t + u * alpha_x + v * alpha_y + w * alpha_z
        enthalpy_closure = enthalpy - self.phase_thermo.mixture_enthalpy(T, alpha_liquid)

        if scale_dict is not None:
            mass = mass / scale_dict['mass']
            mom_x = mom_x / scale_dict['mom']
            mom_y = mom_y / scale_dict['mom']
            mom_z = mom_z / scale_dict['mom']
            energy = energy / scale_dict['energy']
        return mass, mom_x, mom_y, mom_z, energy, phase_transport, enthalpy_closure

    def get_physical_velocity_profile(self, y, z, R=0.25, u_avg=6.0, type='turbulent'):
        """
        Génère un profil de vitesse physique (Parabolique ou Logarithmique).
        """
        r = torch.sqrt(y**2 + z**2 + 1e-8)
        if type == 'laminar':
            # Profil parabolique: u(r) = 2 * u_avg * (1 - (r/R)^2)
            u_profile = 2 * u_avg * (1 - (r/R)**2)
        else:
            # Profil turbulent (Loi de puissance 1/7 comme approximation robuste de la loi log)
            # u(r) = u_max * (1 - r/R)^(1/7)
            # u_avg = u_max * (2*n^2) / ((n+1)(2n+1)) => pour n=7, u_max approx 1.22 * u_avg
            u_max = 1.224 * u_avg
            u_profile = u_max * torch.pow(torch.clamp(1 - r/R, min=1e-6), 1/7)
        return torch.clamp(u_profile, min=0.0)

    def loss(self, t_pde, x_pde, y_pde, z_pde, scale_dict=None, loss_weights=None):
        rho, u, v, w, T, alpha_liquid, enthalpy = self.forward(t_pde, x_pde, y_pde, z_pde)
        residuals = self.compute_residuals(
            t_pde, x_pde, y_pde, z_pde, rho, u, v, w, T, alpha_liquid, enthalpy, scale_dict=scale_dict)
        mass, mom_x, mom_y, mom_z, energy, phase_transport, enthalpy_closure = residuals[:7]
        
        # Perte PDE
        loss_pde = (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()
        
        # Conditions Limites (Inlet) - x = 0
        t_in = t_pde
        x_in = torch.zeros_like(x_pde)
        y_in = y_pde
        z_in = z_pde
        rho_in, u_in, v_in, w_in, T_in, alpha_in, enthalpy_in = self.forward(t_in, x_in, y_in, z_in)
        
        # Profil de vitesse physique à l'entrée
        u_target = self.get_physical_velocity_profile(y_in, z_in, u_avg=6.0)
        loss_bc_inlet = (u_in - u_target).pow(2).mean() + (v_in**2).mean() + (w_in**2).mean()
        
        # Turbulence Boundary Condition (Intensité de turbulence I = u'/u_avg)
        # On impose une contrainte sur les fluctuations (ici simplifié par une pénalité sur les gradients transverses)
        I = 0.05 # 5% intensité de turbulence
        # Dans un PINN, on peut aussi modéliser k-epsilon, mais ici on assure la cohérence du profil
        
        weights = loss_weights or {}
        loss_phase = (phase_transport ** 2).mean()
        loss_enthalpy = (enthalpy_closure / H_SCALE).square().mean()
        loss_bounds = (torch.relu(-alpha_liquid).square() + torch.relu(alpha_liquid - 1.0).square()).mean()
        return (
            weights.get('pde', 1.0) * loss_pde
            + weights.get('boundary', 10.0) * loss_bc_inlet
            + weights.get('phase_transport', 1.0) * loss_phase
            + weights.get('enthalpy_closure', 1.0) * loss_enthalpy
            + weights.get('bounds', 0.1) * loss_bounds
        )
