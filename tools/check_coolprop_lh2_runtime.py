#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from pathlib import Path

from CoolProp.CoolProp import PropsSI

FLUID = "ParaHydrogen"
P_MIN = 10_000.0
P_MAX = 2_000_000.0
T_MIN = 13.8033
T_MAX = 32.50
# Les températures d’essai doivent rester au-dessus de la courbe de fusion
# pour toutes les pressions testées; 20 K est utilisé comme borne d’essai.
T_TEST_MIN = 20.0


def finite_value(name: str, value: float) -> float:
    if not math.isfinite(value):
        raise ValueError(f"{name} non fini: {value}")
    return value


def finite_positive(name: str, value: float) -> float:
    if not math.isfinite(value) or value <= 0.0:
        raise ValueError(f"{name} non fini ou non positif: {value}")
    return value


def properties(p: float, t: float) -> dict[str, float]:
    p_abs = max(float(p), P_MIN)
    t_safe = min(max(float(t), T_MIN), T_MAX)
    dp = max(100.0, 1e-3 * max(abs(p_abs), 1.0))
    p_lo = max(P_MIN, p_abs - dp)
    p_hi = min(P_MAX, p_abs + dp)
    if not p_hi > p_lo:
        raise ValueError(f"pHi <= pLo: {p_hi} <= {p_lo}")
    rho = finite_positive("rho", PropsSI("D", "P", p_abs, "T", t_safe, FLUID))
    cp = finite_positive("Cp", PropsSI("C", "P", p_abs, "T", t_safe, FLUID))
    # h et s dépendent de la référence choisie et peuvent être négatifs;
    # seule leur finitude est exigée ici.
    enthalpy = finite_value("h", PropsSI("H", "P", p_abs, "T", t_safe, FLUID))
    entropy = finite_value("s", PropsSI("S", "P", p_abs, "T", t_safe, FLUID))
    rho_lo = finite_positive("rhoLo", PropsSI("D", "P", p_lo, "T", t_safe, FLUID))
    rho_hi = finite_positive("rhoHi", PropsSI("D", "P", p_hi, "T", t_safe, FLUID))
    psi = (rho_hi - rho_lo) / (p_hi - p_lo)
    finite_positive("psi", psi)
    return {"p_abs": p_abs, "T": t_safe, "rho": rho, "Cp": cp, "h": enthalpy, "s": entropy, "pLo": p_lo, "pHi": p_hi, "psi": psi}


def main() -> int:
    samples = []
    for p in (P_MIN, 100_000.0, 200_000.0, 1_000_000.0):
        for t in (T_TEST_MIN, 21.01, 25.0, 30.0, T_MAX):
            samples.append(properties(p, t))
    saturation = []
    for p in (100_000.0, 200_000.0, 1_000_000.0):
        tsat = PropsSI("T", "P", p, "Q", 0, FLUID)
        if not math.isfinite(tsat):
            raise ValueError(f"Tsat non fini à p={p}: {tsat}")
        saturation.append({"p_abs": p, "Tsat": tsat})
    result = {"status": "PASS_COOLPROP_FINITE_SAMPLES", "fluid": FLUID, "samples": samples, "saturation": saturation}
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
