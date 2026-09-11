#!/usr/bin/env python3
"""Update and verify SHA-256 hashes declared by a CFD VTU sidecar.

The sidecar must contain:
{
  "frames": [
    {"file": "frame_0000.vtu", "payloadHash": "..."}
  ]
}

Paths in ``frames[].file`` are resolved relative to the sidecar directory by
 default. The script hashes exact file bytes in streaming chunks and never
 modifies VTU contents.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

CHUNK_SIZE = 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def load_sidecar(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Impossible de lire le sidecar {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError("Le sidecar doit être un objet JSON.")
    frames = payload.get("frames")
    if not isinstance(frames, list) or not frames:
        raise ValueError("Le sidecar doit contenir une liste frames non vide.")
    return payload


def resolve_frame_path(sidecar_path: Path, frame_file: object, root: Path | None) -> Path:
    if not isinstance(frame_file, str) or not frame_file.strip():
        raise ValueError("Chaque frame doit déclarer un champ file non vide.")
    relative = Path(frame_file)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Chemin de frame refusé (absolu ou parent): {frame_file}")
    base = root if root is not None else sidecar_path.parent
    return (base / relative).resolve()


def update_hashes(sidecar_path: Path, root: Path | None) -> tuple[dict[str, Any], list[tuple[str, str, int]]]:
    payload = load_sidecar(sidecar_path)
    changes: list[tuple[str, str, int]] = []
    for index, frame in enumerate(payload["frames"]):
        if not isinstance(frame, dict):
            raise ValueError(f"frames[{index}] doit être un objet JSON.")
        filename = frame.get("file")
        frame_path = resolve_frame_path(sidecar_path, filename, root)
        if frame_path.suffix.lower() != ".vtu":
            raise ValueError(f"frames[{index}] ne pointe pas vers un fichier .vtu: {filename}")
        if not frame_path.is_file():
            raise FileNotFoundError(f"Frame VTU absente: {frame_path}")
        actual = sha256_file(frame_path)
        previous = str(frame.get("payloadHash", ""))
        frame["payloadHash"] = actual
        changes.append((str(filename), actual, frame_path.stat().st_size))
        if previous and previous.lower() != actual:
            print(f"UPDATED {filename}: {previous} -> {actual}")
        else:
            print(f"OK      {filename}: {actual}")
    return payload, changes


def write_sidecar(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    encoded = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    temporary.write_text(encoded, encoding="utf-8")
    os.replace(temporary, path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sidecar", type=Path, help="Chemin vers sidecar.json")
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Racine de résolution des frames; par défaut, dossier du sidecar.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Écrire vers un autre sidecar au lieu de remplacer le fichier source.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Vérifier les hashes sans écrire le sidecar; échoue si un hash diffère.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    sidecar = args.sidecar.resolve()
    root = args.root.resolve() if args.root else None
    try:
        original = load_sidecar(sidecar)
        updated, changes = update_hashes(sidecar, root)
        mismatches = []
        for before, after in zip(original["frames"], updated["frames"]):
            if isinstance(before, dict) and before.get("payloadHash", "").lower() != after.get("payloadHash", "").lower():
                mismatches.append(str(after.get("file", "<unknown>")))
        if args.check:
            if mismatches:
                print(f"CHECK FAILED: {len(mismatches)} hash(s) incorrect(s).", file=sys.stderr)
                return 2
            print(f"CHECK PASSED: {len(changes)} frame(s) vérifiée(s); sidecar inchangé.")
            return 0
        destination = (args.output or sidecar).resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        write_sidecar(destination, updated)
        print(f"UPDATED SIDECAR: {destination}")
        print(f"FRAMES: {len(changes)} | BYTES: {sum(size for _, _, size in changes)}")
        return 0
    except (OSError, ValueError, FileNotFoundError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
