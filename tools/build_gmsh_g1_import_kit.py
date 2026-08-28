#!/usr/bin/env python3
"""Build an importable 8-frame synthetic kit from a closed Gmsh volume mesh."""
from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import meshio
import numpy as np


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    source_dir = Path("artifacts/gmsh_g1_lh2_reference")
    source_msh = source_dir / "lh2_reference_closed_volume.msh"
    out = Path("artifacts/lh2_gmsh_g1_import_kit")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    base = meshio.read(source_msh)
    points = np.asarray(base.points, dtype=np.float64)
    center = points.mean(axis=0)
    radius = np.linalg.norm(points - center, axis=1)
    tetra = next((np.asarray(block.data, dtype=np.int64) for block in base.cells if block.type == "tetra"), None)
    if tetra is None:
        raise RuntimeError("Gmsh mesh has no tetra cells")
    cells = [("tetra", tetra)]
    cell_region = np.ones(len(tetra), dtype=np.int32)
    face_templates = ((0, 2, 1), (0, 1, 3), (1, 2, 3), (2, 0, 3))
    face_owner: dict[tuple[int, ...], list[int]] = {}
    for cell_index, row in enumerate(tetra):
        for face in face_templates:
            key = tuple(sorted(int(row[i]) for i in face))
            face_owner.setdefault(key, []).append(cell_index)
    external_faces = [key for key, owners in face_owner.items() if len(owners) == 1]
    boundary_cell_indices = sorted({face_owner[key][0] for key in external_faces})
    frame_specs = []
    for index in range(8):
        time_s = index * 0.25
        pulse = np.exp(-((radius - radius.mean() - 0.18 * index) ** 2) / 0.8)
        temp = (20.3 + 0.015 * index + 0.02 * pulse).astype(np.float64)
        pressure = (0.12 + 0.002 * index + 0.004 * pulse).astype(np.float64)
        velocity = np.column_stack((0.08 + 0.01 * pulse, 0.01 * np.sin(points[:, 2] + index), 0.01 * np.cos(points[:, 0] - index)))
        name = f"frame_{index:04d}.vtu"
        meshio.write(out / name, meshio.Mesh(points, cells, point_data={"temperature": temp, "pressure": pressure, "velocity": velocity}, cell_data={"region_id": [cell_region]}), file_format="vtu")
        frame_specs.append({"frameId": f"t{index:04d}", "time": time_s, "file": name, "payloadHash": sha256(out / name)})
    sidecar = {
        "contractVersion": "cfd-volume.v1",
        "meshRevision": "lh2-gmsh-g1-reference-v1",
        "coordinateSystem": "cartesian-right-handed",
        "lengthUnit": "m",
        "pointCount": int(len(points)),
        "cellCount": int(len(tetra)),
        "classification": "REFERENCE_DESIGN",
        "assetStatus": "ENGINEERING_CONCEPT",
        "synthetic": True,
        "realAsset": False,
        "solverProduced": False,
        "fieldDescriptors": {
            "temperature": {"unit": "K", "quantity": "temperature", "association": "point"},
            "pressure": {"unit": "MPa", "quantity": "absolute pressure synthetic reference", "association": "point"},
            "velocity": {"unit": "m/s", "quantity": "velocity", "association": "point", "components": 3},
            "region_id": {"unit": "1", "quantity": "cell region identifier", "association": "cell"},
        },
        "boundarySets": [{"name": "tank_wall", "association": "cell", "indexSpace": "cell-index-space-v1", "indices": boundary_cell_indices, "cellCount": len(boundary_cell_indices)}],
        "provenance": {"solver": "Gmsh mesher (no CFD solver)", "solverVersion": "4.15.2", "sourceUri": "https://gmsh.info/doc/texinfo/", "sourceHash": sha256(source_msh), "calculationId": "lh2-gmsh-reference-v1", "generator": "Gmsh 4.15.2 + meshio", "generatedAt": datetime.now(timezone.utc).isoformat()},
        "residuals": {},
        "references": [{"id": "gmsh-topology-report-v1", "title": "Gmsh structural topology report", "uri": "https://gmsh.info/doc/texinfo/", "variables": ["geometry", "topology", "mesh"], "comparisonHash": sha256(source_dir / "topology_check.json")}],
        "evidence": {"meshGeometryAndTopology": True, "fieldsAndUnits": True, "namedBoundaries": True, "solverProvenance": False, "solverResiduals": False, "referenceComparison": False, "immutableHashes": True, "calculatedTransientStates": False},
        "topologyEvidence": {
            "closedDomain": True,
            "proofType": "CLOSED_VOLUME_BOUNDARY_CHECK",
            "method": "Gmsh OpenCASCADE boundary-curve incidence check",
            "tool": "Gmsh",
            "toolVersion": "4.15.2",
            "kernel": "OpenCASCADE",
            "meshFile": source_msh.name,
            "meshSha256": sha256(source_msh),
            "reportFile": "topology_check.json",
            "reportSha256": sha256(source_dir / "topology_check.json"),
            "limitations": "Structural reference proof only; no solver run or experimental validation."
        },
        "frames": frame_specs,
    }
    (out / "sidecar.json").write_text(json.dumps(sidecar, indent=2), encoding="utf-8")
    shutil.copy2(source_dir / "topology_check.json", out / "topology_check.json")
    shutil.copy2(source_dir / "lh2_reference_closed_volume.brep", out / "lh2_reference_closed_volume.brep")
    (out / "PROVENANCE.md").write_text("# LH2 Gmsh G1 reference kit\n\nSynthetic reference design. Generated from a closed OpenCASCADE cylinder with Gmsh 4.15.2. No solver run, no experimental data and no industrial validation are claimed.\n", encoding="utf-8")
    manifest_lines = []
    for path in sorted(out.iterdir()):
        if path.is_file() and path.name != "MANIFEST.sha256":
            manifest_lines.append(f"{sha256(path)}  {path.name}")
    (out / "MANIFEST.sha256").write_text("\n".join(manifest_lines) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(out), "frames": len(frame_specs), "points": len(points), "cells": len(tetra), "sidecarSha256": sha256(out / "sidecar.json")}, indent=2))


if __name__ == "__main__":
    main()
