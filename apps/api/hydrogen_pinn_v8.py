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
    def __init__(self, layers: List[int] = None, fluid_type: str = 'H2', rock_type: str = None):
        self.device = get_device()
        self.fluid_type = fluid_type
        self.rock_type = rock_type
        if rock_type:
            self.pinn_model = RockPINN3D(layers, rock_type=rock_type).to(self.device)
        else:
            self.pinn_model = PINN3DNavierStokes(layers, fluid_type=fluid_type).to(self.device)
        self.dkl_model = DeepKalmanFilter(state_dim=5, observation_dim=3).to(self.device)
        self.eos_model = SilveraGoldmanEOS(device=self.device)
        self.enable_ood_detection = False
        self.enable_dropout = False
        self.ood_detector = None

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
        if not self.enable_dropout:
            deterministic = self.predict_state(t, x, y, z)
            return {"mean": deterministic, "variance": {k: 0.0 for k in deterministic}}
        t_tensor = torch.tensor([[t]], dtype=torch.float32, device=self.device)
        x_tensor = torch.tensor([[x]], dtype=torch.float32, device=self.device)
        y_tensor = torch.tensor([[y]], dtype=torch.float32, device=self.device)
        z_tensor = torch.tensor([[z]], dtype=torch.float32, device=self.device)
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
        res = self.predict_batch(
            np.array([t]), np.array([x]), np.array([y]), np.array([z])
        )
        result = {k: v[0] if isinstance(v, np.ndarray) else v for k, v in res.items()}
        if return_ood_info:
            result["ood_detected"] = False
            result["mahalanobis_distance"] = 0.0
        return result

    # ========== INFÉRENCE AVEC MEMOIRE RÉDUITE ==========
    def calculate_residuals(self, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Calcule les vrais résidus physiques de Navier-Stokes en utilisant les gradients automatiques.
        """
        self.pinn_model.eval()
        # S'assurer que les gradients sont activés pour le calcul des résidus
        with torch.enable_grad():
            # Cloner et activer les gradients sur les entrées si nécessaire
            t_t = t.clone().detach().requires_grad_(True).to(self.device)
            x_t = x.clone().detach().requires_grad_(True).to(self.device)
            y_t = y.clone().detach().requires_grad_(True).to(self.device)
            z_t = z.clone().detach().requires_grad_(True).to(self.device)
            
            rho, u, v, w, T = self.pinn_model(t_t, x_t, y_t, z_t)
            
            # Utiliser la méthode du modèle pour calculer les résidus
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
                      return_ood_info: bool = False) -> Dict:
        """
        Prédiction batch avec inference_mode pour réduire l'empreinte mémoire.
        """
        self.pinn_model.eval()
        t_tensor = torch.from_numpy(t).float().view(-1, 1).to(self.device)
        x_tensor = torch.from_numpy(x).float().view(-1, 1).to(self.device)
        y_tensor = torch.from_numpy(y).float().view(-1, 1).to(self.device)
        z_tensor = torch.from_numpy(z).float().view(-1, 1).to(self.device)

        # Utiliser inference_mode pour désactiver les gradients et réduire la mémoire
        with torch.inference_mode():
            rho, u, v, w, T = self.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
            p = self.eos_model(rho, T)

        # Nettoyer les tenseurs pour libérer la mémoire
        del t_tensor, x_tensor, y_tensor, z_tensor

        p = torch.nan_to_num(p, nan=101325.0)
        u = torch.nan_to_num(u, nan=0.0)
        v = torch.nan_to_num(v, nan=0.0)
        w = torch.nan_to_num(w, nan=0.0)
        T = torch.nan_to_num(T, nan=293.15)
        rho = torch.nan_to_num(rho, nan=1.0)

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
            results["ood_detected"] = np.zeros(len(t), dtype=bool)
            results["mahalanobis_distance"] = np.zeros(len(t))

        # Libérer la mémoire GPU si utilisée
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        return results

    def thermodynamic_residuals(self, rho, T, u, v, w, x, y, z):
        eos_derivs = self.eos_model.compute_pressure_derivatives(rho, T)
        dp_drho = eos_derivs['dp_drho']
        dp_dT = eos_derivs['dp_dT']
        Cv = 10100.0
        c2 = dp_drho + (T / (rho**2 * Cv + 1e-8)) * (dp_dT**2)
        velocity_mag = torch.sqrt(u**2 + v**2 + w**2 + 1e-8)
        mach_number = velocity_mag / torch.sqrt(torch.clamp(c2, min=1e-8))
        mach_residual = torch.relu(mach_number - 2.0)
        return mach_residual

    def assimilate_data(self, current_state: List[float], observation: List[float]) -> List[float]:
        """
        Assimilation avec inference_mode pour réduire la mémoire.
        """
        self.dkl_model.eval()
        with torch.inference_mode():
            state_tensor = torch.tensor([current_state], dtype=torch.float32, device=self.device)
            obs_tensor = torch.tensor([observation], dtype=torch.float32, device=self.device)
            assimilated_state = self.dkl_model.assimilate_batch(state_tensor, obs_tensor)
        return assimilated_state.squeeze().tolist()

    # ========== ENTRAÎNEMENT ==========
    def train_pinn(self, epochs: int = 5000, learning_rate: float = 1e-3,
                   N_pde: int = 5000, adapt_every: int = 500,
                   n_refine: int = 500, loss_weights: List[float] = None) -> Dict[str, List[float]]:
        """
        Entraînement du modèle (à utiliser sur Colab avec GPU).
        Pour réduire la mémoire sur Render, privilégier l'inférence (predict_batch, assimilate_data).
        """
        if loss_weights is None:
            loss_weights = [1.0, 1.0, 1.0, 1.0, 1.0]

        self.pinn_model.train()
        optimizer = torch.optim.Adam(self.pinn_model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

        # Calcul des échelles de normalisation
        print("Calcul des échelles de normalisation des résidus...")
        with torch.enable_grad():
            t_temp = (torch.rand(N_pde, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN).requires_grad_(True)
            x_temp = (torch.rand(N_pde, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN).requires_grad_(True)
            y_temp = (torch.rand(N_pde, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN).requires_grad_(True)
            z_temp = (torch.rand(N_pde, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN).requires_grad_(True)
            rho_t, u_t, v_t, w_t, T_t = self.pinn_model(t_temp, x_temp, y_temp, z_temp)
            _, _, _, _, _, scales = self.pinn_model.compute_residuals(
                t_temp, x_temp, y_temp, z_temp, rho_t, u_t, v_t, w_t, T_t, scale_dict=None)
        print(f"Échelles : mass={scales['mass']:.2e}, mom={scales['mom']:.2e}, energy={scales['energy']:.2e}")

        # Points de collocation initiaux
        t_pde = (torch.rand(N_pde, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN).requires_grad_(True)
        x_pde = (torch.rand(N_pde, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN).requires_grad_(True)
        y_pde = (torch.rand(N_pde, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN).requires_grad_(True)
        z_pde = (torch.rand(N_pde, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN).requires_grad_(True)

        adaptive_weights = torch.tensor(loss_weights, device=self.device, requires_grad=False)
        loss_components_history = []
        history = {"loss": []}

        for epoch in range(epochs):
            optimizer.zero_grad()
            rho_pred, u_pred, v_pred, w_pred, T_pred = self.pinn_model(t_pde, x_pde, y_pde, z_pde)
            mass, mom_x, mom_y, mom_z, energy = self.pinn_model.compute_residuals(
                t_pde, x_pde, y_pde, z_pde, rho_pred, u_pred, v_pred, w_pred, T_pred, scale_dict=scales)

            loss_mass = (mass**2).mean()
            loss_mom_x = (mom_x**2).mean()
            loss_mom_y = (mom_y**2).mean()
            loss_mom_z = (mom_z**2).mean()
            loss_energy = (energy**2).mean()

            eos_loss = integrate_eos_in_pinn_loss(self.eos_model, rho_pred, T_pred, weight=1.0)
            thermo_res = self.thermodynamic_residuals(rho_pred, T_pred, u_pred, v_pred, w_pred, x_pde, y_pde, z_pde)
            loss_thermo = torch.mean(thermo_res**2)

            weighted_pde = (adaptive_weights[0] * loss_mass +
                            adaptive_weights[1] * loss_mom_x +
                            adaptive_weights[2] * loss_mom_y +
                            adaptive_weights[3] * loss_mom_z +
                            adaptive_weights[4] * loss_energy)
            total_loss = weighted_pde + eos_loss + 0.1 * loss_thermo

            total_loss.backward()
            optimizer.step()
            scheduler.step()

            history["loss"].append(total_loss.item())
            loss_components_history.append([loss_mass.item(), loss_mom_x.item(), loss_mom_y.item(),
                                            loss_mom_z.item(), loss_energy.item()])

            # Mise à jour des poids adaptatifs
            if epoch % 100 == 0 and epoch > 0:
                recent = np.array(loss_components_history[-100:])
                mean_losses = recent.mean(axis=0)
                mean_losses = np.maximum(mean_losses, 1e-8)
                inv_mean = 1.0 / mean_losses
                new_weights = inv_mean / inv_mean.mean()
                adaptive_weights = torch.tensor(new_weights, device=self.device, dtype=torch.float32)
                print(f"Epoch {epoch}: updated weights = {new_weights}")

            # Échantillonnage adaptatif
            if (epoch + 1) % adapt_every == 0:
                N_candidate = 10000
                t_cand = (torch.rand(N_candidate, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN).requires_grad_(True)
                x_cand = (torch.rand(N_candidate, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN).requires_grad_(True)
                y_cand = (torch.rand(N_candidate, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN).requires_grad_(True)
                z_cand = (torch.rand(N_candidate, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN).requires_grad_(True)

                with torch.enable_grad():
                    rho_c, u_c, v_c, w_c, T_c = self.pinn_model(t_cand, x_cand, y_cand, z_cand)
                    mass_c, mom_x_c, mom_y_c, mom_z_c, energy_c = self.pinn_model.compute_residuals(
                        t_cand, x_cand, y_cand, z_cand, rho_c, u_c, v_c, w_c, T_c, scale_dict=scales)
                    residual_norm = (mass_c**2 + mom_x_c**2 + mom_y_c**2 + mom_z_c**2 + energy_c**2).detach().squeeze()
                top_indices = torch.topk(residual_norm, n_refine).indices

                # Détacher les anciens points pour éviter l'accumulation du graphe
                t_old = t_pde.detach()
                x_old = x_pde.detach()
                y_old = y_pde.detach()
                z_old = z_pde.detach()

                new_t = torch.cat([t_old, t_cand[top_indices].detach()])
                new_x = torch.cat([x_old, x_cand[top_indices].detach()])
                new_y = torch.cat([y_old, y_cand[top_indices].detach()])
                new_z = torch.cat([z_old, z_cand[top_indices].detach()])

                t_pde = new_t.requires_grad_(True)
                x_pde = new_x.requires_grad_(True)
                y_pde = new_y.requires_grad_(True)
                z_pde = new_z.requires_grad_(True)

                # Nettoyer les tenseurs candidats pour libérer la mémoire
                del t_cand, x_cand, y_cand, z_cand, rho_c, u_c, v_c, w_c, T_c, mass_c, mom_x_c, mom_y_c, mom_z_c, energy_c, residual_norm
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                gc.collect()

                print(f"Epoch {epoch+1}: adaptation -> {len(t_pde)} points")

            if (epoch + 1) % 500 == 0:
                print(f"Epoch {epoch+1}/{epochs}, Loss: {total_loss.item():.6e}")

        return history
