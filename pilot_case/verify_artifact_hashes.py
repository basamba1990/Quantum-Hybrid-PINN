#!/usr/bin/env python3
"""Evidence-grade SHA-256 manifest verifier.

The tool never invents a hash. It can record hashes for explicitly supplied
files, or verify hashes already present in a JSON manifest. Paths are confined
to the manifest directory and symlinks are rejected.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SECRET_RE = re.compile(r"(?:ghp_|github_pat_|sk-[A-Za-z0-9]|pdl_live_|service_role|BEGIN .* PRIVATE KEY)", re.I)
PENDING_RE = re.compile(r"^(?:PENDING|NOT_APPLICABLE|UNAVAILABLE|N/?D|NONE|)$", re.I)


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def safe_path(root: Path, value: str) -> Path:
    candidate = (root / value).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"path escapes manifest directory: {value}")
    original = root / value
    if original.is_symlink():
        raise ValueError(f"symlink is not allowed: {value}")
    return candidate


def load_manifest(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("manifest root must be an object")
    if data.get("case_id") != "PILOT-001":
        raise ValueError("manifest case_id must be PILOT-001")
    if not isinstance(data.get("artifacts"), list):
        raise ValueError("manifest artifacts must be a list")
    if not isinstance(data.get("outputs"), list):
        raise ValueError("manifest outputs must be a list")
    return data


def verify_entries(root: Path, entries: list[Any], section: str) -> list[str]:
    errors: list[str] = []
    for index, item in enumerate(entries):
        if not isinstance(item, dict):
            errors.append(f"{section}[{index}] must be an object")
            continue
        path_value = item.get("path")
        declared = item.get("sha256")
        if not isinstance(path_value, str) or not path_value:
            errors.append(f"{section}[{index}] missing path")
            continue
        try:
            path = safe_path(root, path_value)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if not path.is_file():
            errors.append(f"missing artifact: {path_value}")
            continue
        if not isinstance(declared, str) or not SHA256_RE.fullmatch(declared):
            errors.append(f"{section}[{index}] invalid sha256 for {path_value}")
            continue
        actual = sha256_file(path)
        if actual != declared.lower():
            errors.append(f"hash mismatch for {path_value}: expected {declared}, got {actual}")
        expected_bytes = item.get("bytes")
        if expected_bytes is not None and expected_bytes != path.stat().st_size:
            errors.append(f"byte-size mismatch for {path_value}")
    return errors


def reject_secret_strings(value: Any, location: str = "manifest") -> list[str]:
    if isinstance(value, str):
        return [f"secret-like value found at {location}"] if SECRET_RE.search(value) else []
    if isinstance(value, dict):
        errors: list[str] = []
        for key, child in value.items():
            errors.extend(reject_secret_strings(child, f"{location}.{key}"))
        return errors
    if isinstance(value, list):
        errors = []
        for index, child in enumerate(value):
            errors.extend(reject_secret_strings(child, f"{location}[{index}]"))
        return errors
    return []


def record(manifest_path: Path, files: list[str], role: str) -> int:
    data = load_manifest(manifest_path)
    root = manifest_path.parent.resolve()
    entries = data["artifacts"] if role == "input" else data["outputs"]
    for raw in files:
        path = safe_path(root, raw)
        if not path.is_file():
            raise ValueError(f"missing file: {raw}")
        entries.append({
            "id": Path(raw).stem,
            "role": role,
            "path": raw,
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
            "provenance_status": "HASHED_LOCAL_COPY",
        })
    manifest_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"RECORDED {len(files)} {role} artifact(s)")
    return 0


def verify(manifest_path: Path, allow_template: bool) -> int:
    data = load_manifest(manifest_path)
    errors = reject_secret_strings(data)
    root = manifest_path.parent.resolve()
    errors.extend(verify_entries(root, data["artifacts"], "artifacts"))
    errors.extend(verify_entries(root, data["outputs"], "outputs"))
    status = str(data.get("status", ""))
    if not allow_template and (PENDING_RE.match(str(data.get("environment", {}).get("code_commit", ""))) or status != "RUN_COMPLETED"):
        errors.append("manifest is not an executed run; use --allow-template only for structural template checks")
    if errors:
        print("FAIL")
        for error in errors:
            print(f"- {error}")
        return 1
    print("PASS")
    print(f"case_id={data['case_id']}")
    print(f"inputs={len(data['artifacts'])}")
    print(f"outputs={len(data['outputs'])}")
    print(f"status={status}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    verify_parser = sub.add_parser("verify")
    verify_parser.add_argument("manifest", type=Path)
    verify_parser.add_argument("--allow-template", action="store_true")
    record_parser = sub.add_parser("record")
    record_parser.add_argument("manifest", type=Path)
    record_parser.add_argument("--role", choices=["input", "output"], required=True)
    record_parser.add_argument("files", nargs="+")
    args = parser.parse_args()
    try:
        if args.command == "verify":
            return verify(args.manifest.resolve(), args.allow_template)
        return record(args.manifest.resolve(), args.files, args.role)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
