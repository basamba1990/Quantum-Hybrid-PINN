"""Préflight fail-closed pour le pilote LH2-003.

Le script distingue explicitement un smoke test structurel d'une exécution
production. Il refuse les placeholders, les chemins inexistants, les hashes
invalides et les manifests qui prétendent valider sans preuves.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")
PLACEHOLDER = re.compile(r"^(REQUIRED|MISSING|UNAVAILABLE|PENDING|TODO)(?:[_-].*)?$", re.I)


def fail(message: str) -> None:
    raise SystemExit(f"PREFLIGHT_FAIL: {message}")


def real(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip() or PLACEHOLDER.match(value.strip()):
        fail(f"{label} absent ou placeholder")
    return value.strip()


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def check_file(root: Path, value: Any, label: str, expected_hash: Any = None) -> Path:
    path = (root / real(value, label)).resolve()
    if root.resolve() not in path.parents and path != root.resolve():
        fail(f"{label} sort du répertoire de travail")
    if not path.is_file():
        fail(f"{label} introuvable: {path}")
    if expected_hash is not None:
        if not isinstance(expected_hash, str) or not SHA256.fullmatch(expected_hash):
            fail(f"hash invalide pour {label}")
        actual = hash_file(path)
        if actual.lower() != expected_hash.lower():
            fail(f"hash incorrect pour {label}: attendu {expected_hash}, calculé {actual}")
    return path


def validate_manifest(manifest: dict[str, Any], root: Path) -> None:
    if manifest.get("validationAllowed") is not False:
        fail("validationAllowed doit rester false tant que les gates ne sont pas prouvées")
    if manifest.get("scientificStatus") not in {"UNVALIDATED", "INCONCLUSIVE"}:
        fail("scientificStatus doit rester UNVALIDATED ou INCONCLUSIVE")
    for gate, status in (manifest.get("gates") or {}).items():
        if status in {"PASS", "VALIDATED", "CERTIFIED"}:
            fail(f"gate {gate} prétend être validée sans pipeline de preuve")
    solver = manifest.get("solver") or {}
    real(solver.get("version"), "solver.version")
    real(solver.get("commit_or_build_id"), "solver.commit_or_build_id")
    digest = real(solver.get("container_digest"), "solver.container_digest")
    if not digest.startswith("sha256:") or not SHA256.fullmatch(digest[7:]):
        fail("solver.container_digest doit être un digest sha256:...")
    for section, label in ((manifest.get("inputs") or {}).get("cad"), "inputs.cad"), ((manifest.get("inputs") or {}).get("mesh"), "inputs.mesh"), ((manifest.get("inputs") or {}).get("property_database"), "inputs.property_database"):
        if not isinstance(section, dict):
            fail(f"{label} absent")
        check_file(root, section.get("path"), f"{label}.path", section.get("sha256"))
    evidence = manifest.get("evidence") or {}
    for key in ("residual_history", "mass_balance", "energy_balance", "boiloff_history", "boundary_sets"):
        item = evidence.get(key)
        check_file(root, item, f"evidence.{key}")
    references = evidence.get("experimental_references")
    if not isinstance(references, list) or not references:
        fail("evidence.experimental_references absent")
    for index, item in enumerate(references):
        check_file(root, item, f"evidence.experimental_references[{index}]")


def main() -> int:
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} CONFIG.json MANIFEST.json", file=sys.stderr)
        return 2
    config_path = Path(sys.argv[1]).resolve()
    manifest_path = Path(sys.argv[2]).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if config.get("mode", "production") != "production":
        print("PREFLIGHT_OK: structural/non-production mode", flush=True)
        return 0
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_manifest(manifest, manifest_path.parent)
    print("PREFLIGHT_OK: production inputs and evidence are present; scientific status remains unvalidated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
