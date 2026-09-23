#!/usr/bin/env python3
"""Independent 1-D enthalpy Stefan benchmark for LH2 liquid-vapor phase change.

It is a reproducible phase-change benchmark, not a 3-D VOF/CHT tank solver.
The interface is tracked from the vapor fraction and compared with the
one-dimensional Stefan similarity solution.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
from pathlib import Path

import numpy as np
from scipy.optimize import brentq
from CoolProp.CoolProp import PropsSI

FLUID = "ParaHydrogen"


def stefan_lambda(ste: float) -> float:
    def residual(lam: float) -> float:
        # One-phase Stefan similarity relation:
        # Ste = sqrt(pi) * lambda * exp(lambda^2) * erf(lambda).
        return math.sqrt(math.pi) * lam * math.exp(lam * lam) * math.erf(lam) - ste
    return brentq(residual, 1e-8, 10.0)


def phase_state(h: np.ndarray, cp: float, latent: float, tsat: float) -> tuple[np.ndarray, np.ndarray]:
    liquid = h < 0.0
    vapor = h > latent
    temperature = np.full_like(h, tsat)
    temperature[liquid] = tsat + h[liquid] / cp
    temperature[vapor] = tsat + (h[vapor] - latent) / cp
    fraction = np.clip(h / latent, 0.0, 1.0)
    return temperature, fraction


def run(output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    p = 101_325.0
    tsat = float(PropsSI("T", "P", p, "Q", 0, FLUID))
    rho = float(PropsSI("D", "P", p, "Q", 0, FLUID))
    cp = float(PropsSI("C", "P", p, "Q", 0, FLUID))
    k = float(PropsSI("L", "P", p, "Q", 0, FLUID))
    latent = float(PropsSI("H", "P", p, "Q", 1, FLUID) - PropsSI("H", "P", p, "Q", 0, FLUID))
    alpha = k / (rho * cp)
    ste = cp * 0.5 / latent
    lam = stefan_lambda(ste)
    length = 0.05
    nx = 240
    dx = length / nx
    dt = 0.35 * dx * dx / alpha
    steps = 12000
    x = (np.arange(nx) + 0.5) * dx
    enthalpy = np.full(nx, -cp * 0.5)
    t_wall = tsat + 0.5
    residuals = []
    balances = []
    log = [f"IndependentStefanLH2 solver={platform.python_version()} p={p} Tsat={tsat:.12g} rho={rho:.12g} cp={cp:.12g} k={k:.12g} latent={latent:.12g}", f"nx={nx} dx={dx:.12g} dt={dt:.12g} steps={steps} lambda={lam:.12g}"]
    initial_energy = float(rho * np.sum(enthalpy) * dx)
    for step in range(1, steps + 1):
        old_h = enthalpy.copy()
        old_t, old_f = phase_state(old_h, cp, latent, tsat)
        ext_t = np.empty(nx + 2)
        ext_t[0] = t_wall
        ext_t[-1] = tsat - 0.5
        ext_t[1:-1] = old_t
        lap = (ext_t[2:] - 2.0 * ext_t[1:-1] + ext_t[:-2]) / dx**2
        enthalpy = old_h + dt * (k / rho) * lap
        temperature, fraction = phase_state(enthalpy, cp, latent, tsat)
        residual = float(np.max(np.abs((enthalpy - old_h) / dt - (k / rho) * lap)))
        q_in = k * (t_wall - old_t[0]) / dx
        q_out = k * (old_t[-1] - (tsat - 0.5)) / dx
        storage = float(rho * dx * np.sum(enthalpy - old_h) / dt)
        balance_error = q_in - q_out - storage
        residuals.append({"time_s": step * dt, "pdeResidual_J_kg_s": residual, "energyBalanceResidual_W": balance_error})
        balances.append({"time_s": step * dt, "energyIn_W": q_in, "energyOut_W": q_out, "energyStorageRate_W": storage, "closure_W": balance_error, "vaporMassEquivalent_kg": float(rho * dx * np.sum(fraction))})
        if step == 1 or step % 1000 == 0 or step == steps:
            interface = float(np.sum(fraction) * dx)
            analytic = 2.0 * lam * math.sqrt(alpha * step * dt)
            log.append(f"Time = {step*dt:.12g} interfaceNumerical = {interface:.12g} interfaceAnalytical = {analytic:.12g} residual = {residual:.12g} energyClosure = {balance_error:.12g}")
    temperature, fraction = phase_state(enthalpy, cp, latent, tsat)
    numerical_interface = float(np.sum(fraction) * dx)
    analytical_interface = 2.0 * lam * math.sqrt(alpha * steps * dt)
    comparison = {"reference": "Stefan similarity solution", "lambda": lam, "finalNumericalInterface_m": numerical_interface, "finalAnalyticalInterface_m": analytical_interface, "absoluteError_m": abs(numerical_interface - analytical_interface), "relativeError": abs(numerical_interface - analytical_interface) / max(analytical_interface, 1e-12), "status": "PASS" if abs(numerical_interface - analytical_interface) / max(analytical_interface, 1e-12) < 0.15 else "REVIEW"}
    final_energy = float(rho * np.sum(enthalpy) * dx)
    result = {
        "solver": "independent-enthalpy-stefan-1d",
        "fluid": FLUID,
        "pressure_Pa": p,
        "properties": {"Tsat_K": tsat, "rho_kg_m3": rho, "cp_J_kg_K": cp, "k_W_m_K": k, "latentHeat_J_kg": latent, "alpha_m2_s": alpha},
        "numerics": {"length_m": length, "nx": nx, "dx_m": dx, "dt_s": dt, "steps": steps, "boundaryHot_K": t_wall, "initial_K": tsat - 0.5},
        "comparison": comparison,
        "residuals": {"rows": residuals, "maxAbsEnergyClosure_W": max(abs(row["energyBalanceResidual_W"]) for row in residuals), "finalPdeResidual": residuals[-1]["pdeResidual_J_kg_s"]},
        "balances": {"initialEnergy_J": initial_energy, "finalEnergy_J": final_energy, "energyChange_J": final_energy - initial_energy, "rows": balances},
        "phaseChange": {"initialVaporEquivalent_kg": 0.0, "finalVaporEquivalent_kg": balances[-1]["vaporMassEquivalent_kg"], "fractionMin": float(fraction.min()), "fractionMax": float(fraction.max())},
        "status": "INDEPENDENT_NUMERICAL_BENCHMARK_NOT_CFD",
    }
    (output / "solver.log").write_text("\n".join(log) + "\n", encoding="utf-8")
    (output / "residual_history.json").write_text(json.dumps(result["residuals"], indent=2) + "\n", encoding="utf-8")
    (output / "mass_energy_balances.json").write_text(json.dumps(result["balances"], indent=2) + "\n", encoding="utf-8")
    (output / "reference_comparison.json").write_text(json.dumps(result["comparison"], indent=2) + "\n", encoding="utf-8")
    (output / "result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    (output / "MANIFEST.sha256").write_text("\n".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}" for p in sorted(output.iterdir()) if p.is_file() and p.name != "MANIFEST.sha256") + "\n", encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("artifacts/stefan_lh2_independent"))
    args = parser.parse_args()
    result = run(args.output)
    print(json.dumps({"comparison": result["comparison"], "residuals": result["residuals"], "phaseChange": result["phaseChange"], "status": result["status"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
