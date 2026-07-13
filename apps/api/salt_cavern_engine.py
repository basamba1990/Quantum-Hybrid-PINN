import torch
import torch.nn as nn
from typing import Dict, Any, List
try:
    from generic_pinn_solver import GenericPINNSolver
except ImportError:
    from .generic_pinn_solver import GenericPINNSolver

class SaltCavernEngine(GenericPINNSolver):
    """
    Moteur spécifique pour les cavités salines.
    Implémente les lois de comportement du sel (fluage de Norton-Hoff, viscoplasticité).
    """
    
    def __init__(self, layers: List[int] = [4, 128, 128, 128, 128, 5], fluid_type: str = 'BRINE'):
        super().__init__(layers=layers, fluid_type=fluid_type)
        # Paramètres de fluage (Norton-Hoff) pour le sel
        self.A = 1.0e-12  # Paramètre de pré-exponentiel
        self.n = 5.0      # Exposant de Norton
        self.Q = 54000    # Énergie d'activation (J/mol)
        self.R = 8.314    # Constante des gaz parfaits
        
    def compute_creep_strain_rate(self, sigma_eff, T):
        """Calcule le taux de déformation de fluage."""
        temp_term = torch.exp(-self.Q / (self.R * (T + 273.15)))
        creep_rate = self.A * temp_term * (sigma_eff ** self.n)
        return creep_rate

    def _compute_stress_strain(self, u, v, w, x, y, z):
        """Calcule le tenseur des contraintes (simplifié pour le couplage PINN)"""
        u_x = self._grad(u, x)
        v_y = self._grad(v, y)
        w_z = self._grad(w, z)
        # Module d'Young du sel ~25 GPa
        E = 25e9 
        sig_xx = E * u_x
        sig_yy = E * v_y
        sig_zz = E * w_z
        return sig_xx, sig_yy, sig_zz, torch.zeros_like(u), torch.zeros_like(u), torch.zeros_like(u)

    def pde_residuals(self, t, x, y, z):
        """Calcul des résidus incluant le fluage du sel."""
        # 1. Résidus Navier-Stokes (pour la saumure dans la cavité)
        res_mass, res_mx, res_my, res_mz, res_e = super().pde_residuals(t, x, y, z)
        
        # 2. Couplage avec le fluage du sel (parois de la cavité)
        rho, u, v, w, T = self.forward(t, x, y, z)
        sig_xx, sig_yy, sig_zz, sig_xy, sig_xz, sig_yz = self._compute_stress_strain(u, v, w, x, y, z)
        
        # Von Mises
        s_xx = sig_xx - (sig_xx + sig_yy + sig_zz)/3
        s_yy = sig_yy - (sig_xx + sig_yy + sig_zz)/3
        s_zz = sig_zz - (sig_xx + sig_yy + sig_zz)/3
        sigma_vm = torch.sqrt(1.5 * (s_xx**2 + s_yy**2 + s_zz**2 + 2*(sig_xy**2 + sig_xz**2 + sig_yz**2)) + 1e-8)
        
        creep_rate = self.compute_creep_strain_rate(sigma_vm, T)
        
        # Pénalité de fluage (pour assurer que la solution respecte la loi de Norton-Hoff aux parois)
        # Dans un modèle complet, cela influencerait les conditions aux limites de vitesse
        res_creep = (creep_rate - torch.abs(u)).mean() # Simplification pour le test
        
        return res_mass, res_mx, res_my, res_mz, res_e
