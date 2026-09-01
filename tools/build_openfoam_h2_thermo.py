from __future__ import annotations
import csv
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: build_openfoam_h2_thermo.py SAT_CSV OUT_DIR")

csv_path = Path(sys.argv[1])
out = Path(sys.argv[2])
rows = list(csv.DictReader(csv_path.open(encoding="utf-8")))
out.mkdir(parents=True, exist_ok=True)

def f(phase: str, key: str, scale: float = 1.0):
    vals = [r for r in rows if r["phase"] == phase]
    return "\n".join(f"            ({r['T_K']} {float(r[key]) * scale:.9g})" for r in vals)

def dictionary(phase: str, mol_weight: float, eos_comment: str):
    return f'''/* NIST SRD 69 saturation-derived parahydrogen properties; see source registry. */
FoamFile
{{
    version 2.0;
    format ascii;
    class dictionary;
    object thermophysicalProperties.{phase};
}}
thermoType
{{
    type heRhoThermo;
    mixture pureMixture;
    transport tabulated;
    thermo hTabulated;
    equationOfState icoTabulated;
    specie specie;
    energy sensibleEnthalpy;
}}
mixture
{{
    specie
    {{
        nMoles 1;
        molWeight {mol_weight};
    }}
    equationOfState
    {{
        // {eos_comment}
        rho
        (
{f(phase, 'rho_kg_m3')}
        );
    }}
    thermodynamics
    {{
        Hf 0;
        Sf 0;
        Cp
        (
{f(phase, 'Cp_J_kgK')}
        );
    }}
    transport
    {{
        mu
        (
{f(phase, 'mu_uPa_s', 1e-6)}
        );
        kappa
        (
{f(phase, 'k_W_mK')}
        );
    }}
}}
'''

(out / "thermophysicalProperties.liquid").write_text(dictionary("liquid", 2.01588, "NIST saturation density interpolation; pressure dependence is not represented by icoTabulated."), encoding="utf-8")
(out / "thermophysicalProperties.gas").write_text(dictionary("vapor", 2.01588, "NIST saturation vapor density interpolation; use only within the declared saturation range."), encoding="utf-8")
print(f"wrote thermo dictionaries to {out}")
