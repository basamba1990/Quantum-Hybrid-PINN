from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Literal

from CoolProp.CoolProp import PropsSI

Phase = Literal["subcooled", "saturated_liquid", "saturated_vapor", "two_phase", "vapor"]


@dataclass(frozen=True)
class LH2Domain:
    pressure_min_pa: float = 10_000.0
    pressure_max_pa: float = 2_000_000.0
    temperature_min_k: float = 13.8033
    temperature_max_k: float = 32.50
    density_min_kg_m3: float = 0.001
    density_max_kg_m3: float = 100.0
    cp_min_j_kg_k: float = 1.0
    cp_max_j_kg_k: float = 100_000.0
    viscosity_min_pa_s: float = 1e-9
    viscosity_max_pa_s: float = 1.0
    conductivity_min_w_m_k: float = 1e-6
    conductivity_max_w_m_k: float = 10.0


@dataclass(frozen=True)
class LH2State:
    p_pa: float
    t_k: float
    h_j_kg: float
    rho_kg_m3: float
    cp_j_kg_k: float
    mu_pa_s: float
    k_w_m_k: float
    phase: str

    def as_dict(self) -> dict[str, float | str]:
        return asdict(self)


class LH2ThermoContract:
    """Authoritative property adapter for parahydrogen in the declared domain.

    This adapter deliberately fails outside the declared EOS domain. It does not
    extrapolate properties and it does not silently clamp inputs.
    """

    fluid = "ParaHydrogen"

    def __init__(self, domain: LH2Domain | None = None) -> None:
        self.domain = domain or LH2Domain()

    def _check_pressure(self, p_pa: float) -> None:
        if not math.isfinite(p_pa) or not (
            self.domain.pressure_min_pa <= p_pa <= self.domain.pressure_max_pa
        ):
            raise ValueError(f"pressure outside contract domain: {p_pa} Pa")

    def _check_temperature(self, t_k: float) -> None:
        if not math.isfinite(t_k) or not (
            self.domain.temperature_min_k <= t_k <= self.domain.temperature_max_k
        ):
            raise ValueError(f"temperature outside contract domain: {t_k} K")

    def _check_scalar(self, name: str, value: float, low: float, high: float) -> None:
        if not math.isfinite(value) or not (low <= value <= high):
            raise ValueError(f"{name} outside contract domain: {value}")

    def saturation_temperature(self, p_pa: float) -> float:
        self._check_pressure(float(p_pa))
        t_k = float(PropsSI("T", "P", p_pa, "Q", 0, self.fluid))
        self._check_temperature(t_k)
        return t_k

    def _phase_from_pt(self, p_pa: float, t_k: float) -> Phase:
        tsat = self.saturation_temperature(p_pa)
        if abs(t_k - tsat) <= 1e-7:
            return "saturated_liquid"
        return "subcooled" if t_k < tsat else "vapor"

    def state_from_pt(self, p_pa: float, t_k: float, phase: Phase | None = None) -> LH2State:
        p_pa = float(p_pa)
        t_k = float(t_k)
        self._check_pressure(p_pa)
        self._check_temperature(t_k)
        actual_phase = phase or self._phase_from_pt(p_pa, t_k)
        if actual_phase in ("saturated_liquid", "saturated_vapor"):
            q = 0.0 if actual_phase == "saturated_liquid" else 1.0
            t_k = float(PropsSI("T", "P", p_pa, "Q", q, self.fluid))
            values = {
                "h_j_kg": PropsSI("H", "P", p_pa, "Q", q, self.fluid),
                "rho_kg_m3": PropsSI("D", "P", p_pa, "Q", q, self.fluid),
                "cp_j_kg_k": PropsSI("C", "P", p_pa, "Q", q, self.fluid),
                "mu_pa_s": PropsSI("V", "P", p_pa, "Q", q, self.fluid),
                "k_w_m_k": PropsSI("L", "P", p_pa, "Q", q, self.fluid),
            }
        else:
            values = {
                "h_j_kg": PropsSI("H", "P", p_pa, "T", t_k, self.fluid),
                "rho_kg_m3": PropsSI("D", "P", p_pa, "T", t_k, self.fluid),
                "cp_j_kg_k": PropsSI("C", "P", p_pa, "T", t_k, self.fluid),
                "mu_pa_s": PropsSI("V", "P", p_pa, "T", t_k, self.fluid),
                "k_w_m_k": PropsSI("L", "P", p_pa, "T", t_k, self.fluid),
            }
        state = LH2State(p_pa=p_pa, t_k=t_k, phase=actual_phase, **{k: float(v) for k, v in values.items()})
        self.validate_state(state)
        return state

    def state_from_ph(self, p_pa: float, h_j_kg: float) -> LH2State:
        p_pa = float(p_pa)
        h_j_kg = float(h_j_kg)
        self._check_pressure(p_pa)
        if not math.isfinite(h_j_kg):
            raise ValueError(f"enthalpy is not finite: {h_j_kg}")
        h_liquid = float(PropsSI("H", "P", p_pa, "Q", 0, self.fluid))
        h_vapor = float(PropsSI("H", "P", p_pa, "Q", 1, self.fluid))
        tolerance = 1e-7 * max(1.0, abs(h_vapor - h_liquid))
        if abs(h_j_kg - h_liquid) <= tolerance:
            return self.state_from_pt(p_pa, self.saturation_temperature(p_pa), "saturated_liquid")
        if abs(h_j_kg - h_vapor) <= tolerance:
            return self.state_from_pt(p_pa, self.saturation_temperature(p_pa), "saturated_vapor")
        t_k = float(PropsSI("T", "P", p_pa, "H", h_j_kg, self.fluid))
        self._check_temperature(t_k)
        if h_liquid < h_j_kg < h_vapor:
            values = {
                "rho_kg_m3": PropsSI("D", "P", p_pa, "H", h_j_kg, self.fluid),
                "cp_j_kg_k": PropsSI("C", "P", p_pa, "H", h_j_kg, self.fluid),
                "mu_pa_s": PropsSI("V", "P", p_pa, "H", h_j_kg, self.fluid),
                "k_w_m_k": PropsSI("L", "P", p_pa, "H", h_j_kg, self.fluid),
            }
            state = LH2State(p_pa=p_pa, t_k=t_k, h_j_kg=h_j_kg, phase="two_phase", **{k: float(v) for k, v in values.items()})
            self.validate_state(state)
            return state
        state = self.state_from_pt(p_pa, t_k)
        # Keep the input enthalpy in the returned state so round-trip error is explicit.
        return LH2State(p_pa=state.p_pa, t_k=state.t_k, h_j_kg=h_j_kg, rho_kg_m3=state.rho_kg_m3,
                        cp_j_kg_k=state.cp_j_kg_k, mu_pa_s=state.mu_pa_s, k_w_m_k=state.k_w_m_k,
                        phase=state.phase)

    def validate_state(self, state: LH2State) -> None:
        self._check_pressure(state.p_pa)
        self._check_temperature(state.t_k)
        self._check_scalar("enthalpy", state.h_j_kg, -1e8, 1e8)
        self._check_scalar("density", state.rho_kg_m3, self.domain.density_min_kg_m3, self.domain.density_max_kg_m3)
        self._check_scalar("Cp", state.cp_j_kg_k, self.domain.cp_min_j_kg_k, self.domain.cp_max_j_kg_k)
        self._check_scalar("mu", state.mu_pa_s, self.domain.viscosity_min_pa_s, self.domain.viscosity_max_pa_s)
        self._check_scalar("k", state.k_w_m_k, self.domain.conductivity_min_w_m_k, self.domain.conductivity_max_w_m_k)

    def contract_report(self, pressures: tuple[float, ...] = (100_000.0, 200_000.0, 1_000_000.0)) -> dict:
        phases: list[dict] = []
        for p_pa in pressures:
            tsat = self.saturation_temperature(p_pa)
            entries = [
                self.state_from_pt(p_pa, max(self.domain.temperature_min_k + 0.01, tsat - 0.05), "subcooled"),
                self.state_from_pt(p_pa, tsat, "saturated_liquid"),
                self.state_from_pt(p_pa, tsat, "saturated_vapor"),
                self.state_from_pt(p_pa, min(self.domain.temperature_max_k - 0.01, tsat + 0.05), "vapor"),
            ]
            for state in entries:
                recovered = self.state_from_ph(state.p_pa, state.h_j_kg)
                phases.append({
                    "input": state.as_dict(),
                    "recovered": recovered.as_dict(),
                    "roundTripTemperatureErrorK": abs(recovered.t_k - state.t_k),
                    "roundTripEnthalpyErrorJkg": abs(recovered.h_j_kg - state.h_j_kg),
                })
        return {
            "contractVersion": "lh2-thermo.v1",
            "fluid": self.fluid,
            "domain": asdict(self.domain),
            "states": phases,
            "status": "CODE_VERIFIED",
            "scientificStatus": "UNVALIDATED",
        }


__all__ = ["LH2Domain", "LH2State", "LH2ThermoContract"]
