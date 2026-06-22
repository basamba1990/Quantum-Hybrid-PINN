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

    def load_ood_stats(self, stats_path: str):
        """Charge les statistiques OOD pré-calculées"""
        try:
            from hydrogen_pinn_v8 import MahalanobisOODDetector
            data = np.load(stats_path)
            self.ood_detector = MahalanobisOODDetector(threshold_percentile=self.threshold_percentile)
            self.ood_detector.mean = data['mean']
            # Reconstruire l'inverse de la covariance
            cov = data['cov']
            d = len(self.ood_detector.mean)
            shrinkage = 0.01
            cov_reg = (1 - shrinkage) * cov + shrinkage * np.eye(d) * np.trace(cov) / d
            self.ood_detector.cov_inv = np.linalg.pinv(cov_reg)
            
            # Seuil par défaut basé sur la distribution de Mahalanobis (Chi-2)
            # Pour d=5, p=0.99, le seuil est environ 15.0
            self.ood_detector.threshold = 15.0 
            self.ood_detector.fitted = True
            self.is_fitted = True
            logger.info(f"Statistiques OOD chargées depuis {stats_path}")
            return True
        except Exception as e:
            logger.error(f"Erreur chargement OOD stats: {e}")
            return False

    def certify_prediction(self, t: float, x: float, y: float, z: float) -> Dict:
        """
        Certifie une prédiction en calculant les résidus et l'incertitude.
        """
        # 1. Calcul de l'incertitude via MC Dropout (fallback si non implémenté)
        if hasattr(self.pinn, "predict_state_with_uncertainty"):
            uncertainty_res = self.pinn.predict_state_with_uncertainty(t, x, y, z, n_samples=10)
            mean_pred = uncertainty_res["mean"]
            uncertainty = uncertainty_res["uncertainty"]
        else:
            # Fallback : prédiction standard sans incertitude réelle
            pred = self.pinn.predict_state(t, x, y, z)
            mean_pred = pred
            uncertainty = {"pressure": 0.05, "velocity": 0.05, "temperature": 0.05}
        
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

    def check_drift(self, batch_residuals: List[Dict[str, float]]) -> Dict:
        """
        Analyse une série de résidus pour détecter une dérive physique globale.
        """
        if not batch_residuals:
            return {"drift_detected": False, "drift_score": 0.0}
            
        avg_res = sum([sum(r.values()) for r in batch_residuals]) / (len(batch_residuals) * 5)
        # Seuil industriel : 1e-3
        drift_score = avg_res / 1e-3
        
        return {
            "drift_detected": drift_score > 2.0,
            "drift_score": float(drift_score),
            "avg_residual": float(avg_res)
        }
