import torch
import torch.nn as nn
import numpy as np
from fluid_properties import FLUID_CONFIGS, get_eos

# Échelles de référence pour l'adimensionnement
# Longueur caractéristique L_ref = 1.0 m (maillage normalisé)
# Vitesse de référence U_ref = 1.0 m/s
# Masse volumique de référence rho_ref = 1.0 kg/m³
# Température de référence T_ref = 293.15 K
# Pression de référence p_ref = rho_ref * U_ref**2 = 1.0 Pa (mais attention, en pratique on utilise p_ref = 1e5 Pa ? Mieux vaut utiliser des échelles pour que les équations soient équilibrées)
# On choisit des échelles pour que chaque terme soit d'ordre 1 dans les équations normalisées.
# Pour Navier-Stokes incompressible, on utilise :
#   x' = x / L, t' = t * U / L, u' = u / U, p' = p / (rho U^2)
# Pour les fluides réels, on ajoute des nombres sans dimension (Re, Pr, Ec,...)

# Domaines physiques (valeurs réelles)
T_MIN, T_MAX = 0.0, 3600.0   # secondes
X_MIN, X_MAX = 0.0, 100000.0 # mètres
Y_MIN, Y_MAX = -0.25, 0.25
Z_MIN, Z_MAX = -0.25, 0.25

# Échelles de normalisation (pour les entrées du réseau)
# On va normaliser les entrées entre 0 et 1
T_NORM = T_MAX - T_MIN
X_NORM = X_MAX - X_MIN
Y_NORM = Y_MAX - Y_MIN
Z_NORM = Z_MAX - Z_MIN

# Échelles de sortie (valeurs réalistes pour H2)
U_SCALE = 20.0        # m/s (vitesse max)
TEMP_SCALE = 400.0    # K (température max)
RHO_SCALE = 100.0     # kg/m³ (densité max)
P_SCALE = 1e7         # Pa (100 bar) pour la pression

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
        # Normalisation des entrées dans [0,1]
        t_norm = (t - T_MIN) / T_NORM
        x_norm = (x - X_MIN) / X_NORM
        y_norm = (y - Y_MIN) / Y_NORM
        z_norm = (z - Z_MIN) / Z_NORM
        inp = torch.cat([t_norm, x_norm, y_norm, z_norm], dim=-1)

        for i, layer in enumerate(self.linears[:-1]):
            inp = torch.tanh(layer(inp))
            if self.enable_dropout and self.dropouts is not None and i < len(self.dropouts):
                inp = self.dropouts[i](inp)
        out = self.linears[-1](inp)

        # Dénormalisation des sorties
        rho = out[..., 0:1] * RHO_SCALE + 0.1   # min 0.1
        u = out[..., 1:2] * U_SCALE
        v = out[..., 2:3] * U_SCALE
        w = out[..., 3:4] * U_SCALE
        T = out[..., 4:5] * TEMP_SCALE + 200.0  # température entre 200 et 600 K
        return rho, u, v, w, T

    def _safe_grad(self, y, x, create_graph=True):
        grads = torch.autograd.grad(y.sum(), x, create_graph=create_graph, allow_unused=True)
        if grads[0] is None:
            return torch.zeros_like(x, requires_grad=create_graph)
        return grads[0]

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T):
        """
        Calcule les résidus adimensionnés.
        On divise chaque résidu par une échelle caractéristique pour que chaque terme soit d'ordre 1.
        """
        # Rendre les tenseurs nécessaires au calcul des gradients
        t = t.clone().detach().requires_grad_(True)
        x = x.clone().detach().requires_grad_(True)
        y = y.clone().detach().requires_grad_(True)
        z = z.clone().detach().requires_grad_(True)
        rho = rho.clone().detach().requires_grad_(True)
        u = u.clone().detach().requires_grad_(True)
        v = v.clone().detach().requires_grad_(True)
        w = w.clone().detach().requires_grad_(True)
        T = T.clone().detach().requires_grad_(True)

        # Échelles pour l'adimensionnement des résidus
        L = X_NORM          # longueur caractéristique (1e5 m) -> attention, trop grand. Mieux vaut utiliser L=1.0 (normalisé).
        U = U_SCALE         # 20 m/s
        rho0 = RHO_SCALE    # 100 kg/m³
        mu0 = self.config['mu']   # viscosité dynamique en Pa.s (ex: 8.9e-6 pour H2)
        # Re = rho0 * U * L / mu0  (nombre de Reynolds caractéristique)
        Re = rho0 * U * L / (mu0 + 1e-8)
        # Les échelles :
        scale_cont = rho0 * U / L           # pour l'équation de continuité
        scale_mom = rho0 * U**2 / L         # pour la quantité de mouvement
        scale_energy = rho0 * self.config['Cp'] * TEMP_SCALE * U / L   # pour l'énergie

        # Premières dérivées
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

        # Secondes dérivées
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

        # Pression via EOS (valeur physique)
        p = get_eos(self.fluid_type, rho, T)
        p_x = self._safe_grad(p, x)
        p_y = self._safe_grad(p, y)
        p_z = self._safe_grad(p, z)

        # Équation de continuité (non normalisée)
        mass_res = rho_t + (rho_x * u + rho * u_x) + (rho_y * v + rho * v_y) + (rho_z * w + rho * w_z)
        # Normalisation
        mass_res_norm = mass_res / scale_cont

        # Quantité de mouvement (non normalisée)
        mu = self.config['mu']
        mom_x_res = rho * (u_t + u * u_x + v * u_y + w * u_z) + p_x - mu * (u_xx + u_yy + u_zz)
        mom_y_res = rho * (v_t + u * v_x + v * v_y + w * v_z) + p_y - mu * (v_xx + v_yy + v_zz)
        mom_z_res = rho * (w_t + u * w_x + v * w_y + w * w_z) + p_z - mu * (w_xx + w_yy + w_zz)
        # Normalisation
        mom_x_norm = mom_x_res / scale_mom
        mom_y_norm = mom_y_res / scale_mom
        mom_z_norm = mom_z_res / scale_mom

        # Énergie (non normalisée)
        Cp = self.config['Cp']
        k_therm = self.config['k']
        dissipation = mu * (2 * (u_x**2 + v_y**2 + w_z**2) +
                           (u_y + v_x)**2 + (u_z + w_x)**2 + (v_z + w_y)**2)
        # Terme source chimique (optionnel)
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
        # Normalisation
        energy_norm = energy_res / scale_energy

        return mass_res_norm, mom_x_norm, mom_y_norm, mom_z_norm, energy_norm

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
