import hashlib
import json
from pathlib import Path

import pytest

from validate_hashes import ValidationError, validate


ROOT = Path(__file__).parent


def test_template_manifest_is_valid():
    assert validate(ROOT / "MANIFEST.json", allow_template=True) == 0


def test_populated_manifest_hashes_are_verified(tmp_path):
    artifact = tmp_path / "artifact.txt"
    artifact.write_text("authorized fixture\n", encoding="utf-8")
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    manifest = tmp_path / "MANIFEST.json"
    manifest.write_text(json.dumps({
        "schema": "quantum-pilot-manifest.v1",
        "case_id": "PILOT-001",
        "run_id": "RUN-001",
        "protocol_version": "1.0.0",
        "artifacts": [{"path": "artifact.txt", "sha256": digest}],
        "outputs": [],
    }), encoding="utf-8")
    assert validate(manifest) == 0


def test_hash_mismatch_fails(tmp_path):
    artifact = tmp_path / "artifact.txt"
    artifact.write_text("changed\n", encoding="utf-8")
    manifest = tmp_path / "MANIFEST.json"
    manifest.write_text(json.dumps({
        "schema": "quantum-pilot-manifest.v1",
        "case_id": "PILOT-001",
        "run_id": "RUN-001",
        "protocol_version": "1.0.0",
        "artifacts": [{"path": "artifact.txt", "sha256": "0" * 64}],
        "outputs": [],
    }), encoding="utf-8")
    with pytest.raises(ValidationError, match="hash mismatch"):
        validate(manifest)


def test_path_escape_fails(tmp_path):
    manifest = tmp_path / "MANIFEST.json"
    manifest.write_text(json.dumps({
        "schema": "quantum-pilot-manifest.v1",
        "case_id": "PILOT-001",
        "run_id": "RUN-001",
        "protocol_version": "1.0.0",
        "artifacts": [{"path": "../outside.txt", "sha256": "0" * 64}],
        "outputs": [],
    }), encoding="utf-8")
    with pytest.raises(ValidationError, match="escapes"):
        validate(manifest)
