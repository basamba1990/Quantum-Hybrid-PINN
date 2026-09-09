#!/usr/bin/env python3
"""Build a structural topology report for the synthetic VTU kit.

This report is diagnostic evidence only. It never upgrades the dataset status.
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

import meshio

ROOT = Path(__file__).resolve().parents[1] / "artifacts" / "synthetic_lh2_vtu"
OUT = ROOT / "topology_report.json"

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def main() -> None:
    mesh_path = ROOT / "frame_0000.vtu"
    mesh = meshio.read(mesh_path)
    points = mesh.points.tolist()
    tetra_blocks = [block.data for block in mesh.cells if block.type == "tetra"]
    if not tetra_blocks:
        raise SystemExit("No tetrahedral volume cells found")
    cells = [row.tolist() for block in tetra_blocks for row in block]
    faces: Counter[tuple[int, int, int]] = Counter()
    for cell in cells:
        a, b, c, d = cell
        for face in ((a, b, c), (a, b, d), (a, c, d), (b, c, d)):
            faces[tuple(sorted(face))] += 1
    boundary_faces = sorted(face for face, count in faces.items() if count == 1)
    non_manifold_faces = sorted(face for face, count in faces.items() if count > 2)
    boundary_edges: Counter[tuple[int, int]] = Counter()
    for a, b, c in boundary_faces:
        for edge in ((a, b), (a, c), (b, c)):
            boundary_edges[tuple(sorted(edge))] += 1
    boundary_surface_closed = bool(boundary_faces) and not non_manifold_faces and all(count == 2 for count in boundary_edges.values())
    report = {
        "reportVersion": "synthetic-topology-report.v1",
        "classification": "STRUCTURAL_DIAGNOSTIC_ONLY",
        "tool": "meshio-plus-deterministic-tetra-face-audit",
        "toolVersion": "meshio-runtime",
        "proofType": "VOLUMETRIC_TOPOLOGY_REPORT",
        "sourceFile": mesh_path.name,
        "pointCount": len(points),
        "cellCount": len(cells),
        "cellType": "tetra",
        "uniqueFaceCount": len(faces),
        "boundaryFaceCount": len(boundary_faces),
        "nonManifoldFaceCount": len(non_manifold_faces),
        "boundaryFaces": [list(face) for face in boundary_faces],
        "nonManifoldFaces": [list(face) for face in non_manifold_faces],
        "boundaryEdgeCount": len(boundary_edges),
        "boundarySurfaceClosed": boundary_surface_closed,
        "closedDomain": boundary_surface_closed,
        "limitations": "Synthetic structural diagnostic; this proves only the discrete tetrahedral boundary closure, not physical validity or solver execution.",
    }
    raw = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8") + b"\n"
    OUT.write_bytes(raw)
    print("meshSha256", sha256_bytes(mesh_path.read_bytes()))
    print("reportSha256", sha256_bytes(raw))
    print("boundaryFaceCount", len(boundary_faces))
    print("nonManifoldFaceCount", len(non_manifold_faces))
    print("closedDomain", report["closedDomain"])

if __name__ == "__main__":
    main()
