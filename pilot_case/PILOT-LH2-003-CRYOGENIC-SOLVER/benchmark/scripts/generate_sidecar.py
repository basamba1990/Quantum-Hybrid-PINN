#!/usr/bin/env python3
"""Recalcule les hashes des frames d'un paquet cfd-volume.v1."""
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} ARTIFACT_DIR", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()
    sidecar_path = root / "sidecar.json"
    sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
    if sidecar.get("contractVersion") != "cfd-volume.v1":
        raise SystemExit("contractVersion doit être cfd-volume.v1")
    for frame in sidecar.get("frames", []):
        name = frame["file"]
        path = root / name
        if not path.is_file():
            raise SystemExit(f"frame absente: {name}")
        frame["payloadHash"] = sha256(path)
    sidecar_path.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(sidecar_path)
    for frame in sidecar["frames"]:
        print(f"{frame['file']} {frame['payloadHash']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
