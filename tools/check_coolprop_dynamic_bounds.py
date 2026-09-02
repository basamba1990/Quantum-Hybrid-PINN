#!/usr/bin/env python3
"""Contrôle CoolProp à bornes thermiques dépendantes de la pression.

Le script est fail-closed : aucune propriété d'état n'est acceptée si la
pression, la température, rho, Cp, psi ou les bornes de saturation sont non
finies, hors domaine ou non positives. Il ne remplace jamais un NaN par zéro.
La fenêtre [Tsat - SATURATION_HALF_WIDTH, Tsat + SATURATION_HALF_WIDTH] est
volontairement conservatrice pour le démarrage diphasique; elle doit être
validée par le responsable thermodynamique avant production.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

from CoolProp.CoolProp import PropsSI

FLUID = "ParaHydrogen"
PRESSURE_MIN_PA = 10_000.0
PRESSURE_MAX_PA = 2_000_000.0
TEMPERATURE_MARGIN_K = 0.05
SATURATION_HALF_WIDTH_K = 6.0


def finite(name: str, value: float) -> float:
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"{name} non fini: {value}")
    return value


def positive(name: str, value: float) -> float:
    value = finite(name, value)
    if value <= 0.0:
        raise ValueError(f"{name} non positif: {value}")
    return value


def pressure_abs(p: float) -> float:
    p = finite("p", p)
    if p < PRESSURE_MIN_PA or p > PRESSURE_MAX_PA:
        raise ValueError(
            f"pression absolue hors domaine [{PRESSURE_MIN_PA}, {PRESSURE_MAX_PA}] Pa: {p}"
        )
    return p


def dynamic_temperature_bounds(p: float) -> dict[str, float | None]:
    """Retourne une fenêtre sûre dépendante de p avant un appel P,T."""
    p = pressure_abs(p)
    t_triple = positive("Ttriple", PropsSI("Ttriple", "ParaHydrogen"))
    p_triple = positive("ptriple", PropsSI("ptriple", "ParaHydrogen"))
    t_critical = positive("Tcrit", PropsSI("Tcrit", "ParaHydrogen"))
    p_critical = positive("Pcrit", PropsSI("pcrit", "ParaHydrogen"))

    tsat: float | None = None
    if p_triple <= p < p_critical:
        # Appel de préflight : aucune autre propriété P,T n'est consultée tant
        # que Tsat(p) n'est pas finie et physiquement ordonnée.
        tsat = positive("Tsat", PropsSI("T", "P", p, "Q", 0, FLUID))
        if not t_triple < tsat < t_critical:
            raise ValueError(f"Tsat hors [{t_triple}, {t_critical}] K à p={p}: {tsat}")

    lower = t_triple + TEMPERATURE_MARGIN_K
    upper = t_critical - TEMPERATURE_MARGIN_K
    if tsat is not None:
        lower = max(lower, tsat - SATURATION_HALF_WIDTH_K)
        upper = min(upper, tsat + SATURATION_HALF_WIDTH_K)
    if not lower < upper:
        raise ValueError(f"fenêtre T vide à p={p}: [{lower}, {upper}] K")
    return {
        "p_abs": p,
        "Tmin": lower,
        "Tmax": upper,
        "Tsat": tsat,
        "Ttriple": t_triple,
        "Tcrit": t_critical,
        "ptriple": p_triple,
        "pcrit": p_critical,
    }


def state(p: float, T: float) -> dict[str, float | None]:
    p = pressure_abs(p)
    bounds = dynamic_temperature_bounds(p)
    T = finite("T", T)
    if not bounds["Tmin"] <= T <= bounds["Tmax"]:
        raise ValueError(
            f"T hors bornes dynamiques à p={p}: {T} K, "
            f"attendu [{bounds['Tmin']}, {bounds['Tmax']}] K"
        )

    rho = positive("rho", PropsSI("D", "P", p, "T", T, FLUID))
    cp = positive("Cp", PropsSI("C", "P", p, "T", T, FLUID))
    h = finite("h", PropsSI("H", "P", p, "T", T, FLUID))
    s = finite("s", PropsSI("S", "P", p, "T", T, FLUID))

    dp = max(100.0, 1e-3 * p)
    p_lo = max(PRESSURE_MIN_PA, p - dp)
    p_hi = min(PRESSURE_MAX_PA, p + dp)
    if not p_hi > p_lo:
        raise ValueError(f"pHi <= pLo: {p_hi} <= {p_lo}")
    # Chaque pression perturbée est prévalidée avec sa propre fenêtre T(p).
    for name, pp in (("pLo", p_lo), ("pHi", p_hi)):
        b = dynamic_temperature_bounds(pp)
        if not b["Tmin"] <= T <= b["Tmax"]:
            raise ValueError(f"T non admissible à {name}={pp}: {T} K")
    rho_lo = positive("rhoLo", PropsSI("D", "P", p_lo, "T", T, FLUID))
    rho_hi = positive("rhoHi", PropsSI("D", "P", p_hi, "T", T, FLUID))
    psi = finite("psi", (rho_hi - rho_lo) / (p_hi - p_lo))
    if psi <= 0.0:
        raise ValueError(f"psi non positif: {psi}")
    return {
        "p_abs": p,
        "T": T,
        "Tmin": bounds["Tmin"],
        "Tmax": bounds["Tmax"],
        "Tsat": bounds["Tsat"],
        "rho": rho,
        "Cp": cp,
        "h": h,
        "s": s,
        "pLo": p_lo,
        "pHi": p_hi,
        "rhoLo": rho_lo,
        "rhoHi": rho_hi,
        "psi": psi,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pressures", nargs="+", type=float, default=[10_000.0, 100_000.0, 200_000.0, 1_000_000.0])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    results: list[dict[str, Any]] = []
    for p in args.pressures:
        bounds = dynamic_temperature_bounds(p)
        # Évite exactement Tsat : un état P,T saturé est ambigu sans qualité Q.
        # Le point d’essai reste dans la fenêtre dynamique, côté sous-refroidi.
        T = float(bounds["Tmin"]) + 0.35 * (float(bounds["Tmax"]) - float(bounds["Tmin"]))
        if bounds["Tsat"] is not None and abs(T - float(bounds["Tsat"])) < 1e-4:
            T = float(bounds["Tmin"]) + 0.25 * (float(bounds["Tmax"]) - float(bounds["Tmin"]))
        results.append(state(p, T))
    output = {"status": "PASS_DYNAMIC_PT_BOUNDS", "fluid": FLUID, "results": results}
    text = json.dumps(output, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        if args.output.exists():
            raise FileExistsError(f"sortie existante: {args.output}")
        args.output.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
