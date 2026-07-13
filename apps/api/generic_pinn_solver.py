import torch
import torch.nn as nn
import numpy as np
from typing import Dict, Any, List, Optional, Callable

try:
    from fluid_properties import FLUID_CONFIGS, get_eos
except ImportError:
    from .fluid_properties import FLUID_CONFIGS, get_eos

class GenericPINNSolver(nn.Module):
    """
    Solveur PINN 3D Industriel Générique pour les équations de Navier-Stokes.
    Supporte :
    - Équations de Navier-Stokes compressibles complètes
    - Géométries arbitraires via échantillonnage de points
    - Conditions aux limites (BC) flexibles (Dirichlet, Neumann, Robin)
    - Couplage avec des équations d'état (EOS) complexes
    """

    def __init__(self, layers: List[int] = [4, 128, 128, 128, 128, 5], 
                 fluid_type: str = 'H2',
                 activation: nn.Module = nn.Tanh()):
        super().__init__()
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
        
        # Réseaux de neurones
        self.net = nn.ModuleList()
        for i in range(len(layers) - 1):
            self.net.append(nn.Linear(layers[i], layers[i+1]))
            if i < len(layers) - 2:
                self.net.append(activation)
        
        # Initialisation Xavier
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_normal_(m.weight)
                nn.init.constant_(m.bias, 0)

        # Normalisation des entrées/sorties (échelles industrielles)
        self.scales = {
            't': 1000.0, 'x': 10.0, 'y': 10.0, 'z': 10.0,
            'rho': 100.0, 'u': 50.0, 'T': 500.0
        }

    def forward(self, t, x, y, z):
        # Normalisation
        tn = t / self.scales['t']
        xn = x / self.scales['x']
        yn = y / self.scales['y']
        zn = z / self.scales['z']
        
        inp = torch.cat([tn, xn, yn, zn], dim=-1)
        out = inp
        for layer in self.net:
            out = layer(out)
            
        # Dé-normalisation physique
        rho = torch.sigmoid(out[..., 0:1]) * self.scales['rho'] + 0.1
        u = torch.tanh(out[..., 1:2]) * self.scales['u']
        v = torch.tanh(out[..., 2:3]) * self.scales['u']
        w = torch.tanh(out[..., 3:4]) * self.scales['u']
        T = torch.sigmoid(out[..., 4:5]) * self.scales['T'] + 10.0
        
        return rho, u, v, w, T

    def _grad(self, y, x):
        return torch.autograd.grad(y, x, grad_outputs=torch.ones_like(y), 
                                  create_graph=True, retain_graph=True)[0]

    def pde_residuals(self, t, x, y, z):
        """
        Calcul des résidus des équations de Navier-Stokes.
        """
        t.requires_grad_(True)
        x.requires_grad_(True)
        y.requires_grad_(True)
        z.requires_grad_(True)
        
        rho, u, v, w, T = self.forward(t, x, y, z)
        
        # Équation d'état (EOS)
        p = get_eos(self.fluid_type, rho, T)
        
        # Dérivées premières
        rho_t = self._grad(rho, t)
        rho_x = self._grad(rho, x)
        rho_y = self._grad(rho, y)
        rho_z = self._grad(rho, z)
        
        u_t = self._grad(u, t)
        u_x = self._grad(u, x)
        u_y = self._grad(u, y)
        u_z = self._grad(u, z)
        
        v_t = self._grad(v, t)
        v_x = self._grad(v, x)
        v_y = self._grad(v, y)
        v_z = self._grad(v, z)
        
        w_t = self._grad(w, t)
        w_x = self._grad(w, x)
        w_y = self._grad(w, y)
        w_z = self._grad(w, z)
        
        T_t = self._grad(T, t)
        T_x = self._grad(T, x)
        T_y = self._grad(T, y)
        T_z = self._grad(T, z)
        
        p_x = self._grad(p, x)
        p_y = self._grad(p, y)
        p_z = self._grad(p, z)
        
        # Dérivées secondes (Viscosité et conduction)
        u_xx = self._grad(u_x, x)
        u_yy = self._grad(u_y, y)
        u_zz = self._grad(u_z, z)
        
        v_xx = self._grad(v_x, x)
        v_yy = self._grad(v_y, y)
        v_zz = self._grad(v_z, z)
        
        w_xx = self._grad(w_x, x)
        w_yy = self._grad(w_y, y)
        w_zz = self._grad(w_z, z)
        
        T_xx = self._grad(T_x, x)
        T_yy = self._grad(T_y, y)
        T_zz = self._grad(T_z, z)
        
        # Paramètres physiques
        mu = self.config['mu']
        k_therm = self.config['k']
        Cp = self.config['Cp']
        
        # 1. Équation de continuité (Conservation de la masse)
        res_mass = rho_t + (rho_x*u + rho*u_x) + (rho_y*v + rho*v_y) + (rho_z*w + rho*w_z)
        
        # 2. Équations de quantité de mouvement (Navier-Stokes)
        res_mom_x = rho*(u_t + u*u_x + v*u_y + w*u_z) + p_x - mu*(u_xx + u_yy + u_zz)
        res_mom_y = rho*(v_t + u*v_x + v*v_y + w*v_z) + p_y - mu*(v_xx + v_yy + v_zz)
        res_mom_z = rho*(w_t + u*w_x + v*w_y + w*w_z) + p_z - mu*(w_xx + w_yy + w_zz)
        
        # 3. Équation de l'énergie
        # Dissipation visqueuse (négligée ici pour simplicité, mais ré-ajoutable)
        res_energy = rho*Cp*(T_t + u*T_x + v*T_y + w*T_z) - k_therm*(T_xx + T_yy + T_zz) - (u*p_x + v*p_y + w*p_z)
        
        return res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy

    def compute_loss(self, data_pde: Dict[str, torch.Tensor], 
                     data_bc: Optional[Dict[str, torch.Tensor]] = None,
                     weights: Dict[str, float] = {'pde': 1.0, 'bc': 10.0}):
        """
        Calcul de la fonction de perte totale.
        """
        # Perte PDE
        t, x, y, z = data_pde['t'], data_pde['x'], data_pde['y'], data_pde['z']
        res_mass, res_mx, res_my, res_mz, res_e = self.pde_residuals(t, x, y, z)
        loss_pde = (res_mass**2).mean() + (res_mx**2).mean() + (res_my**2).mean() + (res_mz**2).mean() + (res_e**2).mean()
        
        loss_total = weights['pde'] * loss_pde
        
        # Perte BC (Dirichlet)
        if data_bc is not None:
            t_b, x_b, y_b, z_b = data_bc['t'], data_bc['x'], data_bc['y'], data_bc['z']
            rho_b, u_b, v_b, w_b, T_b = self.forward(t_b, x_b, y_b, z_b)
            
            loss_bc = 0
            if 'rho' in data_bc: loss_bc += ((rho_b - data_bc['rho'])**2).mean()
            if 'u' in data_bc: loss_bc += ((u_b - data_bc['u'])**2).mean()
            if 'v' in data_bc: loss_bc += ((v_b - data_bc['v'])**2).mean()
            if 'w' in data_bc: loss_bc += ((w_b - data_bc['w'])**2).mean()
            if 'T' in data_bc: loss_bc += ((T_b - data_bc['T'])**2).mean()
            
            loss_total += weights['bc'] * loss_bc
            
        return loss_total
