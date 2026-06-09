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
        # Ensure absolute path or correct relative path
        self.dataset_path = dataset_path or os.path.join(os.getcwd(), "XAI_turbulentchannel_3d_simplified/physique")
        self.reference_data = None

    def load_reference(self, filename="reference_dns.h5"):
        """Charge les données DNS de référence réelles"""
        full_path = os.path.join(self.dataset_path, filename)
        if not os.path.exists(full_path):
            # En environnement industriel, on lève une exception si les données de référence sont manquantes
            raise FileNotFoundError(f"Données de référence CFD critiques manquantes à : {full_path}. "
                                    "Vérifiez le déploiement du dataset DVC.")
        
        with h5py.File(full_path, 'r') as f:
            # Structure des datasets DNS KTH/Vinuesa
            u_dns = np.array(f['u_mean'][:])
            p_dns = np.array(f['p_mean'][:])
            return {"u": u_dns, "p": p_dns}

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
