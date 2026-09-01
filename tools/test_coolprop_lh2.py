from __future__ import annotations
from CoolProp.CoolProp import PropsSI

for fluid in ("ParaHydrogen", "Hydrogen"):
    print(f"FLUID={fluid}")
    for query in ("Tcrit", "Pcrit", "Ttriple"):
        try:
            print(query, PropsSI(query, fluid))
        except Exception as exc:
            print(query, "ERROR", exc)
    try:
        psat = PropsSI("P", "T", 21.01, "Q", 0, fluid)
        print("Psat_Pa", psat)
        for phase, q in (("liquid", 0), ("vapor", 1)):
            print(phase, "rho", PropsSI("D", "T", 21.01, "Q", q, fluid), "h", PropsSI("H", "T", 21.01, "Q", q, fluid), "u", PropsSI("U", "T", 21.01, "Q", q, fluid))
    except Exception as exc:
        print("saturation ERROR", exc)

try:
    print("REFPROP", PropsSI("Tcrit", "REFPROP::ParaHydrogen"))
except Exception as exc:
    print("REFPROP unavailable or unconfigured:", exc)
