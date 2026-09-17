#!/usr/bin/env python3
"""Validate MANIFEST.json and sidecar frame hashes in a CFD archive or directory."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(data: bytes, label: str) -> dict[str, Any]:
    value = json.loads(data.decode("utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label}: expected a JSON object")
    return value


def safe_member(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"unsafe archive member path: {name}")
    return path


def validate_artifact(root: str, read_file) -> list[str]:
    errors: list[str] = []
    manifest_name = f"{root}/MANIFEST.json" if root else "MANIFEST.json"
    sidecar_name = f"{root}/sidecar.json" if root else "sidecar.json"

    try:
        manifest = load_json(read_file(manifest_name), manifest_name)
        sidecar = load_json(read_file(sidecar_name), sidecar_name)
    except Exception as exc:  # noqa: BLE001 - report archive contract errors together
        return [str(exc)]

    entries = manifest.get("files")
    if not isinstance(entries, list):
        errors.append(f"{manifest_name}: files must be a list")
        entries = []

    listed_names: set[str] = set()

    def resolve_member(name: str) -> tuple[str, bytes]:
        candidates = [
            f"{root}/{name}" if root else name,
            f"{root}/frames/{name}" if root else f"frames/{name}",
        ]
        last_error: Exception | None = None
        for candidate in candidates:
            try:
                return candidate, read_file(candidate)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
        raise FileNotFoundError(name) from last_error

    for entry in entries:
        if not isinstance(entry, dict):
            errors.append(f"{manifest_name}: invalid file entry")
            continue
        name = entry.get("file")
        expected_hash = entry.get("sha256")
        expected_bytes = entry.get("bytes")
        if not isinstance(name, str) or not name:
            errors.append(f"{manifest_name}: file entry has no valid file name")
            continue
        listed_names.add(name)
        try:
            member_name, data = resolve_member(name)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{member_name}: missing ({exc})")
            continue
        actual_hash = sha256_bytes(data)
        if actual_hash != expected_hash:
            errors.append(f"{member_name}: SHA-256 mismatch (expected {expected_hash}, got {actual_hash})")
        if len(data) != expected_bytes:
            errors.append(f"{member_name}: byte count mismatch (expected {expected_bytes}, got {len(data)})")

    sidecar_frames = sidecar.get("frames")
    if not isinstance(sidecar_frames, list):
        errors.append(f"{sidecar_name}: frames must be a list")
        sidecar_frames = []

    for frame in sidecar_frames:
        if not isinstance(frame, dict):
            errors.append(f"{sidecar_name}: invalid frame entry")
            continue
        name = frame.get("file")
        expected_hash = frame.get("payloadHash")
        if not isinstance(name, str) or not isinstance(expected_hash, str):
            errors.append(f"{sidecar_name}: frame requires file and payloadHash")
            continue
        try:
            member_name, frame_data = resolve_member(name)
            actual_hash = sha256_bytes(frame_data)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{member_name}: missing frame ({exc})")
            continue
        if actual_hash != expected_hash:
            errors.append(f"{member_name}: payloadHash mismatch (expected {expected_hash}, got {actual_hash})")
        if name not in listed_names and f"frames/{name}" not in listed_names:
            errors.append(f"{member_name}: frame is not listed in MANIFEST.json")

    return errors


def validate_directory(directory: Path) -> list[str]:
    roots = [path.parent.relative_to(directory).as_posix() for path in directory.rglob("MANIFEST.json")]
    if not roots:
        return [f"no MANIFEST.json found below {directory}"]

    def read_file(name: str) -> bytes:
        path = directory / name
        safe_member(name)
        return path.read_bytes()

    errors: list[str] = []
    for root in roots:
        errors.extend(validate_artifact(root, read_file))
    return errors


def validate_zip(archive: Path) -> list[str]:
    with zipfile.ZipFile(archive) as zf:
        names = {info.filename for info in zf.infolist()}
        for name in names:
            safe_member(name)
        manifest_names = [name for name in names if name.endswith("/MANIFEST.json") or name == "MANIFEST.json"]
        if not manifest_names:
            return [f"no MANIFEST.json found in {archive}"]

        def read_file(name: str) -> bytes:
            safe_member(name)
            return zf.read(name)

        errors: list[str] = []
        for manifest_name in manifest_names:
            root = manifest_name[:-len("/MANIFEST.json")] if manifest_name.endswith("/MANIFEST.json") else ""
            errors.extend(validate_artifact(root, read_file))
        return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path, help="CFD archive (.zip) or extracted artifact directory")
    args = parser.parse_args()

    errors = validate_zip(args.artifact) if args.artifact.suffix.lower() == ".zip" else validate_directory(args.artifact)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"OK: SHA-256 manifest and sidecar frame hashes validated: {args.artifact}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
