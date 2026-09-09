#!/usr/bin/env python3
"""Fail-closed preflight for PILOT-VINUESA-NACA4412-001.

This script never promotes a pilot to PASS or VALIDATED. It only reports
whether the prerequisites are complete enough to permit a future run.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CASE = ROOT / "case_manifest.json"
FREEZE = ROOT / "acceptance_criteria_freeze.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    failures: list[str] = []
    for path in (CASE, FREEZE):
        if not path.is_file():
            failures.append(f"missing required file: {path.name}")

    if failures:
        for item in failures:
            print(f"BLOCKED: {item}")
        return 2

    case = json.loads(CASE.read_text(encoding="utf-8"))
    freeze = json.loads(FREEZE.read_text(encoding="utf-8"))

    checks = {
        "1 written authorization and license": case["authorization"]["status"] == "AUTHORIZED",
        "2 fixed case": case["geometry"]["name"] == "NACA4412" and case["physics"]["reynolds_status"] == "CONFIRMED_FROM_SOURCE_README" and case["physics"]["reynolds_number_chord"] == 200000,
        "3 raw artifacts hashed": bool(case["evidence"]["raw_file_records"]) and all(
            item.get("sha256") and item.get("read_only") is True
            for item in case["evidence"]["raw_file_records"]
        ),
        "4 independent split declared": case["split"]["evaluation_manifest_hidden_from_training"] is True and not str(case["split"]["split_sha256"]).startswith("PENDING"),
        "5 thresholds approved and frozen": freeze["status"] == "APPROVED" and all(
            not str(value["threshold"]).startswith("PENDING")
            for value in freeze["metrics"].values()
        ),
        "6 independent physical reference accepted": case["reference"]["physical_acceptance"] == "ACCEPTED",
        "7 classical and hybrid runs separate": case["runs"]["classical_baseline"] == "COMPLETED" and case["runs"]["hybrid_quantum_variant"] == "COMPLETED",
        "8 real residuals available": all(case["evidence"][key] == "AVAILABLE" for key in ("mass_residual", "momentum_residual", "energy_residual")),
        "9 evidence bundle persisted": not any(str(case["evidence"][key]).startswith("PENDING") for key in ("environment_lock_sha256", "seed")),
        "10 second clean reproduction": case["evidence"]["reproduction_2_clean_environment"] == "COMPLETED",
        "11 all gates concordant": all(str(value).endswith("PASS") for value in case["gates"].values()),
    }

    for name, ok in checks.items():
        print(f"{'READY' if ok else 'BLOCKED'}: {name}")

    print("DECISION: " + ("READY_FOR_REVIEW_ONLY" if all(checks.values()) else "INCONCLUSIVE_STOP"))
    print("CASE_SHA256: " + sha256(CASE))
    print("FREEZE_SHA256: " + sha256(FREEZE))
    return 0 if all(checks.values()) else 2


if __name__ == "__main__":
    raise SystemExit(main())
