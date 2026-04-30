"""
Deep Kalman Filter for data assimilation in PINN simulations.
Version industrielle avec propagation de covariance et gestion des gradients.
"""

import torch
import torch.nn as nn
from typing import Tuple, Dict, Optional


class DeepKalmanFilter(nn.Module):
    """
    Deep Kalman Filter with learnable transition and observation models.
    Supports state covariance propagation for robust data assimilation.
    """
    def __init__(self, state_dim: int, observation_dim: int, hidden_dim: int = 64):
        super().__init__()
        self.state_dim = state_dim
        self.observation_dim = observation_dim

        # Transition model (state dynamics)
        self.f = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, state_dim)
        )

        # Observation model (measurement mapping)
        self.h = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, observation_dim)
        )

        # Process noise covariance (diagonal, log-parameterized for positivity)
        self.log_Q = nn.Parameter(torch.ones(state_dim) * -4.605)  # log(0.01)

        # Observation noise covariance (diagonal)
        self.log_R = nn.Parameter(torch.ones(observation_dim) * -2.302)  # log(0.1)

    @property
    def Q(self) -> torch.Tensor:
        """Process noise covariance matrix (diagonal)."""
        return torch.diag_embed(torch.exp(self.log_Q))

    @property
    def R(self) -> torch.Tensor:
        """Observation noise covariance matrix (diagonal)."""
        return torch.diag_embed(torch.exp(self.log_R))

    def forward(self, x_prev: torch.Tensor, P_prev: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Prediction step.

        Args:
            x_prev: Previous state (batch, state_dim)
            P_prev: Previous covariance (batch, state_dim, state_dim) or None

        Returns:
            x_pred: Predicted state
            P_pred: Predicted covariance
        """
        batch_size = x_prev.shape[0]
        x_pred = self.f(x_prev)

        if P_prev is None:
            # Initial covariance: just process noise
            P_pred = self.Q.unsqueeze(0).expand(batch_size, -1, -1)
        else:
            # Linearize transition (Jacobian via automatic differentiation)
            # Note: full Jacobian per batch is expensive; we approximate by per-element
            # For simplicity, compute Jacobian for each sample individually (or use a fixed linearization)
            F = torch.autograd.functional.jacobian(self.f, x_prev, create_graph=False)
            # F shape: (batch, state_dim, state_dim) if vectorized
            # In practice, we approximate F as identity + small perturbation
            # Simpler: assume linear transition with fixed matrix (training learns it)
            # For efficiency, we compute a single Jacobian for the mean
            x_mean = x_prev.mean(dim=0, keepdim=True)
            F_mean = torch.autograd.functional.jacobian(self.f, x_mean).squeeze(0)
            # Expand to batch
            F_batch = F_mean.unsqueeze(0).expand(batch_size, -1, -1)
            P_pred = F_batch @ P_prev @ F_batch.transpose(-2, -1) + self.Q.unsqueeze(0).expand(batch_size, -1, -1)

        return x_pred, P_pred

    def assimilate(self, x_prev: torch.Tensor, P_prev: torch.Tensor, observation: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Perform Kalman update step.

        Args:
            x_prev: Previous state (batch, state_dim)
            P_prev: Previous covariance (batch, state_dim, state_dim)
            observation: Observation (batch, obs_dim)

        Returns:
            x_new: Updated state
            P_new: Updated covariance
        """
        x_pred, P_pred = self.forward(x_prev, P_prev)

        # Linearize observation model
        # Approximate Jacobian for efficiency (compute for the mean)
        x_mean = x_pred.mean(dim=0, keepdim=True)
        H_mean = torch.autograd.functional.jacobian(self.h, x_mean).squeeze(0)
        batch_size = x_pred.shape[0]
        H_batch = H_mean.unsqueeze(0).expand(batch_size, -1, -1)

        # Innovation covariance
        S = H_batch @ P_pred @ H_batch.transpose(-2, -1) + self.R.unsqueeze(0).expand(batch_size, -1, -1)

        # Kalman gain
        K = P_pred @ H_batch.transpose(-2, -1) @ torch.linalg.inv(S)

        # Innovation
        y = observation - self.h(x_pred)

        # State update
        x_new = x_pred + (K @ y.unsqueeze(-1)).squeeze(-1)

        # Covariance update (Joseph form for numerical stability)
        I = torch.eye(self.state_dim, device=x_new.device).unsqueeze(0).expand(batch_size, -1, -1)
        P_new = (I - K @ H_batch) @ P_pred @ (I - K @ H_batch).transpose(-2, -1) + K @ self.R.unsqueeze(0) @ K.transpose(-2, -1)

        return x_new, P_new

    def assimilate_batch(self, x_prev: torch.Tensor, observation: torch.Tensor, P_prev: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Simplified assimilation without covariance (for fast inference).

        Args:
            x_prev: Previous state
            observation: Observation
            P_prev: Optional initial covariance (if None, assumes no prior)

        Returns:
            Updated state
        """
        if P_prev is None:
            # No covariance propagation – just use a learned correction gain
            x_pred = self.f(x_prev)
            # Learn a direct correction term
            correction = nn.Linear(self.state_dim + self.observation_dim, self.state_dim).to(x_prev.device)
            combined = torch.cat([x_pred, observation], dim=-1)
            delta = correction(combined)
            return x_pred + delta
        else:
            x_new, _ = self.assimilate(x_prev, P_prev, observation)
            return x_new


if __name__ == "__main__":
    dkf = DeepKalmanFilter(state_dim=5, observation_dim=3)
    x = torch.randn(10, 5)
    obs = torch.randn(10, 3)
    P = torch.eye(5).unsqueeze(0).expand(10, -1, -1)
    x_new, P_new = dkf.assimilate(x, P, obs)
    print(f"State shape: {x_new.shape}, Cov shape: {P_new.shape}")
