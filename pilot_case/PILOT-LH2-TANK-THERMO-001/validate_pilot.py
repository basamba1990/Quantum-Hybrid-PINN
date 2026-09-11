from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
required = [ROOT / "required_artifacts" / name for name in MANIFEST["required_artifacts"]]
missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file() or path.stat().st_size == 0]

if missing:
    print("status=BLOCKED_MISSING_ORACLE_ARTIFACTS")
    for item in missing:
        print(f"missing={item}")
    raise SystemExit(2)

checksums = []
for path in required:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    checksums.append(f"{digest}  {path.relative_to(ROOT)}")
(ROOT / "checksums.sha256").write_text("\n".join(checksums) + "\n", encoding="utf-8")
print("status=READY_FOR_ORACLE_IMPORT")
print("artifacts", len(required))
