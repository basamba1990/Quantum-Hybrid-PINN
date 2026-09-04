import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]
WORKER = ROOT / "worker" / "run_su2.py"


def test_missing_config_fails_without_artifacts(tmp_path):
    artifacts = tmp_path / "artifacts"
    result = subprocess.run(
        [sys.executable, str(WORKER)],
        env={**os.environ, "CASE_ROOT": str(tmp_path / "case"), "ARTIFACT_ROOT": str(artifacts)},
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert not (artifacts / "su2_solution.vtu").exists()


def test_readme_keeps_unvalidated_status():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert "UNVALIDATED" in readme
    assert "Aucun CAD" in readme
