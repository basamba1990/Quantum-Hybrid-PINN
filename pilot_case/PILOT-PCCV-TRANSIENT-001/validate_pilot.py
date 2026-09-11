from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
required = [ROOT / "required_artifacts" / name for name in manifest["required_artifacts"]]
missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file() or path.stat().st_size == 0]

if missing:
    print("status=BLOCKED_MISSING_ORACLE_ARTIFACTS")
    for item in missing:
        print(f"missing={item}")
    raise SystemExit(2)

(ROOT / "checksums.sha256").write_text(
    "".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(ROOT)}\n" for path in required),
    encoding="utf-8",
)
print("status=READY_FOR_ORACLE_IMPORT")
print("artifacts", len(required))
