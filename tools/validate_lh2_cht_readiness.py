#!/usr/bin/env python3
"""Validate the evidence and configuration prerequisites for the LH2 CHT study.

This checker deliberately does not claim that a CHT case is scientifically valid.
It distinguishes the OpenFOAM CHT solver smoke test from the missing thermo-boiling
closure and missing conformal multi-region tank mesh.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

REQUIRED_REGIONS = ["LH2", "aluminium2219", "polyurethane10mm", "polyurethane20mm", "polyurethane30mm"]
REQUIRED_THERMO_CONTRACT = ["h_lh2", "h_fg(p)", "T_sat(p)", "evaporation", "condensation", "wall_heat_transfer"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", type=Path, required=True)
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    case = args.case.resolve()
    checks: list[dict[str, object]] = []

    for app in ("foamMultiRun", "chtMultiRegionFoam", "splitMeshRegions", "foamToVTK"):
        checks.append({"check": f"command:{app}", "ok": shutil.which(app) is not None})

    region_file = case / "constant" / "regionProperties"
    declared_regions: list[str] = []
    if region_file.is_file():
        text = region_file.read_text(encoding="utf-8", errors="replace")
        declared_regions = [name for name in REQUIRED_REGIONS if name in text]
    checks.append({"check": "regionProperties", "ok": len(declared_regions) == len(REQUIRED_REGIONS), "declared": declared_regions})

    control = case / "system" / "controlDict"
    control_text = control.read_text(encoding="utf-8", errors="replace") if control.is_file() else ""
    checks.append({"check": "foamMultiRun-control", "ok": "application" in control_text and "foamMultiRun" in control_text and "regionSolvers" in control_text})

    thermo_manifest = case / "thermo_contract.json"
    contract = json.loads(thermo_manifest.read_text(encoding="utf-8")) if thermo_manifest.is_file() else {}
    missing = [key for key in REQUIRED_THERMO_CONTRACT if not isinstance(contract.get(key), dict) or contract[key].get("implemented") is not True]
    checks.append({"check": "thermo-boiling-contract", "ok": not missing, "missing": missing})

    mesh_log = case / "logs" / "checkMesh.log"
    checks.append({"check": "checkMesh-evidence", "ok": mesh_log.is_file() and "Failed" not in mesh_log.read_text(encoding="utf-8", errors="replace")})

    result = {
        "case": str(case),
        "status": "READY_FOR_STRUCTURAL_CHT_ONLY" if all(bool(item["ok"]) for item in checks) else "BLOCKED",
        "scientificStatus": "THERMAL_LH2_VOF_CHT_NOT_VALIDATED",
        "checks": checks,
        "requiredRegions": REQUIRED_REGIONS,
        "requiredThermoContract": REQUIRED_THERMO_CONTRACT,
        "note": "chtMultiRegionFoam couples fluid/solid energy but does not by itself implement LH2 liquid-vapor phase change; use a dedicated multiphase solver/custom closure before claiming boil-off CFD.",
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0 if result["status"] == "READY_FOR_STRUCTURAL_CHT_ONLY" else 2


if __name__ == "__main__":
    raise SystemExit(main())
