#!/usr/bin/env python3
"""Run an independently installed CFD solver and create a hashable reference record.

The runner does not implement CFD and does not synthesize fields or residuals.
It executes only an explicitly configured executable and fails closed when the
solver, mesh, mesh hash, command or declared outputs are missing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SHA256_LENGTH = 64


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve_inside(root: Path, value: str) -> Path:
    candidate = (root / value).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"path escapes case directory: {value}")
    if (root / value).is_symlink():
        raise ValueError(f"symlink is not allowed: {value}")
    return candidate


def load_config(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("case configuration must be a JSON object")
    for key in ("case_id", "calculation_id", "solver", "mesh", "outputs"):
        if key not in data:
            raise ValueError(f"missing configuration key: {key}")
    if data["case_id"] != "PILOT-001":
        raise ValueError("case_id must be PILOT-001")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()
    config_path = args.config.resolve()
    root = config_path.parent.resolve()
    config = load_config(config_path)
    solver = config["solver"]
    mesh = config["mesh"]
    output_specs = config["outputs"]
    if not isinstance(solver, dict) or not isinstance(mesh, dict) or not isinstance(output_specs, list):
        raise ValueError("solver, mesh and outputs have invalid types")

    command = solver.get("command")
    executable = solver.get("executable")
    if not isinstance(command, list) or not command or any(not isinstance(item, str) or not item for item in command):
        raise ValueError("solver.command must be a non-empty argument list")
    if not isinstance(executable, str) or not executable or executable.lower().startswith(("pending", "replace", "null")):
        raise ValueError("solver.executable must identify a real installed solver")
    resolved_executable = shutil.which(executable)
    if resolved_executable is None:
        raise FileNotFoundError(f"configured CFD solver is not installed: {executable}")
    if command[0] != executable and Path(command[0]).name != Path(executable).name:
        raise ValueError("solver.command[0] must match solver.executable")

    mesh_path_value = mesh.get("path")
    declared_mesh_hash = mesh.get("sha256")
    if not isinstance(mesh_path_value, str) or not mesh_path_value:
        raise ValueError("mesh.path is required")
    if not isinstance(declared_mesh_hash, str) or len(declared_mesh_hash) != SHA256_LENGTH:
        raise ValueError("mesh.sha256 must be a full SHA-256 digest")
    mesh_path = resolve_inside(root, mesh_path_value)
    if not mesh_path.is_file():
        raise FileNotFoundError(f"mesh not found: {mesh_path_value}")
    actual_mesh_hash = sha256_file(mesh_path)
    if actual_mesh_hash != declared_mesh_hash.lower():
        raise ValueError(f"mesh hash mismatch: expected {declared_mesh_hash}, got {actual_mesh_hash}")

    if not output_specs or any(not isinstance(item, dict) or not isinstance(item.get("path"), str) for item in output_specs):
        raise ValueError("outputs must declare at least one relative file")
    outputs = [resolve_inside(root, item["path"]) for item in output_specs]
    if any(path.exists() for path in outputs):
        raise FileExistsError("declared output already exists; use a new output directory for an immutable run")

    run_dir = root / "runs" / str(config["calculation_id"])
    run_dir.mkdir(parents=True, exist_ok=False)
    log_path = run_dir / "solver.log"
    started = datetime.now(timezone.utc)
    env = os.environ.copy()
    extra_env = config.get("environment", {})
    if extra_env and not isinstance(extra_env, dict):
        raise ValueError("environment must be an object")
    for key, value in extra_env.items():
        if not isinstance(key, str) or not isinstance(value, str):
            raise ValueError("environment keys and values must be strings")
        env[key] = value

    completed = subprocess.run(
        command,
        cwd=root,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    log_path.write_text(completed.stdout, encoding="utf-8")
    finished = datetime.now(timezone.utc)
    missing_outputs = [str(path.relative_to(root)) for path in outputs if not path.is_file()]
    output_records = []
    for spec, path in zip(output_specs, outputs):
        if path.is_file():
            output_records.append({
                "path": str(path.relative_to(root)),
                "role": spec.get("role", "solver_output"),
                "sha256": sha256_file(path),
                "bytes": path.stat().st_size,
            })

    reference = {
        "schema": "independent-cfd-reference.v1",
        "case_id": config["case_id"],
        "calculation_id": config["calculation_id"],
        "solver": {"name": solver.get("name"), "executable": executable, "resolved_path": resolved_executable, "command": command},
        "mesh": {"path": mesh_path_value, "sha256": actual_mesh_hash},
        "execution": {
            "started_at": started.isoformat().replace("+00:00", "Z"),
            "finished_at": finished.isoformat().replace("+00:00", "Z"),
            "exit_code": completed.returncode,
            "log": str(log_path.relative_to(root)),
            "log_sha256": sha256_file(log_path),
        },
        "outputs": output_records,
        "residuals": {"status": "UNAVAILABLE", "reason": "No configured parser declared solver residual evidence."},
        "status": "REFERENCE_RUN_COMPLETED" if completed.returncode == 0 and not missing_outputs else "REFERENCE_RUN_FAILED",
        "physical_validation": "UNAVAILABLE",
        "missing_outputs": missing_outputs,
    }
    record_path = run_dir / "reference_manifest.json"
    record_path.write_text(json.dumps(reference, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if reference["status"] != "REFERENCE_RUN_COMPLETED":
        print(json.dumps(reference, indent=2))
        return 1
    print(json.dumps(reference, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(2)
