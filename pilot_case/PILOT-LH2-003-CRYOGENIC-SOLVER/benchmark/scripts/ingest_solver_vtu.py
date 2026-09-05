#!/usr/bin/env python3
"""Transforme un répertoire de VTU produit par un solveur en paquet cfd-volume.v1."""
from __future__ import annotations
import hashlib, json, re, shutil, sys
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def time_from_name(path: Path, index: int) -> float:
    match = re.search(r"(?:time|frame|step)[_-]?([0-9]+(?:\.[0-9]+)?)", path.stem, re.I)
    return float(match.group(1)) if match else float(index)


def main() -> int:
    if len(sys.argv) not in (3, 4):
        print(f"usage: {sys.argv[0]} SOLVER_OUTPUT_DIR DEST_DIR [TEMPLATE_SIDECAR]", file=sys.stderr)
        return 2
    source = Path(sys.argv[1]).resolve()
    dest = Path(sys.argv[2]).resolve()
    template = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else None
    frames = sorted(source.glob("*.vtu"), key=lambda p: (time_from_name(p, 0), p.name))
    if not frames:
        raise SystemExit("aucun fichier .vtu produit par le solveur")
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.vtu"):
        old.unlink()
    names = []
    for i, path in enumerate(frames):
        name = f"frame_{i:04d}.vtu"
        shutil.copyfile(path, dest / name)
        names.append((name, time_from_name(path, i)))
    if template and template.exists():
        sidecar = json.loads(template.read_text(encoding="utf-8"))
    else:
        sidecar = {
            "contractVersion": "cfd-volume.v1",
            "meshRevision": "external-solver-mesh",
            "coordinateSystem": "cartesian-right-handed",
            "lengthUnit": "m",
            "fieldDescriptors": {},
            "boundarySets": [],
            "provenance": {},
            "residuals": {},
            "references": [],
            "evidence": {},
        }
    sidecar["frames"] = [
        {"frameId": f"external-solver-{i:04d}", "time": t, "file": name, "payloadHash": sha256(dest / name)}
        for i, (name, t) in enumerate(names)
    ]
    sidecar.setdefault("provenance", {})["sourceHash"] = sha256(dest / names[0][0])
    sidecar["provenance"]["solverOutputDirectory"] = str(source)
    sidecar["classification"] = "EXTERNAL_SOLVER_OUTPUT_UNVALIDATED"
    sidecar["scientificStatus"] = "UNVALIDATED"
    sidecar["validationAllowed"] = False
    (dest / "sidecar.json").write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"ingested {len(names)} VTU frame(s) into {dest}")
    print("status: UNVALIDATED")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
