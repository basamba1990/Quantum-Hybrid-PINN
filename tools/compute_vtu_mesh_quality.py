#!/usr/bin/env python3
"""Compute auditable volumetric quality metrics for a VTU tetrahedral mesh.

Definitions used here are explicit and reproducible:
- volume: absolute tetrahedron volume in m^3;
- jacobian: absolute determinant of the physical tetrahedron mapping matrix;
- skewness: max normalized deviation of triangular face angles from 60 degrees,
  using max((theta-60)/(180-60), (60-theta)/60), clipped to [0, 1].

This is a structural mesh-quality report, not CFD validation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Iterable

import meshio
import numpy as np

IDEAL_FACE_ANGLE_DEG = 60.0

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def tetra_volume_and_jacobian(points: np.ndarray) -> tuple[float, float]:
    a, b, c, d = points
    jac = float(np.linalg.det(np.stack((b - a, c - a, d - a), axis=1)))
    return abs(jac) / 6.0, abs(jac)

def angle_deg(u: np.ndarray, v: np.ndarray) -> float:
    denom = float(np.linalg.norm(u) * np.linalg.norm(v))
    if denom <= 0.0:
        return float("nan")
    cosine = float(np.dot(u, v) / denom)
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine))))

def tetra_face_angles(points: np.ndarray) -> list[float]:
    angles: list[float] = []
    for i, j, k in ((0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)):
        p, q, r = points[i], points[j], points[k]
        angles.extend((angle_deg(q - p, r - p), angle_deg(p - q, r - q), angle_deg(p - r, q - r)))
    return angles

def skewness_from_angles(angles: Iterable[float]) -> float:
    values = list(angles)
    if not values or not all(math.isfinite(value) for value in values):
        return float("nan")
    deviations = []
    for theta in values:
        if theta >= IDEAL_FACE_ANGLE_DEG:
            deviations.append((theta - IDEAL_FACE_ANGLE_DEG) / (180.0 - IDEAL_FACE_ANGLE_DEG))
        else:
            deviations.append((IDEAL_FACE_ANGLE_DEG - theta) / IDEAL_FACE_ANGLE_DEG)
    return max(0.0, min(1.0, max(deviations)))

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("vtu", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    mesh = meshio.read(args.vtu)
    tetra_blocks = [block.data for block in mesh.cells if block.type == "tetra"]
    if not tetra_blocks:
        raise SystemExit("No tetra cells found")
    cells = np.concatenate(tetra_blocks, axis=0).astype(int)
    volumes: list[float] = []
    jacobians: list[float] = []
    skewnesses: list[float] = []
    degenerate = 0
    negative_or_zero = 0
    for cell in cells:
        tetra = np.asarray(mesh.points[cell], dtype=float)
        signed_jacobian = float(np.linalg.det(np.stack((tetra[1] - tetra[0], tetra[2] - tetra[0], tetra[3] - tetra[0]), axis=1)))
        volume = abs(signed_jacobian) / 6.0
        volumes.append(volume)
        jacobians.append(abs(signed_jacobian))
        skewnesses.append(skewness_from_angles(tetra_face_angles(tetra)))
        if volume <= 1e-15:
            degenerate += 1
        if signed_jacobian <= 0.0:
            negative_or_zero += 1

    report = {
        "reportVersion": "volumetric-mesh-quality.v1",
        "classification": "STRUCTURAL_MESH_QUALITY_ONLY",
        "tool": "compute_vtu_mesh_quality.py",
        "toolVersion": "1.0.0",
        "sourceFile": args.vtu.name,
        "meshSha256": sha256_bytes(args.vtu.read_bytes()),
        "pointCount": int(len(mesh.points)),
        "cellCount": int(len(cells)),
        "cellTypes": {"tetra": int(len(cells))},
        "degenerateCellCount": degenerate,
        "negativeVolumeCellCount": negative_or_zero,
        "zeroVolumeCellCount": sum(volume <= 1e-15 for volume in volumes),
        "minCellVolumeM3": min(volumes),
        "maxCellVolumeM3": max(volumes),
        "minJacobian": min(jacobians),
        "maxJacobian": max(jacobians),
        "maxSkewness": max(skewnesses),
        "minSkewness": min(skewnesses),
        "skewnessDefinition": "max normalized triangular-face-angle deviation from ideal 60 degrees; see script docstring",
        "validated": degenerate == 0 and negative_or_zero == 0 and all(math.isfinite(value) for value in (*volumes, *jacobians, *skewnesses)),
        "limitations": "Structural tetrahedral quality only; no CFD solver execution, physical validation, convergence proof, or industrial certification.",
    }
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
