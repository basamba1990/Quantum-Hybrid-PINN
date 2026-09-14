#!/usr/bin/env python3
"""Preflight reproductible du pilote LH2.

Ce script ne fabrique aucune preuve CFD et ne lance pas de certification. Il
bloque explicitement tant qu'un exécutable OpenFOAM compatible n'est pas
accessible et tant que les dossiers baseline/independent ne sont pas séparés.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASE = ROOT / "pilot_case" / "PILOT-LH2-001"
REQUIRED = [
    CASE / "MANIFEST.json",
    CASE / "acceptance_criteria.yaml",
    CASE / "sources.yaml",
    CASE / "cases" / "CFD-BASELINE" / "Allrun",
    CASE / "cases" / "CFD-INDEPENDENT" / "Allrun",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def executable() -> dict:
    candidates = ["foamRun", "reactingTwoPhaseEulerFoam"]
    found = {name: shutil.which(name) for name in candidates}
    wm_project_dir = os.environ.get("WM_PROJECT_DIR", "")
    return {
        "wmProjectDir": wm_project_dir or None,
        "executables": found,
        "available": any(found.values()),
        "version": subprocess.run([next((p for p in found.values() if p), "true"), "-help"], capture_output=True, text=True).stdout[:500] if any(found.values()) else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=CASE / "evidence" / "preflight_latest.json")
    args = parser.parse_args()
    manifest = json.loads((CASE / "MANIFEST.json").read_text(encoding="utf-8"))
    checks = []
    for path in REQUIRED:
        checks.append({"check": f"required:{path.relative_to(ROOT)}", "pass": path.exists(), "value": str(path)})
    checks.append({"check": "manifest.case_status_not_validated", "pass": manifest.get("case_status") == "INCONCLUSIVE", "value": manifest.get("case_status")})
    checks.append({"check": "baseline_independent_are_distinct", "pass": (CASE / "cases" / "CFD-BASELINE").resolve() != (CASE / "cases" / "CFD-INDEPENDENT").resolve(), "value": True})
    checks.append({"check": "evaluation_hidden_during_training", "pass": manifest.get("evidence", {}).get("evaluation_hidden_during_training") is True, "value": manifest.get("evidence", {}).get("evaluation_hidden_during_training")})
    runner = executable()
    checks.append({"check": "openfoam_runner_available", "pass": runner["available"], "value": runner})
    result = {
        "schema": "quantum-lh2-preflight.v1",
        "pilotId": "PILOT-LH2-001",
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "READY_FOR_RUNNER" if all(item["pass"] for item in checks) else "BLOCKED",
        "checks": checks,
        "artifactHashes": {str(path.relative_to(ROOT)): sha256(path) for path in REQUIRED if path.exists()},
        "scientificDecision": "INCONCLUSIVE",
        "prohibitedInterpretation": "Preflight success is not CFD convergence, G3, G4, G5 or experimental validation.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] == "READY_FOR_RUNNER" else 2


if __name__ == "__main__":
    raise SystemExit(main())
