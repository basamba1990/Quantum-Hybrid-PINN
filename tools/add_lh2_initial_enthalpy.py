from pathlib import Path
from CoolProp.CoolProp import PropsSI

ROOT = Path(__file__).parents[1]
CASES = [
    ROOT / "pilot_case/PILOT-LH2-001/cases/CFD-BASELINE",
    ROOT / "pilot_case/PILOT-LH2-001/cases/CFD-INDEPENDENT",
]
P0 = 125310.0
T0 = 21.010
VALUES = {
    "gas": PropsSI("H", "T", T0, "Q", 1.0, "ParaHydrogen"),
    "liquid": PropsSI("H", "T", T0, "Q", 0.0, "ParaHydrogen"),
}

TEMPLATE = """/* Initial specific enthalpy from CoolProp ParaHydrogen at T={T0} K, p={P0} Pa, Q={q}. */
FoamFile
{{
    version 2.0;
    format ascii;
    class volScalarField;
    object h.{phase};
}}
dimensions [0 2 -2 0 0 0 0];
internalField uniform {value:.12g};
boundaryField
{{
    inlet {{ type calculated; value uniform {value:.12g}; }}
    outlet {{ type calculated; value uniform {value:.12g}; }}
    wall1 {{ type calculated; value uniform {value:.12g}; }}
    wall2 {{ type calculated; value uniform {value:.12g}; }}
    defaultFaces {{ type empty; }}
}}
"""

for case in CASES:
    out = case / "0"
    for phase, q in (("gas", 1.0), ("liquid", 0.0)):
        (out / f"h.{phase}").write_text(
            TEMPLATE.format(T0=T0, P0=P0, q=q, phase=phase, value=VALUES[phase]),
            encoding="utf-8",
        )
print({k: round(v, 6) for k, v in VALUES.items()})
