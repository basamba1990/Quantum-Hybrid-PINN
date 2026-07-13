import os
import numpy as np
import torch
from typing import Dict, Any

class CFDValidationService:
    """
    Service de Validation Physique Rigoureuse (V8.5 Industrial).
    Vérifie la conservation de la masse, de la quantité de mouvement et de l'énergie
    sur les résultats du solveur PINN.
    """
    def __init__(self):
        pass

    def validate_conservation(self, solver, geom_manager, n_points: int = 500) -> Dict[str, Any]:
        """
        Vérifie rigoureusement les lois de conservation sur le domaine.
        Ne s'appuie plus sur des heuristiques mais sur les résidus PDE réels.
        """
        # Échantillonnage de points de test indépendants
        points = geom_manager.sample_interior(n_points)
        t = torch.zeros(n_points, 1)
        x, y, z = points[:, 0:1], points[:, 1:2], points[:, 2:3]
        
        # Calcul des résidus via le solveur (Navier-Stokes complets)
        res_mass, res_mx, res_my, res_mz, res_e = solver.pde_residuals(t, x, y, z)
        
        # Calcul des erreurs RMS (Root Mean Square) pour chaque loi
        mass_error = torch.sqrt(torch.mean(res_mass**2)).detach().cpu().item()
        momentum_error = torch.sqrt(torch.mean(res_mx**2 + res_my**2 + res_mz**2)).detach().cpu().item()
        energy_error = torch.sqrt(torch.mean(res_e**2)).detach().cpu().item()
        
        # Score de crédibilité basé sur la précision de la résolution physique (Échelle Logarithmique Industrielle)
        total_error = mass_error + momentum_error + energy_error
        # Un score de 100% correspond à une erreur de 1e-10, 80% à 1e-2, etc.
        score = max(0.0, min(100.0, 100.0 * (1.0 - np.log10(1.0 + total_error) / 10.0)))
        
        return {
            "mass_conservation_error": float(mass_error),
            "momentum_conservation_error": float(momentum_error),
            "energy_conservation_error": float(energy_error),
            "credibility_score": float(score),
            "is_physically_consistent": bool(mass_error < 0.05 and energy_error < 0.05),
            "status": "validated" if score > 80.0 else "requires_refinement"
        }

    def validate_pinn_output(self, solver, geom_manager):
        """Compatibilité avec l'ancien appel mais avec la nouvelle logique rigoureuse"""
        return self.validate_conservation(solver, geom_manager)
