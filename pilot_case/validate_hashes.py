#!/usr/bin/env python3
"""Validate a pilot manifest and all declared artifact hashes.

The validator is intentionally stdlib-only so it can run inside a clean capsule.
It never follows symlinks outside the manifest directory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SECRET_RE = re.compile(
    r"(ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]+|BEGIN [A-Z ]+ PRIVATE KEY|"
    r"(password|passwd|api[_-]?key|service[_-]?role[_-]?key|webhook[_-]?secret)\s*[:=])",
    re.IGNORECASE,
)
REQUIRED_MANIFEST_FIELDS = ("schema", "case_id", "run_id", "protocol_version", "artifacts", "outputs")


class ValidationError(Exception):
    pass


def _load_manifest(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"cannot read manifest: {exc}") from exc
    if not isinstance(data, dict):
        raise ValidationError("manifest root must be an object")
    missing = [key for key in REQUIRED_MANIFEST_FIELDS if key not in data]
    if missing:
        raise ValidationError(f"missing manifest fields: {', '.join(missing)}")
    if data["schema"] != "quantum-pilot-manifest.v1":
        raise ValidationError("unsupported manifest schema")
    if not isinstance(data["artifacts"], list) or not isinstance(data["outputs"], list):
        raise ValidationError("artifacts and outputs must be arrays")
    return data


def _safe_path(root: Path, relative: str) -> Path:
    candidate = (root / relative).resolve()
    if root.resolve() not in candidate.parents:
        raise ValidationError(f"path escapes manifest directory: {relative}")
    if candidate.is_symlink():
        raise ValidationError(f"symlink is not allowed: {relative}")
    return candidate


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _reject_secrets(path: Path) -> None:
    if path.stat().st_size > 10 * 1024 * 1024:
        return
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return
    if SECRET_RE.search(text):
        raise ValidationError(f"possible secret material found in: {path.name}")


def validate(manifest_path: Path, allow_template: bool = False) -> int:
    manifest = _load_manifest(manifest_path)
    if manifest.get("status") == "TEMPLATE_NOT_EXECUTED":
        if allow_template:
            print("PASS: template manifest schema is valid; no run artifacts expected")
            return 0
        raise ValidationError("template has not been executed; provide a populated manifest")

    root = manifest_path.parent
    declarations = manifest["artifacts"] + manifest["outputs"]
    if not declarations:
        raise ValidationError("manifest must declare at least one artifact or output")

    seen: set[str] = set()
    for item in declarations:
        if not isinstance(item, dict):
            raise ValidationError("each artifact declaration must be an object")
        relative = item.get("path")
        expected = item.get("sha256")
        if not isinstance(relative, str) or not relative:
            raise ValidationError("each artifact requires a relative path")
        if relative in seen:
            raise ValidationError(f"duplicate artifact declaration: {relative}")
        seen.add(relative)
        if not isinstance(expected, str) or not SHA256_RE.fullmatch(expected):
            raise ValidationError(f"invalid SHA-256 for: {relative}")
        path = _safe_path(root, relative)
        if not path.is_file():
            raise ValidationError(f"declared file does not exist: {relative}")
        _reject_secrets(path)
        actual = _hash_file(path)
        if actual != expected:
            raise ValidationError(f"hash mismatch for {relative}: expected {expected}, got {actual}")
        print(f"OK {relative} sha256={actual}")

    print(f"PASS: {len(declarations)} declared files verified")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, nargs="?", default=Path(__file__).with_name("MANIFEST.json"))
    parser.add_argument("--allow-template", action="store_true", help="validate the unexecuted template schema")
    args = parser.parse_args()
    try:
        return validate(args.manifest, allow_template=args.allow_template)
    except ValidationError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
