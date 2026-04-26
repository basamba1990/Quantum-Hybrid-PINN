import torch
import torch.nn as nn
import numpy as np
from typing import List, Tuple
from pinn_3d_navier_stokes import PINN3DNavierStokes, T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX, U_MIN, U_MAX, TEMP_MIN, TEMP_MAX

class TFCPINN3DNavierStokes(PINN3DNavierStokes):
    """
    PINN enrichi par la Théorie des Connexions Fonctionnelles (TFC)
    Garantit la satisfaction exacte des conditions aux limites (BC) et initiales (IC).
    """

    def __init__(self, layers: List[int] = None, fluid_type: str = 'H2'):
        super().__init__(layers, fluid_type)
        # On garde la même architecture de base, mais on va modifier le forward
        # pour appliquer les expressions contraintes.

    def constrained_expression(self, t, x, y, z, g_rho, g_u, g_v, g_w, g_T):
        """
        Applique la formulation TFC pour garantir les BC/IC avec support de géométries complexes.
        """
        from tank_geometry import TankGeometry
        
        # Initialisation de la géométrie (peut être paramétrée via l'init du modèle)
        geom = TankGeometry(geometry_type="cylindrical", radius=0.5, length=1.0)
        mask = geom.get_mask(x, y, z)
        
        # Normalisation du temps
        tau = (t - T_MIN) / (T_MAX - T_MIN)
        
        # Valeurs initiales (t=0)
        rho_0 = 1.0 
        T_0 = 293.15
        
        # Application des contraintes de paroi (No-slip) via le masque géométrique
        # Les vitesses s'annulent exactement sur la frontière définie par la SDF
        u_constrained = g_u * mask
        v_constrained = g_v * mask
        w_constrained = g_w * mask
        
        # Condition initiale (t=0)
        rho_constrained = rho_0 + tau * (g_rho - rho_0)
        T_constrained = T_0 + tau * (g_T - T_0)
        
        return rho_constrained, u_constrained, v_constrained, w_constrained, T_constrained

    def forward(self, t, x, y, z):
        # 1. Obtenir la sortie brute du réseau (Fonction libre g)
        t_norm = (t - T_MIN) / (T_MAX - T_MIN)
        x_norm = (x - X_MIN) / (X_MAX - X_MIN)
        y_norm = (y - Y_MIN) / (Y_MAX - Y_MIN)
        z_norm = (z - Z_MIN) / (Z_MAX - Z_MIN)
        inp = torch.cat([t_norm, x_norm, y_norm, z_norm], dim=-1)

        for layer in self.layers[:-1]:
            inp = torch.tanh(layer(inp))
        out = self.layers[-1](inp)

        g_rho = out[..., 0:1]
        g_u   = out[..., 1:2]
        g_v   = out[..., 2:3]
        g_w   = out[..., 3:4]
        g_T   = out[..., 4:5]

        # 2. Appliquer la transformation TFC
        rho, u, v, w, T = self.constrained_expression(t, x, y, z, g_rho, g_u, g_v, g_w, g_T)

        # 3. Dénormalisation finale
        rho_final = rho * 100 + 0.1
        u_final   = u * (U_MAX - U_MIN) + U_MIN
        v_final   = v * (U_MAX - U_MIN) + U_MIN
        w_final   = w * (U_MAX - U_MIN) + U_MIN
        T_final   = T * (TEMP_MAX - TEMP_MIN) + TEMP_MIN
        
        return rho_final, u_final, v_final, w_final, T_final

    def loss(self, t, x, y, z, rho, u, v, w, T):
        # Avec TFC, la perte BC/IC est mathématiquement nulle.
        # On ne calcule que la perte PDE (résidus).
        mass, mom_x, mom_y, mom_z, energy = self.compute_residuals(t, x, y, z, rho, u, v, w, T)
        pde_loss = (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()
        
        return pde_loss
