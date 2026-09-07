from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
PREFLIGHT = ROOT / "runner" / "preflight_manifest.py"
INGEST = ROOT / "benchmark" / "scripts" / "ingest_solver_vtu.py"
FIXTURE = ROOT / "benchmark" / "fixtures" / "structural-test"


def test_ingest_requires_explicit_contract_template(tmp_path: Path) -> None:
    if not FIXTURE.is_dir():
        pytest.skip("fixtures internes absentes du kit autonome")
    result = subprocess.run(
        [sys.executable, str(INGEST), str(FIXTURE), str(tmp_path / "artifact")],
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 2
    assert "TEMPLATE_SIDECAR" in result.stderr


def test_ingest_removes_local_solver_path_and_records_all_sources(tmp_path: Path) -> None:
    if not FIXTURE.is_dir():
        pytest.skip("fixtures internes absentes du kit autonome")
    destination = tmp_path / "artifact"
    subprocess.run(
        [sys.executable, str(INGEST), str(FIXTURE), str(destination), str(FIXTURE / "sidecar.json")],
        check=True,
    )
    sidecar = json.loads((destination / "sidecar.json").read_text(encoding="utf-8"))
    assert "solverOutputDirectory" not in sidecar["provenance"]
    assert len(sidecar["provenance"]["sourceFiles"]) == 2
    assert len(sidecar["provenance"]["sourceHash"]) == 64
    assert (destination / "source-manifest.json").is_file()


def test_production_preflight_rejects_template_manifest(tmp_path: Path) -> None:
    config = tmp_path / "config.json"
    config.write_text(json.dumps({"mode": "production"}), encoding="utf-8")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"validationAllowed": True}), encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(PREFLIGHT), str(config), str(manifest)],
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode != 0
    assert "validationAllowed" in result.stderr
