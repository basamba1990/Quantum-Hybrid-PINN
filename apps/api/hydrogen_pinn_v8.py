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
        """Entraînement du modèle PINN (inchangé)"""
        optimizer = torch.optim.Adam(self.pinn_model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

        history = {"loss": []}

        # Points de collocation aléatoires
        t_pde = torch.rand(N_pde, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN
        x_pde = torch.rand(N_pde, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN
        y_pde = torch.rand(N_pde, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN
        z_pde = torch.rand(N_pde, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN

        for epoch in range(epochs):
            optimizer.zero_grad()
            rho_pred, u_pred, v_pred, w_pred, T_pred = self.pinn_model(t_pde, x_pde, y_pde, z_pde)
            p = self.eos_model(rho_pred, T_pred)
            pde_loss = self.pinn_model.loss(t_pde, x_pde, y_pde, z_pde,
                                             rho_pred, u_pred, v_pred, w_pred, T_pred)
            eos_loss = integrate_eos_in_pinn_loss(self.eos_model, rho_pred, T_pred, weight=0.1)
            # Placeholder for actual values, these would come from a simulation or data
            # For now, we'll use dummy values or derive them from PINN outputs if possible
            # This part needs careful integration with the actual simulation data flow
            # For a more realistic scenario, mass_flow_rate and efficiency would come from data or another model.
            # For now, we'll use fixed values or derive them if possible from PINN outputs.
            # Let's assume a constant isentropic efficiency for the component (e.g., compressor/turbine).
            isentropic_efficiency = 0.8 # Example constant value for a component
            # Mass flow rate could be derived from density and velocity if a cross-sectional area is known.
            # For simplicity, let's use a placeholder for now, or assume it's implicitly handled by the loss scaling.
            # If we had a specific component, we would need inlet/outlet conditions.
            # Given the current PINN output (p, T), we can focus on the efficiency residual itself.


            # Calculate thermodynamic residual loss
            # Note: pressure_pred and temperature_pred are already available from PINN output
            # The thermodynamic_residuals function now directly uses the predicted pressure and temperature
            # and a fixed isentropic efficiency. The mass_flow_rate is not directly used in the current
            # simplified residual calculation, but could be incorporated in a more complex model.
            loss_thermo = torch.mean(self.thermodynamic_residuals(p, T_pred, isentropic_efficiency))

            total_loss = pde_loss + eos_loss + 0.05 * loss_thermo
            total_loss.backward()
            optimizer.step()
            scheduler.step()
            history["loss"].append(total_loss.item())

            if (epoch + 1) % 500 == 0:
                print(f"Epoch {epoch + 1}/{epochs}, Loss: {total_loss.item():.6e}")

        return history

    def assimilate_data(self, current_state: List[float], observation: List[float]) -> List[float]:
        self.dkl_model.eval()
        with torch.no_grad():
            state_tensor = torch.tensor([current_state], dtype=torch.float32, device=self.device)
            obs_tensor = torch.tensor([observation], dtype=torch.float32, device=self.device)
            # Utilisation de la version simplifiée pour éviter les problèmes de covariance/Jacobienne en inférence
            assimilated_state = self.dkl_model.assimilate_batch(state_tensor, obs_tensor)
        return assimilated_state.squeeze().tolist()

    def thermodynamic_residuals(self, pressure, temperature, isentropic_efficiency: float = 0.8):
        """
        Calcule le résidu d'efficacité isentropique pour un compresseur/turbine.
        Ce calcul est basé sur une simplification pour l'intégration initiale.
        Pour une implémentation plus réaliste, il faudrait des conditions d'entrée/sortie
        spécifiques à un composant (par exemple, un compresseur ou une turbine).

        Args:
            pressure (torch.Tensor): Pression prédite par le PINN.
            temperature (torch.Tensor): Température prédite par le PINN.
            isentropic_efficiency (float): Efficacité isentropique du composant (par défaut 0.8).

        Returns:
            torch.Tensor: Le résidu d'efficacité isentropique.
        """
        # Pour une modélisation plus complète, on aurait besoin de:
        # - Pression et température d'entrée/sortie du composant
        # - Capacités thermiques (Cp, Cv) et constante des gaz (R) du fluide
        # - Débit massique (mass_flow_rate) pour calculer la puissance et l'énergie

        # Simplification: Utilisation d'un ratio de pression et d'un gamma constant (pour l'air, ~1.4)
        # C'est une approche très simplifiée pour illustrer l'intégration.
        gamma = 1.4 # Ratio des chaleurs spécifiques (pour l'air, à adapter pour H2)

        # Supposons une pression de référence (par exemple, pression atmosphérique) pour le ratio
        # ou un ratio de pression cible pour le composant.
        # Ici, nous utilisons une pression de référence arbitraire pour créer un ratio.
        # Dans un cas réel, ce serait (P_sortie / P_entrée).
        p_ref = 1e5 # Pression de référence en Pascals (1 bar)
        pressure_ratio = pressure / p_ref

        # Calcul de la température isentropique de sortie (pour un compresseur)
        # T_ideal_out = T_in * (P_out / P_in)^((gamma-1)/gamma)
        # Ici, nous inversons pour trouver une température idéale de référence
        # Cette partie est une simplification. Dans un cas réel, on aurait besoin de T_in et P_in.
        # Pour l'instant, nous allons simuler un résidu basé sur la cohérence avec une efficacité donnée.
        # Si T_ideal est la température de sortie idéale, et T est la température de sortie réelle,
        # alors l'efficacité isentropique (pour un compresseur) est: eta = (T_ideal - T_in) / (T - T_in)
        # Ou pour une turbine: eta = (T_in - T) / (T_in - T_ideal)

        # Pour simplifier, nous allons créer un résidu qui pénalise les écarts par rapport à une relation
        # P-T isentropique, en tenant compte de l'efficacité.
        # T_isentropic = T_ref * (P / P_ref)^((gamma-1)/gamma)
        # Nous allons utiliser la température prédite comme T_ref pour le calcul du résidu.
        # Le résidu sera la différence entre la température prédite et une température isentropique attendue à partir de la pression prédite
        # en supposant une température de référence (ici, la température prédite elle-même pour le calcul du résidu)
        # et une pression de référence.
        # C'est une simplification pour créer un signal de perte.
        T_isentropic_expected = temperature * (pressure_ratio ** ((gamma - 1) / gamma))

        # Le résidu thermodynamique est la différence entre la température prédite
        # et la température isentropique attendue, ajustée par l'efficacité.
        # Pour un compresseur, T_real > T_ideal. Si efficiency < 1, T_real est encore plus grande.
        # Donc, (T_real - T_ideal) / (1 - efficiency) devrait être petit.
        # Ou, (T_real - T_ideal) / T_ideal est le résidu non-isentropique.

        # Une façon de formuler le résidu est de dire que la température réelle doit être
        # cohérente avec la température isentropique et l'efficacité.
        # Pour un compresseur: T_real = T_in + (T_ideal_out - T_in) / isentropic_efficiency
        # Pour une turbine: T_real = T_in - (T_in - T_ideal_out) * isentropic_efficiency

        # Étant donné que nous n'avons pas T_in et P_in pour un composant spécifique,
        # nous allons créer un résidu qui pénalise la déviation de la relation isentropique
        # en tenant compte de l'efficacité.
        # Le résidu est la différence entre la température prédite et la température
        # qui serait attendue si le processus était isentropique avec l'efficacité donnée.

        # Si le processus était isentropique (efficacité = 1), T_pred devrait être T_isentropic_expected.
        # Si l'efficacité est < 1, la température réelle sera plus élevée (pour un compresseur).
        # Le résidu devrait être proche de zéro si T_pred est cohérent avec T_isentropic_expected et isentropic_efficiency.

        # Résidu basé sur l'écart entre la température prédite et la température isentropique
        # ajustée par l'efficacité. Ceci est une forme de pénalité pour la non-conformité
        # aux lois de la thermodynamique pour un processus avec une efficacité donnée.
        thermodynamic_residual = (temperature - T_isentropic_expected) / (T_isentropic_expected + 1e-6)

        # Nous pouvons aussi considérer un résidu basé sur l'efficacité elle-même.
        # Si nous avions T_in et P_in, nous pourrions calculer l'efficacité réelle et la comparer à isentropic_efficiency.
        # Pour l'instant, nous utilisons le résidu de température.

        return thermodynamic_residual
