#!/usr/bin/env python3
"""Vérifie localement le contrat cfd-volume.v1 avant import QuantumPINN."""
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} ARTIFACT_DIR", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()
    metadata = json.loads((root / "sidecar.json").read_text(encoding="utf-8"))
    required = ("boundarySets", "residuals", "references", "evidence", "fieldDescriptors")
    assert metadata.get("contractVersion") == "cfd-volume.v1"
    for key in required:
        assert key in metadata, f"propriété absente: {key}"
    assert len(metadata.get("frames", [])) > 0
    assert len(metadata.get("provenance", {}).get("sourceHash", "")) == 64
    times = []
    for frame in metadata["frames"]:
        path = root / frame["file"]
        payload = path.read_bytes()
        actual = sha256_bytes(payload)
        assert actual == frame["payloadHash"], f"hash invalide: {path.name}"
        times.append(float(frame["time"]))
    assert times == sorted(times) and len(set(times)) == len(times), "temps non croissants"
    # Parseur canonique QuantumPINN : valide la topologie et les champs numériques.
    sys.path.insert(0, str(Path(__file__).parents[4] / "apps" / "api"))
    from cfd_import_router import _parse_vtu
    first = None
    for frame in metadata["frames"]:
        parsed = _parse_vtu((root / frame["file"]).read_bytes(), frame["file"], metadata["fieldDescriptors"])
        if first is None:
            first = parsed
        else:
            assert parsed["cells"] == first["cells"]
            assert parsed["offsets"] == first["offsets"]
            assert parsed["cellTypes"] == first["cellTypes"]
    print(f"OK: {len(metadata['frames'])} frame(s), {first['pointCount']} points, {first['cellCount']} cells")
    print("status attendu après import: STRUCTURAL_TEST_UNVALIDATED")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
