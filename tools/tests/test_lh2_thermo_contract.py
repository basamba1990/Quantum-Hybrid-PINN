from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[2] / "apps" / "api"))
from lh2_thermo_contract import LH2ThermoContract  # noqa: E402


@pytest.fixture(scope="module")
def thermo() -> LH2ThermoContract:
    return LH2ThermoContract()


def test_contract_covers_subcooled_saturated_and_vapor(thermo: LH2ThermoContract):
    for pressure in (100_000.0, 200_000.0, 1_000_000.0):
        tsat = thermo.saturation_temperature(pressure)
        states = [
            thermo.state_from_pt(pressure, tsat - 0.05, "subcooled"),
            thermo.state_from_pt(pressure, tsat, "saturated_liquid"),
            thermo.state_from_pt(pressure, tsat, "saturated_vapor"),
            thermo.state_from_pt(pressure, tsat + 0.05, "vapor"),
        ]
        assert [s.phase for s in states] == [
            "subcooled", "saturated_liquid", "saturated_vapor", "vapor"
        ]
        for state in states:
            thermo.validate_state(state)
            assert all(math.isfinite(value) for value in (
                state.t_k, state.h_j_kg, state.rho_kg_m3,
                state.cp_j_kg_k, state.mu_pa_s, state.k_w_m_k,
            ))


def test_ph_round_trip(thermo: LH2ThermoContract):
    for pressure in (100_000.0, 200_000.0, 1_000_000.0):
        tsat = thermo.saturation_temperature(pressure)
        for temperature in (tsat - 0.05, tsat + 0.05):
            original = thermo.state_from_pt(pressure, temperature)
            recovered = thermo.state_from_ph(pressure, original.h_j_kg)
            assert abs(recovered.t_k - original.t_k) < 1e-7
            assert abs(recovered.h_j_kg - original.h_j_kg) < 1e-7


def test_ph_round_trip_preserves_saturated_vapor_and_two_phase(thermo: LH2ThermoContract):
    pressure = 200_000.0
    tsat = thermo.saturation_temperature(pressure)
    saturated_vapor = thermo.state_from_pt(pressure, tsat, "saturated_vapor")
    recovered_vapor = thermo.state_from_ph(pressure, saturated_vapor.h_j_kg)
    assert recovered_vapor.phase == "saturated_vapor"
    assert abs(recovered_vapor.t_k - tsat) < 1e-7

    liquid = thermo.state_from_pt(pressure, tsat, "saturated_liquid")
    mixture_h = (liquid.h_j_kg + saturated_vapor.h_j_kg) / 2.0
    mixture = thermo.state_from_ph(pressure, mixture_h)
    assert mixture.phase == "two_phase"
    assert abs(mixture.t_k - tsat) < 1e-7


def test_saturation_temperature_monotone(thermo: LH2ThermoContract):
    pressures = (100_000.0, 200_000.0, 500_000.0, 1_000_000.0)
    temperatures = [thermo.saturation_temperature(p) for p in pressures]
    assert all(a < b for a, b in zip(temperatures, temperatures[1:]))


def test_domain_rejects_extrapolation(thermo: LH2ThermoContract):
    with pytest.raises(ValueError):
        thermo.state_from_pt(1.0, 20.0)
    with pytest.raises(ValueError):
        thermo.state_from_pt(100_000.0, 10.0)
    with pytest.raises(ValueError):
        thermo.state_from_ph(100_000.0, float("nan"))
