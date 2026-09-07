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


def load_template(path: Path) -> dict:
    if not path.is_file():
        raise SystemExit(f"template sidecar introuvable: {path}")
    metadata = json.loads(path.read_text(encoding="utf-8"))
    required = ("contractVersion", "meshRevision", "fieldDescriptors", "boundarySets", "provenance", "residuals", "references", "evidence")
    missing = [key for key in required if key not in metadata]
    if missing:
        raise SystemExit(f"template sidecar incomplet: {', '.join(missing)}")
    if metadata.get("contractVersion") != "cfd-volume.v1":
        raise SystemExit("contractVersion doit être cfd-volume.v1")
    return metadata


def main() -> int:
    if len(sys.argv) != 4:
        print(f"usage: {sys.argv[0]} SOLVER_OUTPUT_DIR DEST_DIR TEMPLATE_SIDECAR", file=sys.stderr)
        return 2
    source = Path(sys.argv[1]).resolve()
    dest = Path(sys.argv[2]).resolve()
    template = Path(sys.argv[3]).resolve()
    if not source.is_dir():
        raise SystemExit(f"répertoire solveur introuvable: {source}")
    frames = sorted(source.glob("*.vtu"), key=lambda p: (time_from_name(p, 0), p.name))
    if not frames:
        raise SystemExit("aucun fichier .vtu produit par le solveur")
    times = [time_from_name(path, index) for index, path in enumerate(frames)]
    if any(t2 <= t1 for t1, t2 in zip(times, times[1:])):
        raise SystemExit("temps de sortie ambigus ou non strictement croissants")
    sidecar = load_template(template)
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.vtu"):
        old.unlink()
    names = []
    for i, path in enumerate(frames):
        name = f"frame_{i:04d}.vtu"
        shutil.copyfile(path, dest / name)
        names.append((name, times[i], sha256(dest / name)))
    source_manifest = {
        "sourceFiles": [{"name": path.name, "sha256": digest, "time": time} for path, (name, time, digest) in zip(frames, names)],
        "frameCount": len(frames),
    }
    source_hash = hashlib.sha256(json.dumps(source_manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    sidecar["frames"] = [
        {"frameId": f"external-solver-{i:04d}", "time": t, "file": name, "payloadHash": digest}
        for i, (name, t, digest) in enumerate(names)
    ]
    provenance = dict(sidecar.get("provenance") or {})
    provenance["sourceHash"] = source_hash
    provenance["sourceFiles"] = source_manifest["sourceFiles"]
    provenance.pop("solverOutputDirectory", None)
    sidecar["provenance"] = provenance
    sidecar["classification"] = "EXTERNAL_SOLVER_OUTPUT_UNVALIDATED"
    sidecar["scientificStatus"] = "UNVALIDATED"
    sidecar["validationAllowed"] = False
    (dest / "source-manifest.json").write_text(json.dumps(source_manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (dest / "sidecar.json").write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"ingested {len(names)} VTU frame(s) into {dest}")
    print("status: UNVALIDATED")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
