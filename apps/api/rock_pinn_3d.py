import torch
import torch.nn as nn
try:
    from pinn_3d_navier_stokes import PINN3DNavierStokes
    from rock_properties import ROCK_CONFIGS
except ImportError:
    from .pinn_3d_navier_stokes import PINN3DNavierStokes
    from .rock_properties import ROCK_CONFIGS

class RockPINN3D(PINN3DNavierStokes):
    """PINN 3D pour roche avec endommagement et couplage poroélastique de Biot"""

    def __init__(self, layers=None, rock_type='generic_rock'):
        super().__init__(layers, fluid_type='H2')  # fluide factice, on override
        self.rock_config = ROCK_CONFIGS[rock_type]
        self.E0 = self.rock_config['young_modulus']
        self.nu = self.rock_config['poisson_ratio']
        self.rho_rock = self.rock_config['density']
        self.damage_threshold = self.rock_config['damage_threshold']
        self.damage_rate = self.rock_config['damage_rate']
        self.nonlinear_alpha = self.rock_config['nonlinear_alpha']
        self.alpha_biot = 0.7  # Coefficient de Biot (typique pour les roches)

    def compute_stress_strain(self, u, v, w, x, y, z):
        """Calcule le tenseur des déformations et contraintes avec endommagement"""
        # Gradient des déplacements (dérivées spatiales)
        u_x = torch.autograd.grad(u.sum(), x, create_graph=True)[0]
        u_y = torch.autograd.grad(u.sum(), y, create_graph=True)[0]
        u_z = torch.autograd.grad(u.sum(), z, create_graph=True)[0]
        v_x = torch.autograd.grad(v.sum(), x, create_graph=True)[0]
        v_y = torch.autograd.grad(v.sum(), y, create_graph=True)[0]
        v_z = torch.autograd.grad(v.sum(), z, create_graph=True)[0]
        w_x = torch.autograd.grad(w.sum(), x, create_graph=True)[0]
        w_y = torch.autograd.grad(w.sum(), y, create_graph=True)[0]
        w_z = torch.autograd.grad(w.sum(), z, create_graph=True)[0]

        # Tenseur des déformations (petites déformations)
        eps_xx = u_x
        eps_yy = v_y
        eps_zz = w_z
        eps_xy = 0.5 * (u_y + v_x)
        eps_xz = 0.5 * (u_z + w_x)
        eps_yz = 0.5 * (v_z + w_y)

        # Déformation équivalente de von Mises (ou énergétique)
        eps_eq = torch.sqrt(eps_xx**2 + eps_yy**2 + eps_zz**2 +
                            2*(eps_xy**2 + eps_xz**2 + eps_yz**2) + 1e-8)

        # Module d'Young non linéaire (pression dépendante)
        pressure_rock = -(eps_xx + eps_yy + eps_zz) * self.E0 / (3*(1-2*self.nu))  # estimation
        E = self.E0 * (1 + self.nonlinear_alpha * torch.abs(pressure_rock))

        # Coefficient de Lamé
        mu = E / (2*(1+self.nu))
        lam = E * self.nu / ((1+self.nu)*(1-2*self.nu))

        # Contraintes élastiques (avant endommagement)
        sigma_xx_el = lam * (eps_xx+eps_yy+eps_zz) + 2*mu*eps_xx
        sigma_yy_el = lam * (eps_xx+eps_yy+eps_zz) + 2*mu*eps_yy
        sigma_zz_el = lam * (eps_xx+eps_yy+eps_zz) + 2*mu*eps_zz
        sigma_xy_el = 2*mu*eps_xy
        sigma_xz_el = 2*mu*eps_xz
        sigma_yz_el = 2*mu*eps_yz

        # Variable d'endommagement D (isotrope)
        D = torch.zeros_like(eps_eq)
        mask = eps_eq > self.damage_threshold
        if mask.any():
            D[mask] = 1 - (self.damage_threshold / eps_eq[mask]) * torch.exp(
                -self.damage_rate * (eps_eq[mask] - self.damage_threshold)
            )
            D = torch.clamp(D, 0.0, 1.0)

        # Contraintes effectives (avec endommagement)
        sigma_xx = (1 - D) * sigma_xx_el
        sigma_yy = (1 - D) * sigma_yy_el
        sigma_zz = (1 - D) * sigma_zz_el
        sigma_xy = (1 - D) * sigma_xy_el
        sigma_xz = (1 - D) * sigma_xz_el
        sigma_yz = (1 - D) * sigma_yz_el

        return sigma_xx, sigma_yy, sigma_zz, sigma_xy, sigma_xz, sigma_yz, D

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T, p_fluid=None):
        # Continuity equation for solids (mass conservation)
        rho_t = torch.autograd.grad(rho.sum(), t, create_graph=True)[0]
        rho_x = torch.autograd.grad(rho.sum(), x, create_graph=True)[0]
        rho_y = torch.autograd.grad(rho.sum(), y, create_graph=True)[0]
        rho_z = torch.autograd.grad(rho.sum(), z, create_graph=True)[0]
        
        u_x = torch.autograd.grad(u.sum(), x, create_graph=True)[0]
        v_y = torch.autograd.grad(v.sum(), y, create_graph=True)[0]
        w_z = torch.autograd.grad(w.sum(), z, create_graph=True)[0]
        
        mass_res = rho_t + (rho_x * u + rho * u_x) + \
                   (rho_y * v + rho * v_y) + \
                   (rho_z * w + rho * w_z)

        # Calcul des contraintes
        sig_xx, sig_yy, sig_zz, sig_xy, sig_xz, sig_yz, D = self.compute_stress_strain(u, v, w, x, y, z)

        # Divergence du tenseur des contraintes
        sig_xx_x = torch.autograd.grad(sig_xx.sum(), x, create_graph=True)[0]
        sig_xy_y = torch.autograd.grad(sig_xy.sum(), y, create_graph=True)[0]
        sig_xz_z = torch.autograd.grad(sig_xz.sum(), z, create_graph=True)[0]
        div_sigma_x = sig_xx_x + sig_xy_y + sig_xz_z

        sig_xy_x = torch.autograd.grad(sig_xy.sum(), x, create_graph=True)[0]
        sig_yy_y = torch.autograd.grad(sig_yy.sum(), y, create_graph=True)[0]
        sig_yz_z = torch.autograd.grad(sig_yz.sum(), z, create_graph=True)[0]
        div_sigma_y = sig_xy_x + sig_yy_y + sig_yz_z

        sig_xz_x = torch.autograd.grad(sig_xz.sum(), x, create_graph=True)[0]
        sig_yz_y = torch.autograd.grad(sig_yz.sum(), y, create_graph=True)[0]
        sig_zz_z = torch.autograd.grad(sig_zz.sum(), z, create_graph=True)[0]
        div_sigma_z = sig_xz_x + sig_yz_y + sig_zz_z

        # Industrial Correction 1: Accélération (dérivée seconde)
        u_t = torch.autograd.grad(u.sum(), t, create_graph=True)[0]
        u_tt = torch.autograd.grad(u_t.sum(), t, create_graph=True)[0]
        v_t = torch.autograd.grad(v.sum(), t, create_graph=True)[0]
        v_tt = torch.autograd.grad(v_t.sum(), t, create_graph=True)[0]
        w_t = torch.autograd.grad(w.sum(), t, create_graph=True)[0]
        w_tt = torch.autograd.grad(w_t.sum(), t, create_graph=True)[0]
        
        # Industrial Correction 2: Couplage de Biot (Pression de pore)
        # Si p_fluid n'est pas fourni, on utilise une pression nulle (découplé)
        if p_fluid is not None:
            p_x = torch.autograd.grad(p_fluid.sum(), x, create_graph=True)[0]
            p_y = torch.autograd.grad(p_fluid.sum(), y, create_graph=True)[0]
            p_z = torch.autograd.grad(p_fluid.sum(), z, create_graph=True)[0]
        else:
            p_x = p_y = p_z = torch.zeros_like(x)

        momentum_x_res = self.rho_rock * u_tt - div_sigma_x + self.alpha_biot * p_x
        momentum_y_res = self.rho_rock * v_tt - div_sigma_y + self.alpha_biot * p_y
        momentum_z_res = self.rho_rock * w_tt - div_sigma_z + self.alpha_biot * p_z

        # Energy equation (simplified for rock)
        T_t = torch.autograd.grad(T.sum(), t, create_graph=True)[0]
        energy_res = T_t # Placeholder for simplified rock thermal evolution

        return mass_res, momentum_x_res, momentum_y_res, momentum_z_res, energy_res
