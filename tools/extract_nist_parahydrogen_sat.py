from __future__ import annotations

import csv
import sys
from pathlib import Path
from bs4 import BeautifulSoup

if len(sys.argv) != 3:
    raise SystemExit("usage: extract_nist_parahydrogen_sat.py INPUT_HTML OUTPUT_CSV")

source = Path(sys.argv[1])
out = Path(sys.argv[2])
soup = BeautifulSoup(source.read_text(encoding="utf-8"), "html.parser")
rows = []
for phase_id, phase_name in (("Liquid", "liquid"), ("Vapor", "vapor")):
    section = soup.find(id=phase_id)
    if section is None:
        raise SystemExit(f"missing NIST section: {phase_id}")
    table = section.find_next("table")
    if table is None:
        raise SystemExit(f"missing table: {phase_id}")
    headers = [th.get_text(" ", strip=True) for th in table.find_all("th")]
    for tr in table.find_all("tr"):
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if len(cells) == len(headers) and cells[-1].lower() == phase_name:
            row = dict(zip(headers, cells))
            rows.append({
                "phase": phase_name,
                "T_K": row["Temperature (K)"],
                "p_MPa": row["Pressure (MPa)"],
                "rho_kg_m3": row["Density (kg/m3)"],
                "u_kJ_kg": row["Internal Energy (kJ/kg)"],
                "h_kJ_kg": row["Enthalpy (kJ/kg)"],
                "Cv_J_kgK": str(float(row["Cv (J/g*K)"]) * 1000.0),
                "Cp_J_kgK": str(float(row["Cp (J/g*K)"]) * 1000.0),
                "mu_uPa_s": row["Viscosity (uPa*s)"],
                "k_W_mK": row["Therm. Cond. (W/m*K)"],
                "sigma_N_m": row.get("Surf. Tension (N/m)", ""),
            })

out.parent.mkdir(parents=True, exist_ok=True)
with out.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
print(f"wrote {len(rows)} rows to {out}")
