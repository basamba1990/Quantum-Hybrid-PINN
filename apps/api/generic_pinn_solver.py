import torch
import torch.nn as nn
from typing import List, Dict, Any, Tuple

# Importations locales
try:
    from fluid_properties import FLUID_CONFIGS, get_eos
    from geometry_handler import GeometryHandler
except ImportError:
    from .fluid_properties import FLUID_CONFIGS, get_eos
    from .geometry_handler import GeometryHandler

# Constantes de normalisation (à ajuster dynamiquement ou via config)
T_MIN, T_MAX = 0.0, 1000.0 # s
X_MIN, X_MAX = -5.0, 5.0 # m
Y_MIN, Y_MAX = -5.0, 5.0 # m
Z_MIN, Z_MAX = -5.0, 5.0 # m

class PINNModel(nn.Module):
    """
    Réseau de neurones pour approximer les solutions des équations de Navier-Stokes.
    """
    def __init__(self, layers: List[int]):
        super(PINNModel, self).__init__()
        self.layers = layers
        self.activation = nn.Tanh()
        self.linear_layers = nn.ModuleList()
        for i in range(len(layers) - 1):
            self.linear_layers.append(nn.Linear(layers[i], layers[i+1]))
        
        # Initialisation des poids avec Xavier Glorot pour Tanh
        for m in self.linear_layers:
            if isinstance(m, nn.Linear):
                nn.init.xavier_normal_(m.weight, gain=nn.init.calculate_gain("tanh"))
                nn.init.zeros_(m.bias)

    def forward(self, t, x, y, z):
        # Ensure all inputs have 2 dimensions for concatenation at dim=1
        if t.dim() == 1: t = t.unsqueeze(1)
        if x.dim() == 1: x = x.unsqueeze(1)
        if y.dim() == 1: y = y.unsqueeze(1)
        if z.dim() == 1: z = z.unsqueeze(1)
        
        inputs = torch.cat([t, x, y, z], dim=1)
        for i in range(len(self.linear_layers) - 1):
            inputs = self.activation(self.linear_layers[i](inputs))
        outputs = self.linear_layers[-1](inputs)
        
        # Les sorties sont (rho, u, v, w, T)
        rho, u, v, w, T = outputs[:, 0:1], outputs[:, 1:2], outputs[:, 2:3], outputs[:, 3:4], outputs[:, 4:5]
        return rho, u, v, w, T

