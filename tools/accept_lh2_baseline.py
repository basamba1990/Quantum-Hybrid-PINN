#!/usr/bin/env python3
"""Promote an LH2 run only after independent checks and explicit human review."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def reject(reason: str) -> dict:
    return {"status": "REJECTED", "caseStatus": "UNVALIDATED", "trainingAllowed": False, "reason": reason}


def accept(baseline: Path, review_path: Path | None = None, apply: bool = False) -> dict:
    sidecar_path = baseline / "sidecar.json"
    manifest_path = baseline / "MANIFEST.json"
    review_path = review_path or baseline / "baseline_review.json"
    solver_run = baseline / "baseline"
    required = [sidecar_path, manifest_path, review_path, solver_run / "reference_comparison.json", solver_run / "mass_energy_balances.json", solver_run / "residual_history.json", solver_run / "solver.log", baseline / "independent_comparison.json"]
    missing = [str(p) for p in required if not p.is_file()]
    if missing:
        return reject("missing required artifacts: " + ", ".join(missing))

    sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    review = json.loads(review_path.read_text(encoding="utf-8"))
    reference = json.loads((solver_run / "reference_comparison.json").read_text(encoding="utf-8"))
    balances = json.loads((solver_run / "mass_energy_balances.json").read_text(encoding="utf-8"))
    residuals = json.loads((solver_run / "residual_history.json").read_text(encoding="utf-8"))

    reasons: list[str] = []
    if sidecar.get("solverProduced") is not True:
        reasons.append("solverProduced must be true")
    if sidecar.get("caseStatus") != "READY_FOR_REVIEW":
        reasons.append("sidecar must be READY_FOR_REVIEW before promotion")
    if manifest.get("caseStatus") != "READY_FOR_REVIEW":
        reasons.append("manifest must be READY_FOR_REVIEW before promotion")
    if reference.get("pass") is not True:
        reasons.append("reference comparison does not pass")
    if not residuals.get("rows") or not all(
        isinstance(row.get("final"), (int, float)) and row["final"] == row["final"]
        for row in residuals["rows"]
    ):
        reasons.append("residual history contains missing or non-finite values")
    if abs(float(balances.get("maxAbsEnergyImbalance_W", float("inf")))) > 1e-6:
        reasons.append("energy balance exceeds 1e-6 W")
    if review.get("decision") != "ACCEPT_BASELINE":
        reasons.append("review decision must be ACCEPT_BASELINE")
    if not review.get("reviewerName") or not review.get("reviewerAffiliation") or not review.get("reviewDate"):
        reasons.append("reviewer identity and date are required")
    checks = review.get("checks", {})
    required_checks = ("residualsReviewed", "energyBalancesReviewed", "referenceComparisonReviewed", "independentCaseReviewed", "meshReviewed", "provenanceReviewed")
    for check in required_checks:
        if checks.get(check) is not True:
            reasons.append(f"review check missing: {check}")

    if reasons or not apply:
        return {"status": "BLOCKED", "caseStatus": sidecar.get("caseStatus"), "trainingAllowed": False, "applyRequired": True, "reasons": reasons or ["dry run: pass --apply only after review"]}

    # Promotion is deliberately only possible after the checks above.
    sidecar["scientificStatus"] = "ACCEPTED_BASELINE"
    sidecar["caseStatus"] = "ACCEPTED_BASELINE"
    sidecar["acceptance"] = {"reviewRequired": True, "reviewFile": review_path.name, "acceptedAt": datetime.now(timezone.utc).isoformat(), "reviewer": review["reviewerName"], "reviewerAffiliation": review["reviewerAffiliation"]}
    sidecar_path.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    review["decision"] = "ACCEPTED_BASELINE"
    review["acceptedAt"] = datetime.now(timezone.utc).isoformat()
    review_path.write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    manifest["caseStatus"] = "ACCEPTED_BASELINE"
    manifest["trainingAllowed"] = True
    manifest["acceptedAt"] = datetime.now(timezone.utc).isoformat()
    entries = []
    for path in sorted(p for p in baseline.rglob("*") if p.is_file() and p.name not in {"MANIFEST.json", "MANIFEST.sha256"}):
        entries.append({"file": str(path.relative_to(baseline)), "bytes": path.stat().st_size, "sha256": sha256(path)})
    manifest["files"] = entries
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (baseline / "MANIFEST.sha256").write_text(f"{sha256(manifest_path)}  MANIFEST.json\n", encoding="utf-8")
    return {"status": "ACCEPTED", "caseStatus": "ACCEPTED_BASELINE", "trainingAllowed": True, "manifestSha256": sha256(manifest_path)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("baseline", type=Path)
    parser.add_argument("--review", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    result = accept(args.baseline, args.review, args.apply)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] == "ACCEPTED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
