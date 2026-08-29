from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "parse_cfd_residuals.py"


def base_manifest(path: Path) -> None:
    path.write_text(json.dumps({"case_id": "PILOT-001", "status": "TEMPLATE_NOT_EXECUTED", "outputs": [], "evidence": {}}), encoding="utf-8")


def run(tmp_path: Path, log_text: str):
    log = tmp_path / "solver_residuals.jsonl"
    manifest = tmp_path / "MANIFEST.json"
    output = tmp_path / "parsed.json"
    log.write_text(log_text, encoding="utf-8")
    base_manifest(manifest)
    return subprocess.run([
        sys.executable, str(SCRIPT), "--log", str(log), "--manifest", str(manifest),
        "--output", str(output), "--calculation-id", "CFD-REFERENCE-001",
        "--solver-name", "fixture-solver", "--solver-version", "1.0", "--allow-template",
    ], text=True, capture_output=True)


def test_valid_log_updates_manifest(tmp_path: Path):
    result = run(tmp_path, '{"iteration": 1, "mass": 1e-2, "momentum": 2e-2, "energy": 3e-2}\n{"iteration": 2, "mass": 1e-4, "momentum": 2e-4, "energy": 3e-4}\n')
    assert result.returncode == 0, result.stdout + result.stderr
    manifest = json.loads((tmp_path / "MANIFEST.json").read_text())
    assert manifest["status"] == "CFD_REFERENCE_RESIDUALS_AVAILABLE"
    assert manifest["residuals"]["mass"] == 1e-4
    assert manifest["evidence"]["solver_residuals"] is True


def test_invalid_json_fails_closed(tmp_path: Path):
    assert run(tmp_path, "iteration=1 mass=0.1\n").returncode == 2


def test_nan_fails_closed(tmp_path: Path):
    assert run(tmp_path, '{"iteration": 1, "mass": NaN, "momentum": 1, "energy": 1}\n').returncode == 2


def test_non_monotonic_iterations_fail_closed(tmp_path: Path):
    text = '{"iteration": 2, "mass": 1, "momentum": 1, "energy": 1}\n{"iteration": 1, "mass": 1, "momentum": 1, "energy": 1}\n'
    assert run(tmp_path, text).returncode == 2
