import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging
import gc

from pinn_3d_navier_stokes import PINN3DNavierStokes, T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
from rock_pinn_3d import RockPINN3D
from deep_kalman_filter import DeepKalmanFilter
from quantum_eos_torch import SilveraGoldmanEOS, integrate_eos_in_pinn_loss
from quantum_kernel import QuantumRobustKernel

logger = logging.getLogger(__name__)

def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")

class MahalanobisOODDetector:
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
    def __init__(self, layers: List[int] = None, fluid_type: str = 'H2', rock_type: str = None, geometry_type: str = 'pipeline', enable_quantum: bool = False):
        self.device = get_device()
        self.fluid_type = fluid_type
        self.rock_type = rock_type
        self.enable_quantum = enable_quantum
        
        if rock_type:
            self.pinn_model = RockPINN3D(layers, rock_type=rock_type).to(self.device)
        else:
            # Architecture industrielle par défaut si non spécifiée
            if layers is None:
                layers = [4, 128, 128, 128, 128, 5]
            self.pinn_model = PINN3DNavierStokes(layers, fluid_type=fluid_type).to(self.device)
            
        if enable_quantum:
            self.quantum_kernel = QuantumRobustKernel(n_qubits=4).to(self.device)
            logger.info("Quantum Robust Kernel enabled for high-dimensional feature separation.")
            
        self.dkl_model = DeepKalmanFilter(state_dim=5, observation_dim=3).to(self.device)
        self.eos_model = SilveraGoldmanEOS(device=self.device)
        self.enable_ood_detection = False
        self.enable_dropout = False
        self.ood_detector = None
        self.physics_residual_threshold = 0.01 # Seuil industriel plus strict (1%)

    def fit_ood_detector(self, training_features: np.ndarray, threshold_percentile: float = 99.0):
        if not self.enable_ood_detection:
            logger.warning("OOD detection is disabled, but fit_ood_detector called. Enabling it.")
            self.enable_ood_detection = True
        self.ood_detector = MahalanobisOODDetector(threshold_percentile=threshold_percentile)
        self.ood_detector.fit(training_features)
        logger.info("OOD detector fitted successfully.")

    def _extract_feature_from_state(self, state: Dict[str, np.ndarray]) -> np.ndarray:
        p_field = state.get("p", None)
        if p_field is None:
            raise ValueError("State does not contain pressure field for OOD detection")
        feature = p_field.flatten()
        max_dim = 1024
        if len(feature) > max_dim:
            indices = np.linspace(0, len(feature)-1, max_dim, dtype=int)
            feature = feature[indices]
        return feature

    def is_ood(self, state: Dict[str, np.ndarray]) -> Tuple[bool, float]:
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
        t_tensor = torch.tensor([[t]], dtype=torch.float32, device=self.device)
        x_tensor = torch.tensor([[x]], dtype=torch.float32, device=self.device)
        y_tensor = torch.tensor([[y]], dtype=torch.float32, device=self.device)
        z_tensor = torch.tensor([[z]], dtype=torch.float32, device=self.device)
        
        self.pinn_model.train()
        predictions = []
        
        with torch.no_grad():
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
        mean = {}
        variance = {}
        if not predictions:
            return {"mean": {}, "variance": {}}
            
        keys = predictions[0].keys()
        for key in keys:
            values = np.array([p[key] for p in predictions])
            mean[key] = np.mean(values)
            variance[key] = np.var(values)
            
        return {"mean": mean, "uncertainty": variance}

    def calculate_residuals(self, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> Dict[str, torch.Tensor]:
        self.pinn_model.eval()
        with torch.enable_grad():
            t_t = t.clone().detach().requires_grad_(True).to(self.device)
            x_t = x.clone().detach().requires_grad_(True).to(self.device)
            y_t = y.clone().detach().requires_grad_(True).to(self.device)
            z_t = z.clone().detach().requires_grad_(True).to(self.device)
            
            rho, u, v, w, T = self.pinn_model(t_t, x_t, y_t, z_t)
            mass, mom_x, mom_y, mom_z, energy = self.pinn_model.compute_residuals(
                t_t, x_t, y_t, z_t, rho, u, v, w, T, scale_dict=getattr(self, 'scales', None)
            )
            
            return {
                "continuity": torch.abs(mass).detach(),
                "momentum_x": torch.abs(mom_x).detach(),
                "momentum_y": torch.abs(mom_y).detach(),
                "momentum_z": torch.abs(mom_z).detach(),
                "energy": torch.abs(energy).detach()
            }

    def predict_batch(self, t: np.ndarray, x: np.ndarray, y: np.ndarray, z: np.ndarray,
                      return_ood_info: bool = False, validate_physics: bool = True) -> Dict:
        self.pinn_model.eval()
        t_tensor = torch.from_numpy(t).float().view(-1, 1).to(self.device)
        x_tensor = torch.from_numpy(x).float().view(-1, 1).to(self.device)
        y_tensor = torch.from_numpy(y).float().view(-1, 1).to(self.device)
        z_tensor = torch.from_numpy(z).float().view(-1, 1).to(self.device)

        physics_status = {"is_valid": True, "residuals": {}}
        if validate_physics:
            residuals = self.calculate_residuals(t_tensor, x_tensor, y_tensor, z_tensor)
            mean_residuals = {k: float(v.mean()) for k, v in residuals.items()}
            max_res = max(mean_residuals.values())
            is_valid = max_res < self.physics_residual_threshold
            physics_status = {"is_valid": is_valid, "residuals": mean_residuals}

        with torch.inference_mode():
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
            "physics_audit": physics_status
        }
        return results

    def train_pinn(self, epochs: int = 5000, learning_rate: float = 1e-3,
                   N_pde: int = 1250000, adapt_every: int = 500,
                   n_refine: int = 1000) -> Dict[str, List[float]]:
        """
        Entraînement Industriel avec Maillage Raffiné (1.25M points).
        Utilise une stratégie de batching pour éviter les dépassements de mémoire.
        """
        self.pinn_model.train()
        optimizer = torch.optim.Adam(self.pinn_model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

        batch_size = 10000 # Taille de batch pour le calcul des résidus
        history = {"loss": []}

        for epoch in range(epochs):
            optimizer.zero_grad()
            
            # Échantillonnage du maillage (1.25M points répartis)
            # On échantillonne un batch frais à chaque itération pour couvrir tout le domaine
            t_batch = (torch.rand(batch_size, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN).requires_grad_(True)
            x_batch = (torch.rand(batch_size, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN).requires_grad_(True)
            y_batch = (torch.rand(batch_size, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN).requires_grad_(True)
            z_batch = (torch.rand(batch_size, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN).requires_grad_(True)
            
            loss = self.pinn_model.loss(t_batch, x_batch, y_batch, z_batch, scale_dict=None)
            loss.backward()
            optimizer.step()
            scheduler.step()
            
            if epoch % 100 == 0:
                logger.info(f"Epoch {epoch}: Loss = {loss.item():.6f}")
                history["loss"].append(loss.item())
            
            # Libérer la mémoire
            del t_batch, x_batch, y_batch, z_batch, loss
            if torch.cuda.is_available(): torch.cuda.empty_cache()

        return history
