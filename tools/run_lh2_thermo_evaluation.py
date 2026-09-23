#!/usr/bin/env python3
"""Quantitative LH2 thermodynamic contract evaluation.

This is a reproducible lumped closed-tank diagnostic, not a CFD or certification
model. It uses CoolProp/ParaHydrogen for saturation properties and solves the
closed two-phase equilibrium at fixed tank volume, mass, and injected heat.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from scipy.optimize import brentq
from CoolProp.CoolProp import PropsSI

from lh2_thermo_contract import LH2ThermoContract

FLUID = "ParaHydrogen"


def sat(p: float, q: float) -> dict[str, float]:
    return {
        "T": float(PropsSI("T", "P", p, "Q", q, FLUID)),
        "rho": float(PropsSI("D", "P", p, "Q", q, FLUID)),
        "u": float(PropsSI("U", "P", p, "Q", q, FLUID)),
        "h": float(PropsSI("H", "P", p, "Q", q, FLUID)),
    }


def quality_from_volume(p: float, specific_volume: float) -> float:
    liquid, vapor = sat(p, 0.0), sat(p, 1.0)
    vl, vv = 1.0 / liquid["rho"], 1.0 / vapor["rho"]
    return (specific_volume - vl) / (vv - vl)


def state_at_energy(p: float, specific_volume: float, target_u: float) -> tuple[float, dict[str, float]]:
    x = quality_from_volume(p, specific_volume)
    liquid, vapor = sat(p, 0.0), sat(p, 1.0)
    u_mix = (1.0 - x) * liquid["u"] + x * vapor["u"]
    return u_mix - target_u, {
        "pressure_Pa": p,
        "temperature_K": liquid["T"],
        "quality_vapor": x,
        "liquid_mass_fraction": 1.0 - x,
        "u_J_kg": u_mix,
        "h_liquid_J_kg": liquid["h"],
        "h_vapor_J_kg": vapor["h"],
        "rho_liquid_kg_m3": liquid["rho"],
        "rho_vapor_kg_m3": vapor["rho"],
    }


def solve_equilibrium(volume_m3: float, mass_kg: float, total_energy_J: float, p_low: float, p_high: float) -> dict[str, float]:
    specific_volume = volume_m3 / mass_kg
    target_u = total_energy_J / mass_kg
    # The bracket is restricted to the declared two-phase LH2 pressure domain.
    def residual(p: float) -> float:
        value, _ = state_at_energy(p, specific_volume, target_u)
        return value
    pressures = [p_low + (p_high - p_low) * i / 200.0 for i in range(201)]
    candidates = []
    for a, b in zip(pressures, pressures[1:]):
        try:
            xa, xb = quality_from_volume(a, specific_volume), quality_from_volume(b, specific_volume)
            if 0.0 <= xa <= 1.0 and 0.0 <= xb <= 1.0 and residual(a) * residual(b) <= 0.0:
                candidates.append((a, b))
        except ValueError:
            continue
    if not candidates:
        raise RuntimeError("No two-phase equilibrium root in the declared pressure domain")
    root = brentq(residual, *candidates[0], xtol=1e-7, rtol=1e-12)
    _, state = state_at_energy(root, specific_volume, target_u)
    state["mass_kg"] = mass_kg
    state["liquid_mass_kg"] = mass_kg * (1.0 - state["quality_vapor"])
    state["vapor_mass_kg"] = mass_kg * state["quality_vapor"]
    state["specific_volume_m3_kg"] = specific_volume
    return state


def run() -> dict:
    contract = LH2ThermoContract()
    volume = 0.05
    fill_fraction = 0.80
    p0 = 101_325.0
    liquid0, vapor0 = sat(p0, 0.0), sat(p0, 1.0)
    liquid_volume, vapor_volume = volume * fill_fraction, volume * (1.0 - fill_fraction)
    mass = liquid_volume * liquid0["rho"] + vapor_volume * vapor0["rho"]
    energy0 = liquid_volume * liquid0["rho"] * liquid0["u"] + vapor_volume * vapor0["rho"] * vapor0["u"]
    heat_leak_w = 5.0
    times = [0.0, 60.0, 300.0, 600.0]
    states = []
    for time_s in times:
        state = solve_equilibrium(volume, mass, energy0 + heat_leak_w * time_s, 20_000.0, 1_500_000.0)
        state["time_s"] = time_s
        state["heat_input_J"] = heat_leak_w * time_s
        states.append(state)

    first, last = states[0], states[-1]
    mass_closure = last["liquid_mass_kg"] + last["vapor_mass_kg"] - mass
    energy_closure = mass * last["u_J_kg"] - (energy0 + last["heat_input_J"])
    contract_report = contract.contract_report(pressures=(p0, 200_000.0, 500_000.0))
    phase_status = all(item["roundTripTemperatureErrorK"] < 1e-7 and item["roundTripEnthalpyErrorJkg"] < 1e-6 for item in contract_report["states"])
    return {
        "contractVersion": "lh2-thermo-evaluation.v1",
        "fluid": FLUID,
        "scope": "closed rigid two-phase lumped diagnostic; not CFD, not certification",
        "initial": {"volume_m3": volume, "fillFractionLiquid": fill_fraction, "pressure_Pa": p0, "mass_kg": mass, "energy_J": energy0, "heatLeak_W": heat_leak_w},
        "states": states,
        "boilOff": {
            "definition": "liquid mass decrease with vapor mass increase in a closed tank",
            "liquidMassDecrease_kg": first["liquid_mass_kg"] - last["liquid_mass_kg"],
            "vaporMassIncrease_kg": last["vapor_mass_kg"] - first["vapor_mass_kg"],
            "massConservationError_kg": mass_closure,
        },
        "autoPressurization": {"pressureIncrease_Pa": last["pressure_Pa"] - first["pressure_Pa"], "temperatureIncrease_K": last["temperature_K"] - first["temperature_K"]},
        "phaseChange": {"qualityInitial": first["quality_vapor"], "qualityFinal": last["quality_vapor"], "twoPhaseAtAllStates": all(0.0 <= s["quality_vapor"] <= 1.0 for s in states)},
        "conservation": {"massError_kg": mass_closure, "energyError_J": energy_closure, "massPass": abs(mass_closure) < 1e-12, "energyPass": abs(energy_closure) < 1e-6},
        "T_ph_h_Tp": {"status": "PASS" if phase_status else "FAIL", "maxRoundTripTemperatureError_K": max(item["roundTripTemperatureErrorK"] for item in contract_report["states"]), "maxRoundTripEnthalpyError_J_kg": max(item["roundTripEnthalpyErrorJkg"] for item in contract_report["states"]), "contractReport": contract_report},
        "scientificStatus": "CODE_VERIFIED_DIAGNOSTIC_ONLY",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("artifacts/lh2_thermo_evaluation.json"))
    args = parser.parse_args()
    result = run()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in ("boilOff", "autoPressurization", "phaseChange", "conservation", "T_ph_h_Tp", "scientificStatus")}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
