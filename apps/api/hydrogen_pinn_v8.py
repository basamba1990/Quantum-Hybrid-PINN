import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging
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

    # ... (les méthodes predict_state, predict_batch, etc. restent identiques à la version précédente) ...
    # Pour gagner de la place, je ne les répète pas ici mais vous pouvez les reprendre de la réponse précédente.
    # L'essentiel est la méthode train_pinn ci-dessous.

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
        self.dkl_model.eval()
        with torch.no_grad():
            state_tensor = torch.tensor([current_state], dtype=torch.float32, device=self.device)
            obs_tensor = torch.tensor([observation], dtype=torch.float32, device=self.device)
            assimilated_state = self.dkl_model.assimilate_batch(state_tensor, obs_tensor)
        return assimilated_state.squeeze().tolist()

    # ==================== ENTRAÎNEMENT CORRIGÉ ====================
    def train_pinn(self, epochs: int = 5000, learning_rate: float = 1e-3,
                   N_pde: int = 5000, adapt_every: int = 500,
                   n_refine: int = 500, loss_weights: List[float] = None) -> Dict[str, List[float]]:
        if loss_weights is None:
            loss_weights = [1.0, 1.0, 1.0, 1.0, 1.0]

        self.pinn_model.train()
        optimizer = torch.optim.Adam(self.pinn_model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

        # Étape 1 : calculer les échelles de normalisation sur un batch initial
        print("Calcul des échelles de normalisation des résidus...")
        with torch.no_grad():
            t_temp = (torch.rand(N_pde, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN)
            x_temp = (torch.rand(N_pde, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN)
            y_temp = (torch.rand(N_pde, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN)
            z_temp = (torch.rand(N_pde, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN)
            rho_t, u_t, v_t, w_t, T_t = self.pinn_model(t_temp, x_temp, y_temp, z_temp)
            mass_brut, mom_x_brut, mom_y_brut, mom_z_brut, energy_brut, scales = self.pinn_model.compute_residuals(
                t_temp, x_temp, y_temp, z_temp, rho_t, u_t, v_t, w_t, T_t, scale_dict=None)
        print(f"Échelles initiales : mass={scales['mass']:.2e}, mom={scales['mom']:.2e}, energy={scales['energy']:.2e}")

        # Génération initiale des points de collocation
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

            # Vérification que la loss n'est pas nulle (au cas où)
            if total_loss.item() < 1e-12:
                print(f"⚠️ Attention : loss nulle à l'epoch {epoch+1} !")
                total_loss = total_loss + 1e-8  # forcer une petite valeur

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

            # Échantillonnage adaptatif sans concaténation (on régénère un nouveau jeu de points)
            if (epoch + 1) % adapt_every == 0:
                print(f"Epoch {epoch+1}: échantillonnage adaptatif...")
                # Générer des candidats
                N_candidate = 10000
                t_cand = (torch.rand(N_candidate, 1, device=self.device) * (T_MAX - T_MIN) + T_MIN).requires_grad_(True)
                x_cand = (torch.rand(N_candidate, 1, device=self.device) * (X_MAX - X_MIN) + X_MIN).requires_grad_(True)
                y_cand = (torch.rand(N_candidate, 1, device=self.device) * (Y_MAX - Y_MIN) + Y_MIN).requires_grad_(True)
                z_cand = (torch.rand(N_candidate, 1, device=self.device) * (Z_MAX - Z_MIN) + Z_MIN).requires_grad_(True)

                with torch.no_grad():
                    rho_c, u_c, v_c, w_c, T_c = self.pinn_model(t_cand, x_cand, y_cand, z_cand)
                    mass_c, mom_x_c, mom_y_c, mom_z_c, energy_c = self.pinn_model.compute_residuals(
                        t_cand, x_cand, y_cand, z_cand, rho_c, u_c, v_c, w_c, T_c, scale_dict=scales)
                    residual_norm = (mass_c**2 + mom_x_c**2 + mom_y_c**2 + mom_z_c**2 + energy_c**2).squeeze()
                top_indices = torch.topk(residual_norm, n_refine).indices

                # Créer un nouveau jeu de points en combinant les anciens (détachés) et les meilleurs candidats
                # On évite la concaténation de tenseurs avec historique en recréant tout.
                new_t = torch.cat([t_pde.detach(), t_cand[top_indices]])
                new_x = torch.cat([x_pde.detach(), x_cand[top_indices]])
                new_y = torch.cat([y_pde.detach(), y_cand[top_indices]])
                new_z = torch.cat([z_pde.detach(), z_cand[top_indices]])
                t_pde = new_t.requires_grad_(True)
                x_pde = new_x.requires_grad_(True)
                y_pde = new_y.requires_grad_(True)
                z_pde = new_z.requires_grad_(True)
                print(f"  -> Nouveau total de points : {len(t_pde)}")

            if (epoch + 1) % 500 == 0:
                print(f"Epoch {epoch+1}/{epochs}, Loss: {total_loss.item():.6e}, Weights: {adaptive_weights.cpu().numpy()}")

        return history
