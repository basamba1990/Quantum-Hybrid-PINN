#!/usr/bin/env python3
"""Assign actual external tetrahedral boundary-face indices to a Gmsh kit."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import meshio
import numpy as np


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    kit = Path("artifacts/lh2_gmsh_g1_import_kit")
    sidecar_path = kit / "sidecar.json"
    sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
    mesh = meshio.read(kit / sidecar["frames"][0]["file"])
    tetra = next(np.asarray(block.data, dtype=np.int64) for block in mesh.cells if block.type == "tetra")
    templates = ((0, 2, 1), (0, 1, 3), (1, 2, 3), (2, 0, 3))
    counts: dict[tuple[int, ...], int] = {}
    for row in tetra:
        for face in templates:
            key = tuple(sorted(int(row[i]) for i in face))
            counts[key] = counts.get(key, 0) + 1
    boundary_faces = sorted(key for key, count in counts.items() if count == 1)
    sidecar["boundarySets"] = [{
        "name": "tank_wall",
        "association": "cell",
        "faceIndexSpace": "external-boundary-face-order-v1",
        "indices": list(range(len(boundary_faces))),
        "faceCount": len(boundary_faces),
    }]
    sidecar["topologyEvidence"]["boundaryFaceAssignment"] = {
        "method": "tetra face incidence; each external face occurs once and receives a stable sorted index",
        "boundaryFaceCount": len(boundary_faces),
        "connectivityFrame": sidecar["frames"][0]["file"],
    }
    sidecar["provenance"]["boundaryAssignmentScript"] = "assign_g1_boundary_faces.py"
    sidecar_path.write_text(json.dumps(sidecar, indent=2), encoding="utf-8")
    lines = []
    for path in sorted(kit.iterdir()):
        if path.is_file() and path.name != "MANIFEST.sha256":
            lines.append(f"{sha256(path)}  {path.name}")
    (kit / "MANIFEST.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"boundaryFaceCount": len(boundary_faces), "sidecarSha256": sha256(sidecar_path)}, indent=2))


if __name__ == "__main__":
    main()
