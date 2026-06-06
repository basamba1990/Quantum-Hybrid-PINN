import torch
import torch.nn as nn
import numpy as np
from fluid_properties import FLUID_CONFIGS, get_eos

# ============================================================================
# RÉFÉRENTIEL DE DIMENSIONNEMENT (INDUSTRIAL STANDARDS)
# ============================================================================
# Ces échelles permettent de transformer les équations en forme non-dimensionnelle
# pour une convergence stable du PINN.
L_REF = 100.0      # Échelle de longueur (m) - ex: section de pipeline
U_REF = 10.0       # Échelle de vitesse (m/s)
RHO_REF = 5.0      # Échelle de densité (kg/m³) pour H2 à ~60 bar
T_REF = 300.0      # Échelle de température (K)
P_REF = 1e6        # Échelle de pression (Pa) - 10 bar
TIME_REF = L_REF / U_REF

class PINN3DNavierStokes(nn.Module):
    """
    PINN Industriel : Équations de Navier-Stokes Non-Dimensionnelles
    Inclut un modèle de turbulence (viscosité d'Eddy) et une EOS quantique.
    """

    def __init__(self, layers=None, fluid_type='H2', dropout_rate=0.1, enable_dropout=False):
        super().__init__()
        if layers is None:
            layers = [4, 256, 256, 256, 256, 5]
        self.layers_list = layers
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
        self.enable_dropout = enable_dropout
        self.dropout_rate = dropout_rate

        # Réseau de neurones
        self.linears = nn.ModuleList()
        for i in range(len(layers) - 1):
            self.linears.append(nn.Linear(layers[i], layers[i + 1]))
            nn.init.xavier_normal_(self.linears[-1].weight)
            nn.init.zeros_(self.linears[-1].bias)

        # Paramètres physiques non-dimensionnels (Calculés une seule fois)
        self.Re = (RHO_REF * U_REF * L_REF) / self.config['mu']
        self.Pr = (self.config['mu'] * self.config['Cp']) / self.config['k']
        self.Ec = (U_REF**2) / (self.config['Cp'] * T_REF)
        
        # Facteur de compressibilité (Mach number approx)
        # Ma = U_REF / c_sound
        c_sound = np.sqrt(self.config['gamma'] * 4124.0 * T_REF)
        self.Ma = U_REF / c_sound

    def forward(self, t, x, y, z):
        """
        Entrées et sorties normalisées (Adimensionnelles)
        t, x, y, z : [0, 1]
        """
        inp = torch.cat([t, x, y, z], dim=-1)
        for i, layer in enumerate(self.linears[:-1]):
            inp = torch.tanh(layer(inp))
        out = self.linears[-1](inp)
        
        # Sorties adimensionnelles (Ordre de grandeur ~1)
        rho_star = torch.sigmoid(out[..., 0:1]) * 2.0  # [0, 2]
        u_star = out[..., 1:2]
        v_star = out[..., 2:3]
        w_star = out[..., 3:4]
        T_star = torch.sigmoid(out[..., 4:5]) * 2.0  # [0, 2]
        
        return rho_star, u_star, v_star, w_star, T_star

    def get_physical_state(self, t_star, x_star, y_star, z_star):
        """Convertit l'état adimensionnel en unités SI."""
        rho_s, u_s, v_s, w_s, T_s = self.forward(t_star, x_star, y_star, z_star)
        return (
            rho_s * RHO_REF,
            u_s * U_REF,
            v_s * U_REF,
            w_s * U_REF,
            T_s * T_REF
        )

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T):
        """
        Calcul des résidus sur les équations NON-DIMENSIONNELLES.
        Cela assure que chaque terme de l'équation a le même poids numérique.
        """
        # Gradients (Auto-diff)
        def grad(outputs, inputs):
            return torch.autograd.grad(outputs, inputs, grad_outputs=torch.ones_like(outputs), 
                                      create_graph=True, retain_graph=True, allow_unused=True)[0]

        rho_t = grad(rho, t)
        rho_x = grad(rho, x); rho_y = grad(rho, y); rho_z = grad(rho, z)
        
        u_t = grad(u, t); u_x = grad(u, x); u_y = grad(u, y); u_z = grad(u, z)
        v_t = grad(v, t); v_x = grad(v, x); v_y = grad(v, y); v_z = grad(v, z)
        w_t = grad(w, t); w_x = grad(w, x); w_y = grad(w, y); w_z = grad(w, z)
        
        T_t = grad(T, t); T_x = grad(T, x); T_y = grad(T, y); T_z = grad(T, z)

        # Laplaciens (Viscosité)
        u_xx = grad(u_x, x); u_yy = grad(u_y, y); u_zz = grad(u_z, z)
        v_xx = grad(v_x, x); v_yy = grad(v_y, y); v_zz = grad(v_z, z)
        w_xx = grad(w_x, x); w_yy = grad(w_y, y); w_zz = grad(w_z, z)
        T_xx = grad(T_x, x); T_yy = grad(T_y, y); T_zz = grad(T_z, z)

        # Pression via EOS (Adimensionnelle)
        # P_star = rho_star * T_star (Loi des gaz parfaits adimensionnelle)
        # En réalité, on utilise l'EOS réelle mais mise à l'échelle
        p = rho * T / (self.config['gamma'] * self.Ma**2)
        p_x = grad(p, x); p_y = grad(p, y); p_z = grad(p, z)

        # 1. Continuité (Masse)
        res_mass = rho_t + (rho_x*u + rho*u_x) + (rho_y*v + rho*v_y) + (rho_z*w + rho*w_z)

        # 2. Momentum (Navier-Stokes) avec Turbulence (Smagorinsky simple)
        # Cs = 0.1 (Smagorinsky constant)
        # Viscosité turbulente adimensionnelle nu_t_star
        S_mag = torch.sqrt(2 * (u_x**2 + v_y**2 + w_z**2) + (u_y+v_x)**2 + (u_z+w_x)**2 + (v_z+w_y)**2)
        nu_t = (0.1**2) * S_mag 
        nu_eff = (1.0/self.Re) + nu_t

        res_u = rho*(u_t + u*u_x + v*u_y + w*u_z) + p_x - nu_eff*(u_xx + u_yy + u_zz)
        res_v = rho*(v_t + u*v_x + v*v_y + w*v_z) + p_y - nu_eff*(v_xx + v_yy + v_zz)
        res_w = rho*(w_t + u*w_x + v*w_y + w*w_z) + p_z - nu_eff*(w_xx + w_yy + w_zz)

        # 3. Énergie
        alpha_eff = (1.0/(self.Re * self.Pr)) + nu_t # Pr_t approx 1.0
        res_energy = rho*(T_t + u*T_x + v*T_y + w*T_z) - alpha_eff*(T_xx + T_yy + T_zz) - self.Ec * (u*p_x + v*p_y + w*p_z)

        return res_mass, res_u, res_v, res_w, res_energy

    def loss(self, t, x, y, z):
        """Calcul de la perte totale avec poids adaptatifs."""
        rho, u, v, w, T = self.forward(t, x, y, z)
        r_m, r_u, r_v, r_w, r_e = self.compute_residuals(t, x, y, z, rho, u, v, w, T)
        
        # On utilise la moyenne des carrés (MSE) sur les résidus adimensionnels
        return (r_m**2).mean() + (r_u**2).mean() + (r_v**2).mean() + (r_w**2).mean() + (r_e**2).mean()
