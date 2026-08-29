#!/usr/bin/env python3
"""Generate a deterministic analytic 2-D NACA 0012 annular mesh.

This creates a structural mesh artifact only. It does not run a CFD solver,
create physical fields, or claim validation. All physical and discretization
parameters are required on the command line; no silent defaults are used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path


NACA_THICKNESS = 0.12


def naca0012_y(x: float) -> float:
    # Standard NACA 4-digit thickness polynomial for a 0012 profile.
    return 5.0 * NACA_THICKNESS * (
        0.2969 * math.sqrt(max(x, 0.0))
        - 0.1260 * x
        - 0.3516 * x**2
        + 0.2843 * x**3
        - 0.1015 * x**4
    )


def profile_points(surface_points: int, chord: float) -> list[tuple[float, float]]:
    if surface_points < 16 or surface_points % 2:
        raise ValueError("surface-points must be an even integer >= 16")
    result: list[tuple[float, float]] = []
    for i in range(surface_points):
        theta = 2.0 * math.pi * i / surface_points
        xbar = 0.5 * (1.0 + math.cos(theta))
        ybar = math.copysign(naca0012_y(xbar), math.sin(theta))
        result.append((chord * xbar, chord * ybar))
    return result


def ellipse_points(surface_points: int, cx: float, cy: float, rx: float, ry: float) -> list[tuple[float, float]]:
    return [
        (cx + rx * math.cos(2.0 * math.pi * i / surface_points),
         cy + ry * math.sin(2.0 * math.pi * i / surface_points))
        for i in range(surface_points)
    ]


def build_mesh(surface_points: int, layers: int, chord: float, domain_rx: float, domain_ry: float) -> tuple[list[tuple[float, float, float]], list[tuple[int, int, int]], list[int], list[str]]:
    inner = profile_points(surface_points, chord)
    outer = ellipse_points(surface_points, chord / 2.0, 0.0, domain_rx, domain_ry)
    points: list[tuple[float, float, float]] = []
    for layer in range(layers + 1):
        alpha = layer / layers
        for (xi, yi), (xo, yo) in zip(inner, outer):
            points.append(((1.0 - alpha) * xi + alpha * xo, (1.0 - alpha) * yi + alpha * yo, 0.0))

    cells: list[tuple[int, int, int]] = []
    for layer in range(layers):
        a0 = layer * surface_points
        b0 = (layer + 1) * surface_points
        for i in range(surface_points):
            j = (i + 1) % surface_points
            cells.append((a0 + i, b0 + i, b0 + j))
            cells.append((a0 + i, b0 + j, a0 + j))

    wall = list(range(surface_points))
    farfield = list(range(layers * surface_points, (layers + 1) * surface_points))
    return points, cells, wall, farfield


def write_vtu(path: Path, points: list[tuple[float, float, float]], cells: list[tuple[int, int, int]]) -> None:
    connectivity = " ".join(str(value) for cell in cells for value in cell)
    offsets = " ".join(str(3 * (i + 1)) for i in range(len(cells)))
    types = " ".join("5" for _ in cells)  # VTK_TRIANGLE
    coords = " ".join(f"{value:.17g}" for point in points for value in point)
    xml = f'''<?xml version="1.0"?>
<VTKFile type="UnstructuredGrid" version="0.1" byte_order="LittleEndian">
  <UnstructuredGrid>
    <Piece NumberOfPoints="{len(points)}" NumberOfCells="{len(cells)}">
      <Points><DataArray type="Float64" NumberOfComponents="3" format="ascii">{coords}</DataArray></Points>
      <Cells>
        <DataArray type="Int64" Name="connectivity" format="ascii">{connectivity}</DataArray>
        <DataArray type="Int64" Name="offsets" format="ascii">{offsets}</DataArray>
        <DataArray type="UInt8" Name="types" format="ascii">{types}</DataArray>
      </Cells>
    </Piece>
  </UnstructuredGrid>
</VTKFile>
'''
    path.write_text(xml, encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sidecar", type=Path, required=True)
    parser.add_argument("--case-id", required=True)
    parser.add_argument("--calculation-id", required=True)
    parser.add_argument("--generator-version", required=True)
    parser.add_argument("--coordinate-system", required=True)
    parser.add_argument("--length-unit", required=True)
    parser.add_argument("--chord-m", type=float, required=True)
    parser.add_argument("--domain-radius-x-m", type=float, required=True)
    parser.add_argument("--domain-radius-y-m", type=float, required=True)
    parser.add_argument("--surface-points", type=int, required=True)
    parser.add_argument("--layers", type=int, required=True)
    args = parser.parse_args()

    if args.chord_m <= 0 or args.domain_radius_x_m <= 0 or args.domain_radius_y_m <= 0:
        raise SystemExit("chord and domain radii must be positive")
    if args.layers < 1:
        raise SystemExit("layers must be >= 1")

    points, cells, wall, farfield = build_mesh(
        args.surface_points, args.layers, args.chord_m, args.domain_radius_x_m, args.domain_radius_y_m
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.sidecar.parent.mkdir(parents=True, exist_ok=True)
    write_vtu(args.output, points, cells)
    payload_hash = sha256_file(args.output)
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    sidecar = {
        "schema": "pilot-mesh-manifest.v1",
        "case_id": args.case_id,
        "calculation_id": args.calculation_id,
        "contract_version": "cfd-volume.v1",
        "mesh_revision": f"{args.case_id}-analytic-naca0012-v1",
        "coordinate_system": args.coordinate_system,
        "length_unit": args.length_unit,
        "generator": {"name": "generate_naca0012_mesh.py", "version": args.generator_version},
        "geometry": {"type": "NACA4", "code": "0012", "chord_m": args.chord_m},
        "domain": {"type": "ellipse", "radius_x_m": args.domain_radius_x_m, "radius_y_m": args.domain_radius_y_m},
        "discretization": {"surface_points": args.surface_points, "layers": args.layers, "cell_type": "VTK_TRIANGLE"},
        "boundary_sets": [
            {"name": "wall", "association": "point", "indices": wall},
            {"name": "farfield", "association": "point", "indices": farfield},
        ],
        "payload": {"path": args.output.name, "sha256": payload_hash, "bytes": args.output.stat().st_size},
        "provenance": {
            "solver": "analytic_mesh_generator",
            "solver_version": args.generator_version,
            "source_uri": "https://data.nlr.gov/submissions/311",
            "source_hash": payload_hash,
            "calculation_id": args.calculation_id,
            "generated_at": generated_at,
        },
        "evidence": {
            "mesh_geometry_and_topology": True,
            "fields_and_units": False,
            "named_boundaries": True,
            "solver_provenance": False,
            "solver_residuals": False,
            "reference_comparison": False,
            "immutable_hashes": True,
            "calculated_transient_states": False,
        },
        "status": "STRUCTURAL_MESH_GENERATED_NOT_CFD_VALIDATED",
        "physical_validation": "UNAVAILABLE",
        "reference_status": "PENDING_INDEPENDENT_SOLVER_RUN",
        "license_status": "GENERATOR_CODE_ONLY; SOURCE_DATA_LICENSE_REVIEW_REQUIRED",
    }
    args.sidecar.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": sidecar["status"], "payload_sha256": payload_hash, "points": len(points), "cells": len(cells)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
