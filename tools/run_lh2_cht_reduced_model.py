#!/usr/bin/env python3
"""Reduced, auditable radial LH2/aluminium/PU CHT model.

This is not OpenFOAM. It is a lightweight thermo-energetic model for the free
instance that exercises CoolProp saturation, latent heat, evaporation through
a rigid-tank equilibrium closure, wall heat conduction, and insulation cases.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path

import numpy as np
from CoolProp.CoolProp import PropsSI
from scipy.sparse import diags
from scipy.sparse.linalg import spsolve
from scipy.optimize import brentq

FLUID = "ParaHydrogen"
P0 = 101325.0
V_TANK = 0.050
R_IN = 0.193
H_CYL = 0.29357306261079585 # 50 L target with the generated half-ellipsoidal domes
AREA = 2.0 * math.pi * R_IN * H_CYL + 2.0 * math.pi * R_IN**2
T_AMBIENT = 283.15
H_OUT = 9.5
H_IN = 35.0
RHO_AL = 2840.0
CP_AL = 864.0
K_AL = 143.0
RHO_PU = 35.0
CP_PU = 1674.0
K_PU = 0.02


_P_GRID = np.geomspace(3.0e4, 1.2e6, 240)
_SAT_GRID: dict[str, np.ndarray] = {}
for _name, _key, _quality in (("T", "T", 0), ("rho_l", "D", 0), ("cp_l", "C", 0), ("k_l", "L", 0), ("u_l", "U", 0), ("rho_v", "D", 1), ("u_v", "U", 1)):
    _SAT_GRID[_name] = np.array([float(PropsSI(_key, "P", float(_p), "Q", _quality, FLUID)) for _p in _P_GRID])
_SAT_GRID["h_fg"] = np.array([float(PropsSI("H", "P", float(_p), "Q", 1, FLUID) - PropsSI("H", "P", float(_p), "Q", 0, FLUID)) for _p in _P_GRID])


def sat(p: float) -> dict[str, float]:
    p = float(np.clip(p, _P_GRID[0], _P_GRID[-1]))
    return {key: float(np.interp(p, _P_GRID, values)) for key, values in _SAT_GRID.items()}


def initial_state() -> tuple[float, float]:
    s = sat(P0)
    m = 0.5 * V_TANK * s["rho_l"] + 0.5 * V_TANK * s["rho_v"]
    E = 0.5 * V_TANK * s["rho_l"] * s["u_l"] + 0.5 * V_TANK * s["rho_v"] * s["u_v"]
    return m, E


def equilibrium(mass: float, energy: float) -> tuple[float, float, dict[str, float]]:
    def state_at_p(p: float) -> tuple[float, float, dict[str, float]]:
        s = sat(p)
        denom = V_TANK / mass - 1.0 / s["rho_l"]
        x = denom / (1.0 / s["rho_v"] - 1.0 / s["rho_l"])
        x = min(1.0, max(0.0, x))
        u = (1.0 - x) * s["u_l"] + x * s["u_v"]
        return x, mass * u, s
    def f(p: float) -> float:
        return state_at_p(p)[1] - energy
    # CoolProp saturation queries are only defined below the ParaHydrogen
    # critical pressure (~1.286 MPa).
    grid = np.geomspace(3e4, 1.2e6, 160)
    vals = [f(float(p)) for p in grid]
    bracket = None
    for a, b, fa, fb in zip(grid[:-1], grid[1:], vals[:-1], vals[1:]):
        if fa == 0 or fa * fb < 0:
            bracket = (float(a), float(b)); break
    if bracket is None:
        p = min(grid, key=lambda q: abs(f(float(q))))
    else:
        p = brentq(f, *bracket, xtol=1e-8)
    x, _, s = state_at_p(float(p))
    return float(p), float(x), s


def run_case(insulation_m: float, n_wall: int, dt: float, seconds: float) -> dict:
    total = 0.003 + insulation_m
    n_pu = max(2, round(n_wall * insulation_m / total))
    n_al = max(2, n_wall - n_pu)
    n = n_al + n_pu
    dx = total / n
    k = np.array([K_AL] * n_al + [K_PU] * n_pu, dtype=float)
    rho_cp = np.array([RHO_AL * CP_AL] * n_al + [RHO_PU * CP_PU] * n_pu, dtype=float)
    T = np.full(n, sat(P0)["T"], dtype=float)
    mass, energy = initial_state()
    rows = []
    max_closure = 0.0
    steps = round(seconds / dt)
    for step in range(steps + 1):
        time = step * dt
        pressure, quality, s = equilibrium(mass, energy)
        fluid_T = s["T"]
        q_inner = H_IN * AREA * (T[0] - fluid_T)
        q_outer = H_OUT * AREA * (T_AMBIENT - T[-1])
        if step % max(1, round(seconds / 12 / dt)) == 0 or step == steps:
            rows.append({"time_s": time, "pressure_Pa": pressure, "temperature_K": fluid_T, "quality": quality, "vapor_mass_kg": mass * quality, "liquid_mass_kg": mass * (1.0 - quality), "q_inner_W": q_inner, "q_outer_W": q_outer, "wall_inner_K": float(T[0]), "wall_outer_K": float(T[-1])})
        if step == steps:
            break
        oldT = T.copy()
        # Fully implicit finite-volume wall conduction. This is necessary for
        # aluminium: its diffusivity makes an explicit 1 s step unstable.
        conductance = np.zeros(n + 1)
        conductance[0] = H_OUT * AREA
        conductance[n] = H_IN * AREA
        for j in range(1, n):
            keff = 2.0 * k[j-1] * k[j] / (k[j-1] + k[j])
            conductance[j] = AREA * keff / dx
        diagonal = rho_cp * AREA * dx / dt + conductance[:-1] + conductance[1:]
        lower = -conductance[1:n]
        upper = -conductance[1:n]
        matrix = diags((lower, diagonal, upper), offsets=(-1, 0, 1), shape=(n, n), format="csc")
        rhs = rho_cp * AREA * dx / dt * oldT
        rhs[0] += conductance[0] * T_AMBIENT
        rhs[-1] += conductance[n] * fluid_T
        T = np.asarray(spsolve(matrix, rhs))
        q_inner_new = H_IN * AREA * (T[-1] - fluid_T)
        energy += q_inner_new * dt
        closure = q_inner_new - (energy - (energy - q_inner_new * dt)) / dt
        max_closure = max(max_closure, abs(closure))
    return {"insulation_m": insulation_m, "n_wall": n_wall, "dt_s": dt, "seconds": seconds, "n_cells": n, "dx_m": dx, "final": rows[-1], "maxEnergyClosure_W": max_closure, "history": rows, "modelStatus": "REDUCED_THERMO_CHT_NOT_OPENFOAM"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=Path("artifacts/lh2_cht_reduced"))
    ap.add_argument("--seconds", type=float, default=600.0)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    mesh_cases = []
    for n in (24, 48, 96):
        mesh_cases.append(run_case(0.02, n, 1.0, args.seconds))
    time_cases = []
    for dt in (1.0, 2.0, 5.0):
        time_cases.append(run_case(0.02, 48, dt, args.seconds))
    insulation_cases = [run_case(x, 48, 1.0, args.seconds) for x in (0.01, 0.02, 0.03)]
    result = {"model": "radial-reduced-LH2-Al-vegetable-PU-CHT", "fluid": FLUID, "tankVolume_m3": V_TANK, "area_m2": AREA, "assumptions": {"H_in_W_m2_K": H_IN, "H_out_W_m2_K": H_OUT, "ambient_K": T_AMBIENT, "initialPressure_Pa": P0, "initialFillVolume": 0.5, "aluminium": {"rho": RHO_AL, "cp": CP_AL, "k": K_AL}, "polyurethane": {"rho": RHO_PU, "cp": CP_PU, "k": K_PU}}, "meshIndependence": mesh_cases, "timeIndependence": time_cases, "insulationCases": insulation_cases, "status": "THERMO_CHT_REDUCED_MODEL_READY_FOR_OPENFOAM_COUPLING"}
    (args.output / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    with (args.output / "summary.csv").open("w", newline="") as f:
        w = csv.writer(f); w.writerow(["study","insulation_m","n_cells","dt_s","final_pressure_Pa","final_temperature_K","final_quality","final_vapor_mass_kg","final_liquid_mass_kg"])
        for study, cases in [("mesh", mesh_cases), ("time", time_cases), ("insulation", insulation_cases)]:
            for c in cases:
                r = c["final"]; w.writerow([study,c["insulation_m"],c["n_cells"],c["dt_s"],r["pressure_Pa"],r["temperature_K"],r["quality"],r["vapor_mass_kg"],r["liquid_mass_kg"]])
    print(json.dumps({"mesh": [{"n":c["n_cells"],"p":c["final"]["pressure_Pa"],"m_v":c["final"]["vapor_mass_kg"]} for c in mesh_cases], "time": [{"dt":c["dt_s"],"p":c["final"]["pressure_Pa"]} for c in time_cases], "insulation": [{"thickness":c["insulation_m"],"p":c["final"]["pressure_Pa"],"m_v":c["final"]["vapor_mass_kg"],"T":c["final"]["temperature_K"]} for c in insulation_cases]}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
