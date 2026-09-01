#!/usr/bin/env python3
"""Validate the repository-level acceptance protocol without running a pilot."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CRITERIA = ROOT / "acceptance_criteria.yaml"
FREEZE = ROOT / "protocol" / "acceptance_criteria_freeze.json"
SECRET = re.compile(r"(ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9]+|BEGIN [A-Z ]+ PRIVATE KEY|service[_-]?role[_-]?key\s*[:=])", re.I)


def fail(message: str) -> int:
    print(f"FAIL: {message}", file=sys.stderr)
    return 1


def main() -> int:
    if not CRITERIA.is_file() or not FREEZE.is_file():
        return fail("acceptance criteria or freeze template is missing")

    criteria = CRITERIA.read_text(encoding="utf-8")
    required = (
        "criteria_must_be_frozen_before_evaluation: true",
        "training_condition: aoa_5",
        "evaluation_condition: aoa_17",
        "evaluation_manifest_must_be_hidden_from_training: true",
        "post_hoc_threshold_changes: INVALID",
        "cfd_physical_acceptance:",
        "data_independence:",
        "criteria_freeze:",
        "independent_reproduction:",
    )
    for marker in required:
        if marker not in criteria:
            return fail(f"missing required protocol control: {marker}")

    try:
        freeze = json.loads(FREEZE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return fail(f"invalid freeze JSON: {exc}")

    if freeze.get("status") != "TEMPLATE_REQUIRES_DOMAIN_APPROVAL":
        return fail("freeze template must remain unapproved until thresholds are reviewed")
    if freeze.get("training_condition") != "aoa_5" or freeze.get("evaluation_condition") != "aoa_17":
        return fail("held-out conditions are not AoA 5° -> AoA 17°")
    if freeze.get("evaluation_manifest_hidden_from_training") is not True:
        return fail("evaluation manifest must be hidden from training")

    for path in (CRITERIA, FREEZE):
        if SECRET.search(path.read_text(encoding="utf-8")):
            return fail(f"possible secret material found in {path}")

    print("PASS: independent acceptance protocol controls are present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
