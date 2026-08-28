import sys
from pathlib import Path

import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).parents[1]))

from h2_sciml_engine import SciMLEngine, TransientPINNLoss


class DeterministicPolynomialModel(nn.Module):
    def forward(self, coordinates):
        t, x, y, z = coordinates.split(1, dim=-1)
        rho = 2.0 + t + x + y + z
        u = 1.0 + t * x + y
        v = 0.5 + t * y + z
        w = -0.25 + t * z + x
        p = 10.0 + x.square() + y + z
        temperature = 20.0 + t.square() + x + y.square() + z
        return torch.cat((rho, u, v, w, p, temperature), dim=-1)


def test_pointwise_terms_exposes_complete_derivative_contract():
    model = DeterministicPolynomialModel()
    loss = TransientPINNLoss(mu=1.0, k_thermal=1.0, cp=1.0)
    values = torch.tensor([[0.1, 0.2, 0.3, 0.4], [0.2, 0.3, 0.4, 0.5]])
    terms = loss.pointwise_terms(model, *(values[:, i:i + 1] for i in range(4)))

    expected = {"rho", "u", "v", "w", "p", "T", "mass", "momentum_x", "momentum_y", "momentum_z", "momentum", "energy"}
    expected |= {f"d{name}_d{axis}" for name in ("rho", "u", "v", "w", "p", "T") for axis in ("t", "x", "y", "z")}
    expected |= {"d2u_dx2", "d2T_dx2"}
    assert expected <= terms.keys()
    assert all(torch.isfinite(terms[name]).all() for name in expected)


def test_residual_calculation_falls_back_without_transient_fortran_bridge():
    engine = SciMLEngine.__new__(SciMLEngine)
    engine.fortran_bridge = None
    values = torch.tensor([[0.1, 0.2, 0.3, 0.4], [0.2, 0.3, 0.4, 0.5]])
    result = engine.calculate_transient_residuals(DeterministicPolynomialModel(), *(values[:, i:i + 1] for i in range(4)))

    assert result["method"] == "autograd_only_fortran_transient_bridge_unavailable"
    assert set(result["residuals"]) == {"mass", "momentum", "energy"}
    assert all(torch.isfinite(torch.tensor(value)) for value in result["residuals"].values())


def test_main_industrial_path_has_no_random_or_fixed_residual_score():
    source = (Path(__file__).parents[1] / "main.py").read_text()
    assert "np.random" not in source
    assert '"credibility_score": 95.0' not in source
    assert '"continuityResidual": clean_float' not in source
    assert '"momentumResidual": clean_float' not in source
    assert '"energyResidual": clean_float' not in source
    assert '"viscosityField": clean_json([p["temperature"]' not in source
