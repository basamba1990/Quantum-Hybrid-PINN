import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging

from pinn_3d_navier_stokes import PINN3DNavierStokes, T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
from rock_pinn_3d import RockPINN3D
from deep_kalman_filter import DeepKalmanFilter
from quantum_eos_torch import SilveraGoldmanEOS, integrate_eos_in_pinn_loss

# Configuration du logger
logger = logging.getLogger(__name__)

# Utility function to get device
def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")


# =============================================================================
# Détecteur OOD par distance de Mahalanobis
# =============================================================================
class MahalanobisOODDetector:
    """
    Détecteur OOD basé sur la distance de Mahalanobis.
    Calcule les statistiques (moyenne, covariance) sur un ensemble de features.
    """
    def __init__(self, threshold_percentile: float = 99.0):
        self.mean = None
        self.cov_inv = None
        self.threshold = None
        self.threshold_percentile = threshold_percentile
        self.fitted = False

    def fit(self, features: np.ndarray):
        if features.ndim == 1:
            features = features.reshape(-1, 1)
        N, d = features.shape
        self.mean = np.mean(features, axis=0)
        cov = np.cov(features, rowvar=False)
        # Régularisation de Ledoit-Wolf (shrinkage)
        shrinkage = 0.01
        cov_reg = (1 - shrinkage) * cov + shrinkage * np.eye(d) * np.trace(cov) / d
        try:
            self.cov_inv = np.linalg.pinv(cov_reg)
        except np.linalg.LinAlgError:
            self.cov_inv = np.linalg.pinv(cov_reg + 1e-6 * np.eye(d))

        distances = []
        for f in features:
            delta = f - self.mean
            dist = np.sqrt(delta @ self.cov_inv @ delta)
            distances.append(dist)
        self.threshold = np.percentile(distances, self.threshold_percentile)
        self.fitted = True
        logger.info(f"MahalanobisOODDetector fitted: mean dim={d}, threshold={self.threshold:.4f}")

    def compute_distance(self, feature: np.ndarray) -> float:
        if not self.fitted:
            raise ValueError("Detector not fitted yet.")
        delta = feature - self.mean
        return float(np.sqrt(delta @ self.cov_inv @ delta))

    def is_out_of_distribution(self, feature: np.ndarray) -> Tuple[bool, float]:
        dist = self.compute_distance(feature)
        return (dist > self.threshold, dist)


