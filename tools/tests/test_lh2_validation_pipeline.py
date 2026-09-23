from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from lh2_v8_gate import evaluate_gate  # noqa: E402


def test_baseline_is_explicitly_blocked_for_v8():
    root = Path(__file__).parents[2] / "artifacts" / "lh2_validation_baseline"
    result = evaluate_gate(root)
    assert result["status"] == "BLOCKED"
    assert result["trainingAllowed"] is False
    assert any("ACCEPTED_BASELINE" in reason for reason in result["reasons"])


def test_sidecar_distinguishes_solver_and_derived_fields():
    root = Path(__file__).parents[2] / "artifacts" / "lh2_validation_baseline"
    sidecar = json.loads((root / "sidecar.json").read_text(encoding="utf-8"))
    assert sidecar["contractVersion"] == "cfd-volume.v1"
    assert sidecar["solverProduced"] is False
    assert sidecar["fieldDescriptors"]["alpha_liquid"]["origin"] == "derived"
    assert len(sidecar["frames"]) == 6
    assert sidecar["evidence"]["immutableHashes"] is True
