#!/usr/bin/env python3
"""Parse an explicitly declared CFD residual JSONL log and update a manifest.

This parser intentionally does not scrape arbitrary human-readable solver logs.
A solver adapter must emit one strict JSON object per iteration with finite,
non-negative residual norms. Missing, ambiguous, duplicate or non-monotonic
iterations fail closed. No residual is inferred, averaged from missing data,
or replaced with a default.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REQUIRED_RESIDUALS = ("mass", "momentum", "energy")
SHA256_LENGTH = 64


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    previous_iteration: int | None = None
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip():
            continue
        try:
            item = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"line {line_number}: invalid JSON: {exc.msg}") from exc
        if not isinstance(item, dict):
            raise ValueError(f"line {line_number}: residual record must be an object")
        iteration = item.get("iteration")
        if not isinstance(iteration, int) or isinstance(iteration, bool) or iteration < 0:
            raise ValueError(f"line {line_number}: iteration must be a non-negative integer")
        if previous_iteration is not None and iteration <= previous_iteration:
            raise ValueError(f"line {line_number}: iterations must be strictly increasing")
        previous_iteration = iteration
        for key in REQUIRED_RESIDUALS:
            value = item.get(key)
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0:
                raise ValueError(f"line {line_number}: {key} must be a finite non-negative number")
        records.append({"iteration": iteration, **{key: float(item[key]) for key in REQUIRED_RESIDUALS}})
    if not records:
        raise ValueError("residual log contains no records")
    return records


def resolve_inside(root: Path, value: str) -> Path:
    candidate = (root / value).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"path escapes manifest directory: {value}")
    if (root / value).is_symlink():
        raise ValueError(f"symlink is not allowed: {value}")
    return candidate


def load_manifest(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("case_id") != "PILOT-001":
        raise ValueError("manifest must be a PILOT-001 object")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", type=Path, required=True, help="strict solver residual JSONL log")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True, help="parsed residual evidence JSON")
    parser.add_argument("--calculation-id", required=True)
    parser.add_argument("--solver-name", required=True)
    parser.add_argument("--solver-version", required=True)
    parser.add_argument("--allow-template", action="store_true", help="allow updating a template copy for contract tests")
    args = parser.parse_args()

    log_path = args.log.resolve()
    manifest_path = args.manifest.resolve()
    output_path = args.output.resolve()
    if not log_path.is_file():
        raise FileNotFoundError(f"solver residual log not found: {log_path}")
    manifest = load_manifest(manifest_path)
    if manifest.get("status") in {"TEMPLATE_NOT_EXECUTED", "PUBLIC_BENCHMARK_PROVENANCE_ONLY"} and not args.allow_template:
        raise ValueError("manifest is not an executed run; use a reviewed run manifest, not --allow-template, for production evidence")
    if manifest_path == output_path or manifest_path == log_path:
        raise ValueError("manifest, log and output must be different files")

    records = read_jsonl(log_path)
    final = records[-1]
    residual_evidence = {
        "schema": "cfd-residual-evidence.v1",
        "calculation_id": args.calculation_id,
        "solver": {"name": args.solver_name, "version": args.solver_version},
        "source_log": {"path": str(log_path), "sha256": sha256_file(log_path), "bytes": log_path.stat().st_size},
        "iterations": len(records),
        "first_iteration": records[0]["iteration"],
        "last_iteration": final["iteration"],
        "final": final,
        "history": records,
        "computed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "SOLVER_RESIDUALS_PARSED",
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(residual_evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    output_hash = sha256_file(output_path)

    updated = dict(manifest)
    updated["residuals"] = {
        "status": "AVAILABLE",
        "norm": "solver_declared_l2",
        "mass": final["mass"],
        "momentum": final["momentum"],
        "energy": final["energy"],
        "computedBy": f"{args.solver_name} {args.solver_version}",
        "calculationId": args.calculation_id,
        "sourceLogSha256": residual_evidence["source_log"]["sha256"],
        "evidenceSha256": output_hash,
        "computedAt": residual_evidence["computed_at"],
    }
    evidence = dict(updated.get("evidence", {}))
    evidence["solver_residuals"] = True
    updated["evidence"] = evidence
    outputs = list(updated.get("outputs", []))
    outputs.append({"id": "solver_residual_evidence", "role": "solver_residuals", "path": str(output_path.relative_to(manifest_path.parent)), "sha256": output_hash, "bytes": output_path.stat().st_size})
    updated["outputs"] = outputs
    updated["status"] = "CFD_REFERENCE_RESIDUALS_AVAILABLE"

    # Atomic replacement prevents a partially written manifest from becoming evidence.
    manifest_text = json.dumps(updated, indent=2, ensure_ascii=False) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=manifest_path.parent, delete=False) as tmp:
        tmp.write(manifest_text)
        temp_name = tmp.name
    os.replace(temp_name, manifest_path)
    print(json.dumps({"status": updated["status"], "iterations": len(records), "final": final, "evidence_sha256": output_hash}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}")
        raise SystemExit(2)
