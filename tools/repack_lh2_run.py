#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    root = args.root
    files = []
    for path in sorted(p for p in root.rglob("*") if p.is_file() and p.name not in {"MANIFEST.json", "MANIFEST.sha256"}):
        files.append({"file": str(path.relative_to(root)), "bytes": path.stat().st_size, "sha256": sha256(path)})
    manifest_path = root / "MANIFEST.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    manifest.update({"manifestVersion": "lh2-run-manifest.v1", "files": files, "repackedAt": datetime.now(timezone.utc).isoformat()})
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (root / "MANIFEST.sha256").write_text(f"{sha256(manifest_path)}  MANIFEST.json\n", encoding="utf-8")
    archive = root.with_suffix(".zip")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(p for p in root.rglob("*") if p.is_file()):
            zf.write(path, path.relative_to(root.parent))
    print(json.dumps({"manifest": str(manifest_path), "archive": str(archive), "manifestSha256": sha256(manifest_path), "files": len(files)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
