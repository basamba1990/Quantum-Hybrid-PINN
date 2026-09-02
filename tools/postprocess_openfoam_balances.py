#!/usr/bin/env python3
"""Post-traitement fail-closed des résidus et bilans OpenFOAM.

Important : les résidus algébriques OpenFOAM ne suffisent pas à calculer un
bilan global de masse ou d'énergie. Le script extrait les résidus du log et
calcule les bilans à partir d'un CSV produit par surfaceFieldValue/function
objects ou par un export équivalent.

CSV attendu pour les bilans (unités SI, convention signée explicite) :
  time,mass_in,mass_out,energy_in,energy_out,mass_storage,energy_storage

mass_in/mass_out sont des débits massiques [kg/s], energy_in/energy_out des
flux d'énergie [W], mass_storage [kg] et energy_storage [J]. Les flux doivent
être positifs dans leur direction nommée. Le bilan instantané est :
  dM/dt = mass_in - mass_out - d(mass_storage)/dt
  dE/dt = energy_in - energy_out - d(energy_storage)/dt
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from pathlib import Path

RESIDUAL_RE = re.compile(
    r"Solving for (?P<field>[^,]+),\s*Initial residual\s*=\s*(?P<initial>[-+0-9.eE]+),"
    r"\s*Final residual\s*=\s*(?P<final>[-+0-9.eE]+),\s*No Iterations\s*(?P<iterations>\d+)"
)
TIME_RE = re.compile(r"^Time\s*=\s*(?P<time>[-+0-9.eE]+)")
CONTINUITY_RE = re.compile(
    r"continuity errors\s*:\s*sum local\s*=\s*(?P<local>[-+0-9.eE]+),"
    r"\s*global\s*=\s*(?P<global>[-+0-9.eE]+),\s*cumulative\s*=\s*(?P<cumulative>[-+0-9.eE]+)"
)
REQUIRED_BALANCE_COLUMNS = (
    "time", "mass_in", "mass_out", "energy_in", "energy_out",
    "mass_storage", "energy_storage",
)


def finite(name: str, value: float) -> float:
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"{name} non fini: {value}")
    return value


def parse_log(path: Path) -> dict:
    current_time = None
    residuals = []
    continuity = []
    saw_nonfinite = False
    for line_no, line in enumerate(path.read_text(errors="replace").splitlines(), 1):
        if re.search(r"\b(?:nan|inf|-inf)\b", line, re.IGNORECASE):
            saw_nonfinite = True
        time_match = TIME_RE.search(line.strip())
        if time_match:
            current_time = finite("time", time_match.group("time"))
        residual_match = RESIDUAL_RE.search(line)
        if residual_match:
            item = {
                "line": line_no,
                "time": current_time,
                "field": residual_match.group("field").strip(),
                "initial": finite("initial residual", residual_match.group("initial")),
                "final": finite("final residual", residual_match.group("final")),
                "iterations": int(residual_match.group("iterations")),
            }
            if item["initial"] < 0 or item["final"] < 0 or item["iterations"] < 0:
                raise ValueError(f"résidu ou itérations négatif ligne {line_no}")
            residuals.append(item)
        continuity_match = CONTINUITY_RE.search(line)
        if continuity_match:
            continuity.append({
                "line": line_no,
                "time": current_time,
                "sum_local": finite("sum local", continuity_match.group("local")),
                "global": finite("global", continuity_match.group("global")),
                "cumulative": finite("cumulative", continuity_match.group("cumulative")),
            })
    if not residuals:
        raise ValueError(f"aucun résidu OpenFOAM reconnu dans {path}")
    return {
        "path": str(path),
        "residuals": residuals,
        "continuity": continuity,
        "saw_nonfinite_token": saw_nonfinite,
    }


def read_balance_csv(path: Path) -> list[dict[str, float]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in REQUIRED_BALANCE_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"colonnes bilan manquantes: {', '.join(missing)}")
        rows = []
        for number, row in enumerate(reader, 2):
            item = {c: finite(f"{c} ligne {number}", row[c]) for c in REQUIRED_BALANCE_COLUMNS}
            rows.append(item)
    if len(rows) < 2:
        raise ValueError("au moins deux lignes sont nécessaires pour calculer d(storage)/dt")
    rows.sort(key=lambda r: r["time"])
    for previous, current in zip(rows, rows[1:]):
        if current["time"] <= previous["time"]:
            raise ValueError("les temps du CSV bilan doivent être strictement croissants")
    return rows


def compute_balances(rows: list[dict[str, float]]) -> list[dict[str, float]]:
    result = []
    for index, row in enumerate(rows):
        if index == 0:
            result.append({**row, "mass_storage_rate": None, "energy_storage_rate": None,
                           "mass_imbalance": None, "energy_imbalance": None})
            continue
        prev = rows[index - 1]
        dt = row["time"] - prev["time"]
        dm_dt = (row["mass_storage"] - prev["mass_storage"]) / dt
        de_dt = (row["energy_storage"] - prev["energy_storage"]) / dt
        result.append({
            **row,
            "mass_storage_rate": dm_dt,
            "energy_storage_rate": de_dt,
            "mass_imbalance": row["mass_in"] - row["mass_out"] - dm_dt,
            "energy_imbalance": row["energy_in"] - row["energy_out"] - de_dt,
        })
    return result


def summarize_residuals(residuals: list[dict]) -> dict:
    by_field = {}
    for item in residuals:
        by_field.setdefault(item["field"], []).append(item)
    summary = {}
    for field, values in by_field.items():
        finals = [x["final"] for x in values]
        initials = [x["initial"] for x in values]
        summary[field] = {
            "samples": len(values),
            "initial_min": min(initials),
            "final_min": min(finals),
            "final_max": max(finals),
            "last_final": finals[-1],
            "last_initial": initials[-1],
            "last_final_not_greater_than_last_initial": finals[-1] <= initials[-1],
        }
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--balance-csv", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mass-tolerance", type=float, default=1e-6)
    parser.add_argument("--energy-tolerance", type=float, default=1e-6)
    args = parser.parse_args()
    if args.mass_tolerance < 0 or args.energy_tolerance < 0:
        raise ValueError("les tolérances doivent être positives ou nulles")

    log_data = parse_log(args.log)
    balance_data = None
    balance_status = "MISSING_BALANCE_SERIES"
    if args.balance_csv:
        balance_data = compute_balances(read_balance_csv(args.balance_csv))
        balance_status = "BALANCE_SERIES_PARSED"

    residual_summary = summarize_residuals(log_data["residuals"])
    residual_status = "FAIL_NONFINITE_TOKEN" if log_data["saw_nonfinite_token"] else "RESIDUALS_PARSED"
    result = {
        "schema": "openfoam-residual-balance-report.v1",
        "status": "INCONCLUSIVE",
        "residual_status": residual_status,
        "balance_status": balance_status,
        "log": log_data,
        "residual_summary": residual_summary,
        "balance": None,
        "criteria": {
            "mass_tolerance": args.mass_tolerance,
            "energy_tolerance": args.energy_tolerance,
            "note": "Les tolérances doivent être approuvées avant un verdict de production.",
        },
    }
    if balance_data is not None:
        max_mass = max(abs(x["mass_imbalance"]) for x in balance_data[1:])
        max_energy = max(abs(x["energy_imbalance"]) for x in balance_data[1:])
        result["balance"] = {
            "rows": balance_data,
            "max_abs_mass_imbalance": max_mass,
            "max_abs_energy_imbalance": max_energy,
            "mass_within_tolerance": max_mass <= args.mass_tolerance,
            "energy_within_tolerance": max_energy <= args.energy_tolerance,
        }
    if (
        residual_status == "RESIDUALS_PARSED"
        and balance_data is not None
        and result["balance"]["mass_within_tolerance"]
        and result["balance"]["energy_within_tolerance"]
    ):
        result["status"] = "PASS_POSTPROCESSING_ONLY"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists():
        raise FileExistsError(f"sortie existante: {args.output}")
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "output": str(args.output)}, ensure_ascii=False))
    return 0 if result["status"] == "PASS_POSTPROCESSING_ONLY" else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(2)
