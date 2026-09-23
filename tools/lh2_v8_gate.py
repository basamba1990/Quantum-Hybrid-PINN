#!/usr/bin/env python3
"""Gate V8 training/evaluation on an accepted, immutable LH2 baseline."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def evaluate_gate(baseline: Path, independent_case: Path | None = None) -> dict:
    manifest_path = baseline / "MANIFEST.json"
    sidecar_path = baseline / "sidecar.json"
    config_path = baseline / "effective_config.json"
    if not config_path.is_file():
        config_path = baseline / "baseline" / "effective_config.json"
    required = [manifest_path, sidecar_path, config_path, baseline / "independent_comparison.json"]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        return {"status": "BLOCKED", "trainingAllowed": False, "reason": "missing_artifacts", "missing": missing, "reasons": ["baseline caseStatus must be ACCEPTED_BASELINE", *[f"missing artifact: {path}" for path in missing]]}

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
    config = json.loads(config_path.read_text(encoding="utf-8"))
    reasons: list[str] = []
    if manifest.get("caseStatus") != "ACCEPTED_BASELINE":
        reasons.append("baseline caseStatus must be ACCEPTED_BASELINE")
    if sidecar.get("scientificStatus") != "ACCEPTED_BASELINE":
        reasons.append("sidecar scientificStatus must be ACCEPTED_BASELINE")
    if sidecar.get("solverProduced") is not True:
        reasons.append("solverProduced must be true")
    if not sidecar.get("evidence", {}).get("solverProvenance"):
        reasons.append("solver provenance evidence missing")
    if not sidecar.get("evidence", {}).get("referenceComparison"):
        reasons.append("reference comparison evidence missing")
    if not sidecar.get("evidence", {}).get("solverResiduals"):
        reasons.append("solver residual evidence missing")
    if config.get("trainingAllowed") is not True:
        reasons.append("effective config does not allow training")
    if independent_case is None and (baseline / "independent").exists():
        independent_case = baseline / "independent"
    if independent_case is None:
        reasons.append("independent evaluation case is required")
    elif not independent_case.exists():
        reasons.append("independent evaluation case does not exist")

    status = "READY_FOR_V8" if not reasons else "BLOCKED"
    return {
        "status": status,
        "trainingAllowed": status == "READY_FOR_V8",
        "baselineManifestSha256": sha256(manifest_path),
        "independentEvaluationPresent": independent_case is not None and independent_case.exists(),
        "reasons": reasons,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("baseline", type=Path)
    parser.add_argument("--independent-case", type=Path)
    args = parser.parse_args()
    result = evaluate_gate(args.baseline, args.independent_case)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] == "READY_FOR_V8" else 2


if __name__ == "__main__":
    raise SystemExit(main())
