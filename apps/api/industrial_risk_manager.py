import torch
import numpy as np
from typing import Dict, List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class IndustrialRiskManager:
    """
    Gestionnaire de risque industriel pour PINN :
    - Détection Out-of-Distribution (OOD)
    - Certification des résidus physiques
    - Score de confiance composite
    """
    def __init__(self, pinn_wrapper, threshold_percentile: float = 99.0):
        self.pinn = pinn_wrapper
        self.ood_detector = None
        self.threshold_percentile = threshold_percentile
        self.is_fitted = False
        
    def fit_ood(self, training_features: np.ndarray):
        """Ajuste le détecteur OOD sur les données d'entraînement"""
        from hydrogen_pinn_v8 import MahalanobisOODDetector
        self.ood_detector = MahalanobisOODDetector(threshold_percentile=self.threshold_percentile)
        self.ood_detector.fit(training_features)
        self.is_fitted = True
        logger.info("Détecteur OOD industriel ajusté.")

    def certify_prediction(self, t: float, x: float, y: float, z: float) -> Dict:
        """
        Certifie une prédiction en calculant les résidus et l'incertitude.
        """
        # 1. Calcul de l'incertitude via MC Dropout
        uncertainty_res = self.pinn.predict_state_with_uncertainty(t, x, y, z, n_samples=10)
        mean_pred = uncertainty_res["mean"]
        uncertainty = uncertainty_res["uncertainty"]
        
        # 2. Calcul des résidus physiques locaux
        t_t = torch.tensor([[t]], dtype=torch.float32, device=self.pinn.device)
        x_t = torch.tensor([[x]], dtype=torch.float32, device=self.pinn.device)
        y_t = torch.tensor([[y]], dtype=torch.float32, device=self.pinn.device)
        z_t = torch.tensor([[z]], dtype=torch.float32, device=self.pinn.device)
        
        residuals = self.pinn.calculate_residuals(t_t, x_t, y_t, z_t)
        res_values = {k: float(v.item()) for k, v in residuals.items()}
        
        # 3. Score de confiance composite (0-100)
        # Basé sur : résidus (50%), incertitude (30%), OOD (20%)
        
        # Normalisation des résidus (seuil arbitraire 1e-3 pour 100%)
        res_score = max(0, 100 * (1.0 - sum(res_values.values()) / (5 * 1e-2)))
        
        # Normalisation de l'incertitude (pression relative)
        p_uncertainty = uncertainty.get("pressure", 0.0)
        p_mean = mean_pred.get("pressure", 101325.0)
        rel_uncertainty = p_uncertainty / (p_mean**2 + 1e-6) # Variance relative
        unc_score = max(0, 100 * (1.0 - rel_uncertainty * 1e6))
        
        # OOD Score
        ood_detected = False
        dist = 0.0
        if self.is_fitted:
            feature = np.array([mean_pred[k] for k in sorted(mean_pred.keys())])
            ood_detected, dist = self.ood_detector.is_out_of_distribution(feature)
        
        ood_score = 0 if ood_detected else 100
        
        composite_score = 0.5 * res_score + 0.3 * unc_score + 0.2 * ood_score
        
        return {
            "is_certified": composite_score > 80,
            "composite_score": float(composite_score),
            "residuals": res_values,
            "uncertainty": {k: float(v) for k, v in uncertainty.items()},
            "ood_detected": ood_detected,
            "mahalanobis_distance": float(dist)
        }

    def get_safe_prediction(self, t: float, x: float, y: float, z: float) -> Dict:
        """Retourne la prédiction avec son certificat de sécurité"""
        pred = self.pinn.predict_state(t, x, y, z)
        cert = self.certify_prediction(t, x, y, z)
        
        return {
            **pred,
            "certification": cert,
            "status": "SAFE" if cert["is_certified"] else "RISKY"
        }
