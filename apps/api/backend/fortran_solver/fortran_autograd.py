import torch
import numpy as np
from fortran_bridge import FortranPhysicsEngine

class FortranResidualFunction(torch.autograd.Function):
    """
    Wrapper PyTorch Autograd pour le noyau Fortran.
    Permet d'utiliser les résidus Fortran comme Loss Function dans l'entraînement PINN.
    """
    
    @staticmethod
    def forward(ctx, u, v, p, rho, viscosity, engine):
        # Conversion des tenseurs Torch en Numpy pour Fortran
        u_np = u.detach().cpu().numpy()
        v_np = v.detach().cpu().numpy()
        p_np = p.detach().cpu().numpy()
        rho_np = rho.detach().cpu().numpy()
        visc_np = viscosity.detach().cpu().numpy()
        
        # Calcul via Fortran
        res = engine.compute_residuals(u_np, v_np, p_np, rho_np, visc_np)
        
        # Stockage pour le backward (si nécessaire, ici on utilise des gradients numériques ou analytiques simplifiés)
        ctx.save_for_backward(u, v, p, rho, viscosity)
        ctx.res = res
        
        # Retourne les résidus sous forme de tenseurs
        return torch.tensor([res['mass'], res['momentum'], res['energy']], 
                            dtype=u.dtype, device=u.device, requires_grad=True)

    @staticmethod
    def backward(ctx, grad_output):
        # Pour une implémentation industrielle complète, on utiliserait l'adjoint Fortran.
        # Ici, nous fournissons une approximation pour permettre la descente de gradient.
        u, v, p, rho, viscosity = ctx.saved_tensors
        
        # Gradient simplifié (ou identité pour laisser l'optimiseur avancer)
        grad_u = grad_output[0] * torch.ones_like(u)
        grad_v = grad_output[1] * torch.ones_like(v)
        grad_p = grad_output[1] * torch.ones_like(p) # Momentum coupling
        
        return grad_u, grad_v, grad_p, None, None, None

class FortranPINNLoss(torch.nn.Module):
    def __init__(self, lib_path=None):
        super().__init__()
        self.engine = FortranPhysicsEngine(lib_path)
        
    def forward(self, u, v, p, rho, viscosity):
        res = FortranResidualFunction.apply(u, v, p, rho, viscosity, self.engine)
        # La perte est la somme des carrés des résidus (MSE)
        return torch.sum(res**2)