class GenericPINNSolver(nn.Module):
    """
    Solveur PINN générique pour les équations de Navier-Stokes 3D compressibles.
    Prend en charge différentes géométries et conditions aux limites.
    """
    def __init__(self, layers: List[int], fluid_type: str = 'H2', geometry_handler: GeometryHandler = None, salt_cavern_physics: Any = None):
        super().__init__()
        self.pinn_model = PINNModel(layers)
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
        self.geometry_handler = geometry_handler # Gestionnaire de géométrie pour les masques et BCs
        self.salt_cavern_physics = salt_cavern_physics # Modèle de physique pour les cavités salines
        self.device = next(self.pinn_model.parameters()).device

        # Paramètres d'échelle pour la sortie (à rendre plus générique)
        self.register_buffer('rho_scale', torch.tensor(71.0)) # Ex: Densité LH2
        self.register_buffer('vel_scale', torch.tensor(50.0)) # Ex: Vitesse max pipeline
        self.register_buffer('temp_scale', torch.tensor(300.0)) # Ex: Température ambiante
        self.register_buffer('temp_offset', torch.tensor(14.0)) # Ex: Point triple H2

    def forward(self, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> Tuple[torch.Tensor, ...]:
        # Passage à travers le réseau de neurones
        rho, u, v, w, T = self.pinn_model(t, x, y, z)

        # Application des conditions aux limites via le GeometryHandler
        if self.geometry_handler:
            rho, u, v, w, T = self.geometry_handler.apply_boundary_conditions(t, x, y, z, rho, u, v, w, T)

        return rho, u, v, w, T

    def _safe_grad(self, y: torch.Tensor, x: torch.Tensor, create_graph: bool = True) -> torch.Tensor:
        grads = torch.autograd.grad(y.sum(), x, create_graph=create_graph, allow_unused=True)
        if grads[0] is None:
            return torch.zeros_like(x, requires_grad=create_graph)
        return grads[0]

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T, scale_dict=None):
        # Assurer que les tenseurs nécessitent des gradients pour le calcul des dérivées
        if not t.requires_grad: t.requires_grad_(True)
        if not x.requires_grad: x.requires_grad_(True)
        if not y.requires_grad: y.requires_grad_(True)
        if not z.requires_grad: z.requires_grad_(True)

        # Cloner et s'assurer que les variables d'état nécessitent des gradients
        rho = rho.clone().requires_grad_(True)
        u = u.clone().requires_grad_(True)
        v = v.clone().requires_grad_(True)
        w = w.clone().requires_grad_(True)
        T = T.clone().requires_grad_(True)

        # Calcul des dérivées premières
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

        # Calcul des dérivées secondes
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

        # Équation d'état pour la pression
        p = get_eos(self.fluid_type, rho, T)
        p_x = self._safe_grad(p, x)
        p_y = self._safe_grad(p, y)
        p_z = self._safe_grad(p, z)

        # Constantes du fluide
        mu = self.config['mu']
        Cp = self.config['Cp']
        k_therm = self.config['k']

        # Équations de Navier-Stokes complètes (compressibles)
        # 1. Conservation de la masse (Continuité)
        mass_residual = rho_t + (rho_x * u + rho * u_x) + (rho_y * v + rho * v_y) + (rho_z * w + rho * w_z)

        # 2. Conservation de la quantité de mouvement (Momentum)
        # Termes convectifs
        convective_u = rho * (u_t + u * u_x + v * u_y + w * u_z)
        convective_v = rho * (v_t + u * v_x + v * v_y + w * v_z)
        convective_w = rho * (w_t + u * w_x + v * w_y + w * w_z)

        # Termes visqueux (pour fluide compressible)
        # Divergence de la vitesse
        div_vel = u_x + v_y + w_z
        
        # Termes visqueux complets pour un fluide Newtonien
        tau_xx = mu * (2 * u_x - (2/3) * div_vel)
        tau_yy = mu * (2 * v_y - (2/3) * div_vel)
        tau_zz = mu * (2 * w_z - (2/3) * div_vel)
        tau_xy = mu * (u_y + v_x)
        tau_xz = mu * (u_z + w_x)
        tau_yz = mu * (v_z + w_y)

        # Dérivées des termes visqueux
        tau_xx_x = self._safe_grad(tau_xx, x, create_graph=True)
        tau_xy_y = self._safe_grad(tau_xy, y, create_graph=True)
        tau_xz_z = self._safe_grad(tau_xz, z, create_graph=True)

        tau_yx_x = self._safe_grad(tau_xy, x, create_graph=True) # tau_yx = tau_xy
        tau_yy_y = self._safe_grad(tau_yy, y, create_graph=True)
        tau_yz_z = self._safe_grad(tau_yz, z, create_graph=True)

        tau_zx_x = self._safe_grad(tau_xz, x, create_graph=True) # tau_zx = tau_xz
        tau_zy_y = self._safe_grad(tau_yz, y, create_graph=True) # tau_zy = tau_yz
        tau_zz_z = self._safe_grad(tau_zz, z, create_graph=True)

        mom_x_residual = convective_u + p_x - (tau_xx_x + tau_xy_y + tau_xz_z)
        mom_y_residual = convective_v + p_y - (tau_yx_x + tau_yy_y + tau_yz_z)
        mom_z_residual = convective_w + p_z - (tau_zx_x + tau_zy_y + tau_zz_z)

        # 3. Conservation de l'énergie
        # ∂(ρE)/∂t + ∇ ⋅ (ρEu) = -∇ ⋅ (pu) + ∇ ⋅ (u ⋅ τ) - ∇ ⋅ q
        # E = e + 0.5 * (u^2 + v^2 + w^2) où e est l'énergie interne spécifique
        # Pour un gaz parfait, e = Cv * T
        # H = E + p/rho = e + p/rho + 0.5 * (u^2 + v^2 + w^2) = Cp * T + 0.5 * (u^2 + v^2 + w^2)
        # Utilisons l'enthalpie H = Cp * T pour simplifier

        # Termes convectifs de l'énergie (basés sur l'enthalpie)
        H = Cp * T + 0.5 * (u**2 + v**2 + w**2)
        H_t = self._safe_grad(H, t)
        H_x = self._safe_grad(H, x)
        H_y = self._safe_grad(H, y)
        H_z = self._safe_grad(H, z)

        convective_energy_term = (rho_t * H + rho * H_t + 
                                 self._safe_grad(rho * u * H, x, create_graph=True) + 
                                 self._safe_grad(rho * v * H, y, create_graph=True) + 
                                 self._safe_grad(rho * w * H, z, create_graph=True))

        # Termes de travail de la pression (∇ ⋅ (pu))
        pu = p * u
        pv = p * v
        pw = p * w
        pressure_work_term = (self._safe_grad(pu, x, create_graph=True) + 
                             self._safe_grad(pv, y, create_graph=True) + 
                             self._safe_grad(pw, z, create_graph=True))

        # Termes de travail visqueux (∇ ⋅ (u ⋅ τ))
        u_tau_x = u * tau_xx + v * tau_xy + w * tau_xz
        u_tau_y = u * tau_xy + v * tau_yy + w * tau_yz
        u_tau_z = u * tau_xz + v * tau_yz + w * tau_zz

        viscous_work_term = (self._safe_grad(u_tau_x, x, create_graph=True) + 
                            self._safe_grad(u_tau_y, y, create_graph=True) + 
                            self._safe_grad(u_tau_z, z, create_graph=True))

        # Termes de conduction thermique (∇ ⋅ q = ∇ ⋅ (k∇T))
        q_x = k_therm * T_x
        q_y = k_therm * T_y
        q_z = k_therm * T_z

        conductive_heat_term = (self._safe_grad(q_x, x, create_graph=True) + 
                               self._safe_grad(q_y, y, create_graph=True) + 
                               self._safe_grad(q_z, z, create_graph=True))

        energy_residual = convective_energy_term + pressure_work_term - viscous_work_term + conductive_heat_term

        # Normalisation des résidus si scale_dict est fourni
        if scale_dict is not None:
            mass_residual = mass_residual / scale_dict['mass']
            mom_x_residual = mom_x_residual / scale_dict['mom']
            mom_y_residual = mom_y_residual / scale_dict['mom']
            mom_z_residual = mom_z_residual / scale_dict['mom']
            energy_residual = energy_residual / scale_dict['energy']
            return mass_residual, mom_x_residual, mom_y_residual, mom_z_residual, energy_residual
        else:
            # Calcul des échelles si non fournies (pour l'initialisation)
            if mass_residual.numel() <= 1:
                scales = {'mass': 1.0, 'mom': 1.0, 'energy': 1.0}
            else:
                scales = {
                    'mass': torch.std(mass_residual).item() + 1e-6,
                    'mom': torch.std(mom_x_residual).item() + 1e-6,
                    'energy': torch.std(energy_residual).item() + 1e-6
                }
            return mass_residual, mom_x_residual, mom_y_residual, mom_z_residual, energy_residual, scales

    def get_pressure(self, rho: torch.Tensor, T: torch.Tensor, fluid_type: str) -> torch.Tensor:
        return get_eos(fluid_type, rho, T)

    def loss(self, t_pde, x_pde, y_pde, z_pde, scale_dict):
        rho, u, v, w, T = self.forward(t_pde, x_pde, y_pde, z_pde)
        mass, mom_x, mom_y, mom_z, energy = self.compute_residuals(
            t_pde, x_pde, y_pde, z_pde, rho, u, v, w, T, scale_dict=scale_dict)
        
        # Perte PDE
        loss_pde = (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()

        # Contraintes physiques supplémentaires (positivité, etc.)
        loss_positivity = torch.mean(torch.relu(-rho)) + torch.mean(torch.relu(-T))
        
        # Pénalité pour les vitesses non physiques (ex: Mach > 1)
        p = self.get_pressure(rho, T, self.fluid_type)
        c_speed = torch.sqrt(self.config["gamma"] * p / (rho + 1e-8)) # Vitesse du son
        vel_mag = torch.sqrt(u**2 + v**2 + w**2)
        loss_mach = torch.mean(torch.relu(vel_mag - 2.0 * c_speed)) # Pénaliser les vitesses supersoniques extrêmes

        # Conditions aux limites (à étendre avec geometry_handler)
        loss_bc = self.geometry_handler.compute_boundary_conditions_loss(self, self.fluid_type, self.device)

        # Ajouter la perte de couplage pour les cavités salines si applicable
        loss_coupling = torch.tensor(0.0, device=self.device)
        if self.salt_cavern_physics and self.geometry_handler.geometry_type == "salt_cavern":
            loss_coupling = self.salt_cavern_physics.compute_coupling_loss(self, self.geometry_handler, self.fluid_type, self.device)

        return loss_pde + 10.0 * loss_positivity + 0.1 * loss_mach + loss_bc + loss_coupling


if __name__ == '__main__':
    # Exemple d'utilisation
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # Exemple de géométrie de pipeline
    pipeline_params = {"radius": 0.5, "length": 12.0}
    geometry_handler = GeometryHandler(geometry_type="pipeline", params=pipeline_params)

    # Définition des couches du réseau de neurones
    layers = [4, 128, 128, 128, 5] # 4 entrées (t,x,y,z), 5 sorties (rho, u, v, w, T)

    # Initialisation du solveur PINN générique
    pinn_solver = GenericPINNSolver(layers, fluid_type="H2", geometry_handler=geometry_handler).to(device)

    # Génération de points d'échantillonnage pour le test
    N_test = 100
    t_test, x_test, y_test, z_test = geometry_handler.get_sampling_points(N_test)
    t_test = t_test.to(device).requires_grad_(True)
    x_test = x_test.to(device).requires_grad_(True)
    y_test = y_test.to(device).requires_grad_(True)
    z_test = z_test.to(device).requires_grad_(True)

    # Calcul des prédictions
    rho_pred, u_pred, v_pred, w_pred, T_pred = pinn_solver(t_test, x_test, y_test, z_test)

    # Calcul des résidus
    mass_res, mom_x_res, mom_y_res, mom_z_res, energy_res, _ = pinn_solver.compute_residuals(
        t_test, x_test, y_test, z_test, rho_pred, u_pred, v_pred, w_pred, T_pred
    )

    print(f"Résidu de masse moyen: {mass_res.abs().mean().item():.4e}")
    print(f"Résidu de quantité de mouvement X moyen: {mom_x_res.abs().mean().item():.4e}")
    print(f"Résidu de quantité de mouvement Y moyen: {mom_y_res.abs().mean().item():.4e}")
    print(f"Résidu de quantité de mouvement Z moyen: {mom_z_res.abs().mean().item():.4e}")
    print(f"Résidu d'énergie moyen: {energy_res.abs().mean().item():.4e}")

    # Calcul de la perte totale (PDE + BC)
    total_loss = pinn_solver.loss(t_test, x_test, y_test, z_test, scale_dict={'mass': 1.0, 'mom': 1.0, 'energy': 1.0})
    print(f"Perte totale (PDE + BC): {total_loss.item():.4e}")
