from __future__ import annotations

from dataclasses import dataclass
import torch


@dataclass(frozen=True)
class PhaseThermoConfig:
    saturation_temperature_k: float
    latent_heat_j_kg: float
    cp_liquid_j_kg_k: float
    cp_vapor_j_kg_k: float
    reference_temperature_k: float
    reference_enthalpy_j_kg: float

    @classmethod
    def from_contract(cls, data: dict) -> "PhaseThermoConfig":
        required = {
            "saturation_temperature_k",
            "latent_heat_j_kg",
            "cp_liquid_j_kg_k",
            "cp_vapor_j_kg_k",
            "reference_temperature_k",
            "reference_enthalpy_j_kg",
        }
        missing = sorted(required - set(data))
        if missing:
            raise ValueError(f"phase thermo contract missing: {', '.join(missing)}")
        config = cls(**{key: float(data[key]) for key in required})
        if config.latent_heat_j_kg <= 0 or config.cp_liquid_j_kg_k <= 0 or config.cp_vapor_j_kg_k <= 0:
            raise ValueError("phase thermodynamic coefficients must be positive")
        return config

    def mixture_enthalpy(self, temperature: torch.Tensor, alpha_liquid: torch.Tensor) -> torch.Tensor:
        cp_mix = alpha_liquid * self.cp_liquid_j_kg_k + (1.0 - alpha_liquid) * self.cp_vapor_j_kg_k
        return (
            self.reference_enthalpy_j_kg
            + cp_mix * (temperature - self.reference_temperature_k)
            + alpha_liquid * self.latent_heat_j_kg
        )

    def phase_equilibrium_alpha(self, temperature: torch.Tensor, transition_width_k: float = 0.25) -> torch.Tensor:
        width = max(float(transition_width_k), 1e-6)
        return torch.sigmoid((self.saturation_temperature_k - temperature) / width)
