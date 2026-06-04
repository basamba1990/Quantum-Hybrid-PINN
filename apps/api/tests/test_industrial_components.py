import torch
import numpy as np
import pytest
import sys
import os

# Ajout du chemin pour importer les modules de l'API
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deep_kalman_filter import DeepKalmanFilter
from hydrogen_pinn_v8 import MahalanobisOODDetector, HydrogenPINNV8
from quantum_eos_torch import SilveraGoldmanEOS

def test_deep_kalman_filter_shapes():
    state_dim = 5
    obs_dim = 3
    batch_size = 4
    dkf = DeepKalmanFilter(state_dim=state_dim, observation_dim=obs_dim)
    
    x_prev = torch.randn(batch_size, state_dim)
    P_prev = torch.eye(state_dim).unsqueeze(0).expand(batch_size, -1, -1)
    obs = torch.randn(batch_size, obs_dim)
    
    # Test prediction step
    x_pred, P_pred = dkf.forward(x_prev, P_prev)
    assert x_pred.shape == (batch_size, state_dim)
    assert P_pred.shape == (batch_size, state_dim, state_dim)
    
    # Test assimilation step
    x_new, P_new = dkf.assimilate(x_prev, P_prev, obs)
    assert x_new.shape == (batch_size, state_dim)
    assert P_new.shape == (batch_size, state_dim, state_dim)

def test_mahalanobis_ood_detector():
    detector = MahalanobisOODDetector(threshold_percentile=95.0)
    
    # Create synthetic "in-distribution" data
    np.random.seed(42)
    train_data = np.random.normal(0, 1, (100, 10))
    detector.fit(train_data)
    
    assert detector.fitted
    assert detector.mean.shape == (10,)
    assert detector.cov_inv.shape == (10, 10)
    
    # Test in-distribution point
    test_in = np.random.normal(0, 1, (10,))
    is_ood_in, dist_in = detector.is_out_of_distribution(test_in)
    
    # Test out-of-distribution point
    test_out = np.random.normal(5, 1, (10,))
    is_ood_out, dist_out = detector.is_out_of_distribution(test_out)
    
    assert dist_out > dist_in
    # Note: statistically, test_in could be OOD if it's in the 5% tail, 
    # but test_out (5 sigma away) should definitely be OOD.
    assert is_ood_out == True

def test_quantum_eos_silvera_goldman():
    device = torch.device("cpu")
    eos = SilveraGoldmanEOS(device=device)
    
    # Densité typique pour H2 liquide (en mol/m3 ou kg/m3 selon l'implémentation)
    # Dans quantum_eos_torch, rho est souvent traité comme une variable d'état
    rho = torch.tensor([35.0, 40.0], device=device) # mol/L approx
    T = torch.tensor([20.0, 30.0], device=device)   # K
    
    pressure = eos(rho, T)
    assert pressure.shape == (2,)
    assert torch.all(pressure > 0)

def test_hydrogen_pinn_v8_residuals():
    # Test simplifié des résidus thermodynamiques
    model = HydrogenPINNV8(fluid_type='H2')
    
    batch_size = 5
    pressure = torch.linspace(1e5, 1e7, batch_size) # 1 bar to 100 bar
    temperature = torch.linspace(20, 300, batch_size)
    
    residuals = model.thermodynamic_residuals(pressure, temperature, isentropic_efficiency=0.85)
    assert residuals.shape == (batch_size,)
    assert torch.all(torch.isfinite(residuals))

if __name__ == "__main__":
    pytest.main([__file__])
