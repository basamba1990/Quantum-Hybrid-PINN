import os
import numpy as np
import h5py
import torch

class CFDValidationService:
    """
    Service de validation comparant les prédictions IA (FNO/PINN) 
    avec les données de référence CFD (KTH/Vinuesa).
    """
    def __init__(self, dataset_path=None):
        self.dataset_path = dataset_path or "XAI_turbulentchannel_3d_simplified/physique"
        self.reference_data = None

    def load_reference(self, filename="reference_dns.h5"):
        """Charge les données DNS de référence"""
        full_path = os.path.join(self.dataset_path, filename)
        if not os.path.exists(full_path):
            # Fallback: générer des données synthétiques si le dataset n'est pas cloné
            print(f"Dataset non trouvé à {full_path}, utilisation de données de référence synthétiques.")
            return self._generate_synthetic_reference()
        
        with h5py.File(full_path, 'r') as f:
            # Structure typique des datasets KTH
            u_dns = np.array(f['u_mean'][:])
            p_dns = np.array(f['p_mean'][:])
            return {"u": u_dns, "p": p_dns}

    def _generate_synthetic_reference(self):
        """Génère un profil de canal turbulent théorique (Loi de paroi)"""
        y = np.linspace(0, 1, 64)
        u_tau = 0.05
        nu = 1e-5
        u_plus = np.log(y * u_tau / nu + 1.0) / 0.41 + 5.0
        return {"u": u_plus, "p": np.zeros_like(y)}

    def compute_metrics(self, prediction, reference):
        """Calcule l'erreur L2 et la stabilité"""
        mse = np.mean((prediction - reference)**2)
        relative_error = np.linalg.norm(prediction - reference) / np.linalg.norm(reference)
        
        return {
            "mse": float(mse),
            "relative_error": float(relative_error),
            "stability_index": 1.0 / (1.0 + mse)
        }

    def validate_pinn_output(self, pinn_results):
        """
        Point d'entrée principal pour valider un résultat de simulation.
        pinn_results: dict contenant 'velocity' et 'pressure'
        """
        ref = self.load_reference()
        u_metrics = self.compute_metrics(pinn_results['velocity'], ref['u'])
        p_metrics = self.compute_metrics(pinn_results['pressure'], ref['p'])
        
        overall_score = (u_metrics['stability_index'] + p_metrics['stability_index']) / 2 * 100
        
        return {
            "overall_score": overall_score,
            "velocity_metrics": u_metrics,
            "pressure_metrics": p_metrics,
            "status": "validated" if overall_score > 85 else "warning"
        }
