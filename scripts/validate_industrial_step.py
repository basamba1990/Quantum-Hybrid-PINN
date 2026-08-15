#!/usr/bin/env python3
"""Fail-closed validation of tracked industrial STEP AP242 artifacts.

This validator intentionally scans only the industrial package root. Legacy
fixtures/step files are kept for existing parser tests and are not certification
artifacts unless they are placed under fixtures/step/industrial/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import cadquery as cq
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_SHELL, TopAbs_SOLID, TopAbs_VERTEX
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS_Shape


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def count_subshapes(shape: TopoDS_Shape, kind: Any) -> int:
    explorer = TopExp_Explorer(shape, kind)
    count = 0
    while explorer.More():
        count += 1
        explorer.Next()
    return count


def read_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Manifest must be an object: {path}")
    return value


def validate_package(package_dir: Path) -> dict[str, Any]:
    step = package_dir / "geometry.step"
    manifest_path = package_dir / "case_manifest.json"
    if not step.is_file():
        raise FileNotFoundError(step)
    if not manifest_path.is_file():
        raise FileNotFoundError(manifest_path)
    text = step.read_text(encoding="utf-8", errors="ignore")
    schema = re.search(r"FILE_SCHEMA\(\(\s*'([^']+)'", text, re.MULTILINE)
    if not schema or "AP242_MANAGED_MODEL_BASED_3D_ENGINEERING" not in schema.group(1):
        raise ValueError(f"Not AP242DIS: {step}")
    if "SI_UNIT($,.METRE.)" not in text:
        raise ValueError(f"STEP length unit is not SI metre: {step}")
    manifest = read_manifest(manifest_path)
    geometry = manifest.get("geometry") or {}
    actual_hash = sha256(step)
    if geometry.get("step_sha256") != actual_hash:
        raise ValueError(f"SHA-256 mismatch for {step}: manifest={geometry.get('step_sha256')} actual={actual_hash}")
    if manifest.get("immutable_revision") != actual_hash:
        raise ValueError(f"Immutable revision mismatch for {step}")
    imported = cq.importers.importStep(str(step)).val()
    brep_valid = bool(imported.isValid())
    analyzer_valid = bool(BRepCheck_Analyzer(imported.wrapped).IsValid())
    if not brep_valid or not analyzer_valid:
        raise ValueError(f"B-Rep invalid for {step}: shape={brep_valid} analyzer={analyzer_valid}")
    box = imported.BoundingBox()
    bounds = {"xmin": box.xmin, "xmax": box.xmax, "ymin": box.ymin, "ymax": box.ymax, "zmin": box.zmin, "zmax": box.zmax}
    # CadQuery/OCP represents imported STEP coordinates internally in mm even
    # when the STEP file declares SI metres. Convert the round-trip measurement
    # to SI before comparing with the immutable generator manifest.
    bounds_m = {key: float(value) * 1e-3 for key, value in bounds.items()}
    volume_m3 = float(imported.Volume()) * 1e-9
    expected_bounds = geometry.get("bounds_m") or {}
    for key, expected in expected_bounds.items():
        if abs(bounds_m[key] - float(expected)) > 1e-6:
            raise ValueError(f"Bounds mismatch for {step}: {key}={bounds_m[key]} expected={expected}")
    expected_volume = float(geometry.get("volume_m3"))
    volume_tolerance = max(1e-9, abs(expected_volume) * 2e-5)
    if abs(volume_m3 - expected_volume) > volume_tolerance:
        raise ValueError(f"Volume mismatch for {step}: {volume_m3} expected={expected_volume} tol={volume_tolerance}")
    summary = {
        "scenario_type": manifest.get("scenario_type"),
        "path": str(step),
        "step_sha256": actual_hash,
        "schema": schema.group(1),
        "si_length_unit": "m",
        "shape_valid": brep_valid,
        "brepcheck_valid": analyzer_valid,
        "solids": count_subshapes(imported.wrapped, TopAbs_SOLID),
        "shells": count_subshapes(imported.wrapped, TopAbs_SHELL),
        "faces": count_subshapes(imported.wrapped, TopAbs_FACE),
        "edges": count_subshapes(imported.wrapped, TopAbs_EDGE),
        "vertices": count_subshapes(imported.wrapped, TopAbs_VERTEX),
        "volume_m3": volume_m3,
        "bounds_m": bounds_m,
        "named_boundaries": manifest.get("named_boundaries"),
    }
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("fixtures/step/industrial"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/industrial_step_validation.json"))
    args = parser.parse_args()
    package_dirs = sorted(path.parent for path in args.root.glob("*/geometry.step"))
    if not package_dirs:
        raise SystemExit(f"No industrial STEP package found below {args.root}")
    summaries = [validate_package(path) for path in package_dirs]
    scenarios = {item["scenario_type"] for item in summaries}
    required = {"HEAVY_DUTY_HYDROGEN_REFUELING", "LH2_LARGE_SCALE_STORAGE_1250M3"}
    missing = required - scenarios
    if missing:
        raise SystemExit(f"Missing required scenarios: {sorted(missing)}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"status": "VALIDATED", "packages": summaries}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"status": "VALIDATED", "packages": summaries}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
