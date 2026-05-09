import numpy as np
import torch
from scipy.fft import fftn, fftshift

class AdvancedPhysicsAnalysis:
    """
    Service d'analyse physique avancée pour l'hydrogène.
    Calcule les spectres de turbulence, les profils de couche limite et les résidus physiques.
    """
    def __init__(self, fluid_engine=None):
        self.fluid_engine = fluid_engine

    def compute_turbulence_spectrum(self, velocity_field, dx, dy, dz):
        """
        Calcule le spectre d'énergie cinétique turbulente (TKE) à partir d'un champ de vitesse 3D.
        velocity_field: (3, Nx, Ny, Nz) - composantes u, v, w
        """
        u, v, w = velocity_field
        Nx, Ny, Nz = u.shape
        
        # Calcul de la transformée de Fourier
        u_hat = fftn(u)
        v_hat = fftn(v)
        w_hat = fftn(w)
        
        # Densité spectrale d'énergie
        E_k = 0.5 * (np.abs(u_hat)**2 + np.abs(v_hat)**2 + np.abs(w_hat)**2) / (Nx * Ny * Nz)**2
        
        # Moyenne sur les coquilles sphériques dans l'espace des nombres d'onde (simplifié)
        kx = np.fft.fftfreq(Nx, d=dx)
        ky = np.fft.fftfreq(Ny, d=dy)
        kz = np.fft.fftfreq(Nz, d=dz)
        
        # Pour simplifier, on retourne une version 1D moyennée
        # Dans un cas réel, on ferait une intégration sur des coquilles de rayon k
        k_mag = np.sqrt(kx[:, None, None]**2 + ky[None, :, None]**2 + kz[None, None, :]**2)
        k_bins = np.linspace(0, np.max(k_mag), 50)
        energy_spectrum, _ = np.histogram(k_mag, bins=k_bins, weights=E_k)
        
        return {
            "wavenumbers": k_bins[:-1].tolist(),
            "energy_density": energy_spectrum.tolist()
        }

    def extract_boundary_layer_profile(self, field_3d, axis=1, pos_x=0, pos_z=0):
        """
        Extrait un profil 1D (e.g., vitesse ou température) normal à une paroi.
        field_3d: (Nx, Ny, Nz)
        axis: l'axe normal à la paroi (par défaut y=1)
        """
        if axis == 1:
            profile = field_3d[pos_x, :, pos_z]
        elif axis == 0:
            profile = field_3d[:, pos_x, pos_z]
        else:
            profile = field_3d[pos_x, pos_z, :]
            
        return profile.tolist()

    def compute_pinn_residuals(self, model, coords, fluid_properties):
        """
        Calcule les résidus des équations de Navier-Stokes pour un modèle PINN.
        coords: (N, 4) - [t, x, y, z]
        """
        coords = torch.tensor(coords, requires_grad=True).float()
        preds = model(coords)
        
        # Extraction des variables
        p = preds[:, 0:1]
        u = preds[:, 1:2]
        v = preds[:, 2:3]
        w = preds[:, 3:4]
        T = preds[:, 4:5]
        
        # Calcul des dérivées (AutoGrad)
        def get_grad(f, x):
            return torch.autograd.grad(f, x, grad_outputs=torch.ones_like(f), create_graph=True)[0]
            
        grad_u = get_grad(u, coords)
        u_t, u_x, u_y, u_z = grad_u[:, 0:1], grad_u[:, 1:2], grad_u[:, 2:3], grad_u[:, 3:4]
        
        grad_v = get_grad(v, coords)
        v_t, v_x, v_y, v_z = grad_v[:, 0:1], grad_v[:, 1:2], grad_v[:, 2:3], grad_v[:, 3:4]
        
        grad_w = get_grad(w, coords)
        w_t, w_x, w_y, w_z = grad_w[:, 0:1], grad_w[:, 1:2], grad_w[:, 2:3], grad_w[:, 3:4]
        
        # Résidu de continuité (div U = 0 pour incompressible, ou d_rho/dt + div(rho U) = 0)
        res_continuity = u_x + v_y + u_z
        
        # Résidus de quantité de mouvement (Navier-Stokes simplifié)
        # rho(u_t + u.grad(u)) = -grad(p) + mu.laplacian(u)
        mu = fluid_properties.get('viscosity', 1e-5)
        rho = fluid_properties.get('density', 1.0)
        
        u_xx = get_grad(u_x, coords)[:, 1:2]
        u_yy = get_grad(u_y, coords)[:, 2:3]
        u_zz = get_grad(u_z, coords)[:, 3:4]
        
        p_x = get_grad(p, coords)[:, 1:2]
        
        res_momentum_u = rho * (u_t + u*u_x + v*u_y + w*u_z) + p_x - mu * (u_xx + u_yy + u_zz)
        
        return {
            "continuity": torch.abs(res_continuity).detach().numpy().tolist(),
            "momentum_u": torch.abs(res_momentum_u).detach().numpy().tolist()
        }