class HydrogenPINNV8:
    def __init__(self, layers: List[int] = None, fluid_type: str = 'H2', rock_type: str = None):
        self.device = get_device()
        self.fluid_type = fluid_type
        self.rock_type = rock_type
        
        if rock_type:
            self.pinn_model = RockPINN3D(layers, rock_type=rock_type).to(self.device)
        else:
            self.pinn_model = PINN3DNavierStokes(layers, fluid_type=fluid_type).to(self.device)
        # Assuming state_dim for DKL is (rho, u, v, w, T) = 5
        # Assuming observation_dim is 3 (pressure, temperature, flow rate)
        self.dkl_model = DeepKalmanFilter(state_dim=5, observation_dim=3).to(self.device)

        # Modèle EOS quantique
        self.eos_model = SilveraGoldmanEOS(device=self.device)

        # Configuration des fonctionnalités
        self.enable_ood_detection = False
        self.enable_dropout = False

        # Détecteur OOD (initialisé plus tard)
        self.ood_detector = None

    def fit_ood_detector(self, training_features: np.ndarray, threshold_percentile: float = 99.0):
        """
        Entraîne le détecteur OOD sur un ensemble de features extraites des données d'entraînement.
        Args:
            training_features: tableau (N, d) où N = nombre d'échantillons, d = dimension feature.
            threshold_percentile: percentile utilisé pour le seuil OOD (99 par défaut).
        """
        if not self.enable_ood_detection:
            logger.warning("OOD detection is disabled, but fit_ood_detector called. Enabling it.")
            self.enable_ood_detection = True
        self.ood_detector = MahalanobisOODDetector(threshold_percentile=threshold_percentile)
        self.ood_detector.fit(training_features)
        logger.info("OOD detector fitted successfully.")

    def _extract_feature_from_state(self, state: Dict[str, np.ndarray]) -> np.ndarray:
        """
        Extrait un vecteur de features à partir de l'état courant (par exemple le champ de pression).
        À adapter selon la nature des données (ici on utilise le champ de pression mis à plat).
        """
        # On prend le champ de pression, on le met à plat
        p_field = state.get("p", None)
        if p_field is None:
            raise ValueError("State does not contain pressure field for OOD detection")
        feature = p_field.flatten()
        # Sous-échantillonnage si trop grand
        max_dim = 1024
        if len(feature) > max_dim:
            indices = np.linspace(0, len(feature)-1, max_dim, dtype=int)
            feature = feature[indices]
        return feature

    def is_ood(self, state: Dict[str, np.ndarray]) -> Tuple[bool, float]:
        """
        Vérifie si l'état est hors distribution.
        Retourne (is_ood, distance de Mahalanobis).
        """
        if not self.enable_ood_detection or self.ood_detector is None:
            return False, 0.0
        try:
            feature = self._extract_feature_from_state(state)
            return self.ood_detector.is_out_of_distribution(feature)
        except Exception as e:
            logger.error(f"OOD detection failed: {e}")
            return False, 0.0

    def predict_state_with_uncertainty(self, t: float, x: float, y: float, z: float,
                                        n_samples: int = 20) -> Dict[str, Dict[str, np.ndarray]]:
        """
        Prédiction avec incertitude (MC Dropout) pour un point unique.
        Retourne un dictionnaire contenant 'mean' et 'variance' pour chaque variable.
        """
        if not self.enable_dropout:
            logger.warning("MC Dropout not enabled. Call predict_state instead.")
            # Fallback vers prédiction déterministe
            deterministic = self.predict_state(t, x, y, z)
            return {"mean": deterministic, "variance": {k: 0.0 for k in deterministic}}

        t_tensor = torch.tensor([[t]], dtype=torch.float32, device=self.device)
        x_tensor = torch.tensor([[x]], dtype=torch.float32, device=self.device)
        y_tensor = torch.tensor([[y]], dtype=torch.float32, device=self.device)
        z_tensor = torch.tensor([[z]], dtype=torch.float32, device=self.device)

        # Activer le mode train pour que Dropout soit actif
        self.pinn_model.train()
        predictions = []
        for _ in range(n_samples):
            rho, u, v, w, T = self.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
            p = self.eos_model(rho, T)
            predictions.append({
                "pressure": p.item(),
                "velocity_u": u.item(),
                "velocity_v": v.item(),
                "velocity_w": w.item(),
                "temperature": T.item(),
                "density": rho.item(),
            })
        self.pinn_model.eval()

        # Calcul des moyennes et variances
        mean = {}
        variance = {}
        keys = predictions[0].keys()
        for key in keys:
            values = np.array([p[key] for p in predictions])
            mean[key] = np.mean(values)
            variance[key] = np.var(values)

        return {"mean": mean, "variance": variance}

    def predict_state(self, t: float, x: float, y: float, z: float,
                      return_ood_info: bool = False) -> Dict:
        """
        Prédiction déterministe pour un point.
        Si return_ood_info=True, retourne également le flag OOD et la distance.
        """
        # Vérification OOD (si activé)
        # Pour un point unique, on ne peut pas extraire un champ complet. On ignore.
        # L'OOD doit être vérifié sur l'état complet avant d'appeler predict_state.

        res = self.predict_batch(
            np.array([t]), np.array([x]), np.array([y]), np.array([z])
        )
        result = {k: v[0] if isinstance(v, np.ndarray) else v for k, v in res.items()}
        if return_ood_info:
            # On ne peut pas calculer OOD à partir d'un seul point, on retourne False
            result["ood_detected"] = False
            result["mahalanobis_distance"] = 0.0
        return result

    def predict_batch(self, t: np.ndarray, x: np.ndarray, y: np.ndarray, z: np.ndarray,
                      return_ood_info: bool = False) -> Dict:
        """
        Prédiction déterministe vectorisée.
        Si return_ood_info=True, ajoute les champs 'ood_detected' (booléen) et
        'mahalanobis_distance' pour chaque point (simulé ici, à adapter selon le contexte).
        """
        self.pinn_model.eval()

        t_tensor = torch.from_numpy(t).float().view(-1, 1).to(self.device)
        x_tensor = torch.from_numpy(x).float().view(-1, 1).to(self.device)
        y_tensor = torch.from_numpy(y).float().view(-1, 1).to(self.device)
        z_tensor = torch.from_numpy(z).float().view(-1, 1).to(self.device)

        with torch.no_grad():
            rho, u, v, w, T = self.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
            p = self.eos_model(rho, T)

        results = {
            "pressure": p.cpu().numpy().flatten(),
            "velocity_u": u.cpu().numpy().flatten(),
            "velocity_v": v.cpu().numpy().flatten(),
            "velocity_w": w.cpu().numpy().flatten(),
            "temperature": T.cpu().numpy().flatten(),
            "density": rho.cpu().numpy().flatten(),
            "time": t.flatten(),
            "x": x.flatten(),
            "y": y.flatten(),
            "z": z.flatten(),
        }

        if return_ood_info:
            # Pour l'instant, on met False par défaut (l'OOD doit être vérifié au niveau de l'état complet)
            results["ood_detected"] = np.zeros(len(t), dtype=bool)
            results["mahalanobis_distance"] = np.zeros(len(t))

        return results

    def train_pinn(self, epochs: int = 5000, learning_rate: float = 1e-3,
                   N_pde: int = 5000) -> Dict[str, List[float]]:
        """Entraînement du modèle PINN avec corrections industrielles"""
        optimizer = torch.optim.Adam(self.pinn_model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

        history = {"loss": []}

        # Points de collocation aléatoires
        t_pde = (torch.rand(N_pde, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN).requires_grad_(True)
        x_pde = (torch.rand(N_pde, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN).requires_grad_(True)
        y_pde = (torch.rand(N_pde, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN).requires_grad_(True)
        z_pde = (torch.rand(N_pde, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN).requires_grad_(True)

        for epoch in range(epochs):
            optimizer.zero_grad()
            rho_pred, u_pred, v_pred, w_pred, T_pred = self.pinn_model(t_pde, x_pde, y_pde, z_pde)
            
            # 1. Perte PDE (Navier-Stokes + Industrial Corrections)
            # On passe les points de collocation à la méthode loss du modèle
            pde_loss = self.pinn_model.loss(t_pde, x_pde, y_pde, z_pde)
            
            # 2. Contrainte de consistance thermodynamique stricte via EOS Silvera-Goldman
            # On utilise le modèle EOS quantique pour calculer la pression et valider la consistance
            eos_consistency_loss = integrate_eos_in_pinn_loss(self.eos_model, rho_pred, T_pred, weight=1.0)
            
            # 3. Résidu Thermodynamique Réel (Conservation de l'entropie / Mach)
            thermo_res = self.thermodynamic_residuals(rho_pred, T_pred, u_pred, v_pred, w_pred, x_pde, y_pde, z_pde)
            loss_thermo = torch.mean(thermo_res**2)

            total_loss = pde_loss + eos_consistency_loss + 0.1 * loss_thermo
            total_loss.backward()
            optimizer.step()
            scheduler.step()
            history["loss"].append(total_loss.item())

            if (epoch + 1) % 500 == 0:
                print(f"Epoch {epoch + 1}/{epochs}, Loss: {total_loss.item():.6e}")

        return history

    def thermodynamic_residuals(self, rho, T, u, v, w, x, y, z):
        """
        Résidu thermodynamique réel basé sur les dérivées de l'EOS quantique.
        Vérifie la compressibilité et la vitesse du son réelle.
        """
        # Utiliser les dérivées réelles de l'EOS Silvera-Goldman
        eos_derivs = self.eos_model.compute_pressure_derivatives(rho, T)
        dp_drho = eos_derivs['dp_drho']
        dp_dT = eos_derivs['dp_dT']
        
        # Capacité thermique à volume constant (Cv) pour H2 ~ 10100 J/(kg.K)
        Cv = 10100.0 
        
        # Calcul de la vitesse du son réelle au carré (c^2)
        # c^2 = (dp/drho)_s = dp/drho + (T/rho^2 * Cv) * (dp/dT)^2
        c2 = dp_drho + (T / (rho**2 * Cv + 1e-8)) * (dp_dT**2)
        
        # Calcul du nombre de Mach local
        velocity_mag = torch.sqrt(u**2 + v**2 + w**2 + 1e-8)
        mach_number = velocity_mag / torch.sqrt(torch.clamp(c2, min=1e-8))
        
        # Pénalité industrielle : Le nombre de Mach ne doit pas dépasser les limites physiques
        # du scénario de transport (souvent subsonique ou faiblement transsonique)
        mach_residual = torch.relu(mach_number - 2.0) # Pénaliser Mach > 2.0
        
        return mach_residual

    def assimilate_data(self, current_state: List[float], observation: List[float]) -> List[float]:
        self.dkl_model.eval()
        with torch.no_grad():
            state_tensor = torch.tensor([current_state], dtype=torch.float32, device=self.device)
            obs_tensor = torch.tensor([observation], dtype=torch.float32, device=self.device)
            # FIX 422: DeepKalmanFilter.forward expect (x_prev, P_prev)
            # Use assimilate_batch for simplified assimilation without covariance
            assimilated_state = self.dkl_model.assimilate_batch(state_tensor, obs_tensor)
        return assimilated_state.squeeze().tolist()
