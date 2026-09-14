import torch
from phase_thermo import PhaseThermoConfig
from pinn_3d_navier_stokes import PINN3DNavierStokes

cfg = PhaseThermoConfig.from_contract({
    "saturation_temperature_k": 20.3,
    "latent_heat_j_kg": 446000.0,
    "cp_liquid_j_kg_k": 9700.0,
    "cp_vapor_j_kg_k": 14300.0,
    "reference_temperature_k": 20.3,
    "reference_enthalpy_j_kg": 0.0,
})
model = PINN3DNavierStokes(phase_thermo=cfg)
t = torch.rand(4, 1, requires_grad=True)
x = torch.rand(4, 1, requires_grad=True)
y = torch.rand(4, 1, requires_grad=True)
z = torch.rand(4, 1, requires_grad=True)
outputs = model(t, x, y, z)
assert len(outputs) == 7
assert outputs[5].shape == outputs[6].shape
residuals = model.compute_residuals(t, x, y, z, *outputs)
assert len(residuals) == 7
print("native_v8_smoke_ok", [tuple(value.shape) for value in outputs], len(residuals))
