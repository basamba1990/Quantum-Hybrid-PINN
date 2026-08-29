import hashlib
import json
from pathlib import Path

import verify_artifact_hashes as verifier


def make_manifest(root: Path, artifact: Path, declared_hash: str) -> Path:
    manifest = root / "MANIFEST.json"
    manifest.write_text(json.dumps({
        "case_id": "PILOT-001",
        "status": "PUBLIC_BENCHMARK_PROVENANCE_ONLY",
        "artifacts": [{
            "path": artifact.relative_to(root).as_posix(),
            "sha256": declared_hash,
            "bytes": artifact.stat().st_size,
        }],
        "outputs": [],
        "environment": {"code_commit": "PENDING_PINN_RUN_COMMIT"},
    }), encoding="utf-8")
    return manifest


def test_verify_valid_hash(tmp_path, capsys):
    artifact = tmp_path / "input.dat"
    artifact.write_bytes(b"public-cfd-artifact")
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    manifest = make_manifest(tmp_path, artifact, digest)
    assert verifier.verify(manifest, allow_template=True) == 0
    assert "PASS" in capsys.readouterr().out


def test_verify_rejects_hash_mismatch(tmp_path):
    artifact = tmp_path / "input.dat"
    artifact.write_bytes(b"public-cfd-artifact")
    manifest = make_manifest(tmp_path, artifact, "0" * 64)
    assert verifier.verify(manifest, allow_template=True) == 1


def test_verify_rejects_missing_file(tmp_path):
    manifest = tmp_path / "MANIFEST.json"
    manifest.write_text(json.dumps({
        "case_id": "PILOT-001",
        "status": "PUBLIC_BENCHMARK_PROVENANCE_ONLY",
        "artifacts": [{"path": "missing.dat", "sha256": "0" * 64}],
        "outputs": [],
        "environment": {"code_commit": "PENDING_PINN_RUN_COMMIT"},
    }), encoding="utf-8")
    assert verifier.verify(manifest, allow_template=True) == 1


def test_verify_rejects_path_escape(tmp_path):
    manifest = tmp_path / "MANIFEST.json"
    manifest.write_text(json.dumps({
        "case_id": "PILOT-001",
        "status": "PUBLIC_BENCHMARK_PROVENANCE_ONLY",
        "artifacts": [{"path": "../outside.dat", "sha256": "0" * 64}],
        "outputs": [],
        "environment": {"code_commit": "PENDING_PINN_RUN_COMMIT"},
    }), encoding="utf-8")
    assert verifier.verify(manifest, allow_template=True) == 1
