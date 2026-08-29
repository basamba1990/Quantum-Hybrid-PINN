#!/usr/bin/env python3
"""Convert the generated analytic VTU mesh to native SU2 format.

The converter reads only the VTU points/cells and the sidecar boundary indices.
It never creates cells, points or boundaries that are not present in the input.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def parse_vtu(path: Path):
    text = path.read_text(encoding="utf-8")
    def named_array(name: str) -> list[int]:
        match = re.search(rf'<DataArray[^>]*Name="{name}"[^>]*>(.*?)</DataArray>', text, re.S)
        if not match:
            raise ValueError(f"VTU array not found: {name}")
        return [int(v) for v in match.group(1).split()]
    points_match = re.search(r'<Points>\s*<DataArray[^>]*>(.*?)</DataArray>\s*</Points>', text, re.S)
    if not points_match:
        raise ValueError("VTU points array not found")
    points = [float(v) for v in points_match.group(1).split()]
    conn = named_array("connectivity")
    offsets = named_array("offsets")
    types = named_array("types")
    if len(points) % 3 != 0 or len(conn) != len(offsets) * 3 or any(t != 5 for t in types):
        raise ValueError("only triangular 3-D embedded VTU meshes are supported")
    cells = [tuple(conn[i:i+3]) for i in range(0, len(conn), 3)]
    return [tuple(points[i:i+3]) for i in range(0, len(points), 3)], cells


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vtu", type=Path, required=True)
    parser.add_argument("--sidecar", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    points, cells = parse_vtu(args.vtu)
    sidecar = json.loads(args.sidecar.read_text(encoding="utf-8"))
    markers = sidecar.get("boundary_sets")
    if not isinstance(markers, list) or len(markers) < 2:
        raise ValueError("sidecar must declare at least two boundary sets")
    marker_nodes = {}
    for marker in markers:
        name = marker.get("name")
        indices = marker.get("indices")
        if not isinstance(name, str) or not name or not isinstance(indices, list) or len(indices) < 2:
            raise ValueError("invalid boundary set")
        if any(not isinstance(i, int) or i < 0 or i >= len(points) for i in indices):
            raise ValueError(f"boundary indices out of range: {name}")
        marker_nodes[name] = indices
    args.output.parent.mkdir(parents=True, exist_ok=True)
    lines = ["NDIME= 2", f"NELEM= {len(cells)}"]
    lines.extend(f"5 {a} {b} {c} {i}" for i, (a, b, c) in enumerate(cells))
    lines.append(f"NPOIN= {len(points)}")
    lines.extend(f"{x:.17g} {y:.17g} {i}" for i, (x, y, _z) in enumerate(points))
    lines.append(f"NMARK= {len(marker_nodes)}")
    for name, indices in marker_nodes.items():
        lines.append(f"MARKER_TAG= {name}")
        edges = [(indices[i], indices[(i + 1) % len(indices)]) for i in range(len(indices))]
        lines.append(f"MARKER_ELEMS= {len(edges)}")
        lines.extend(f"3 {a} {b}" for a, b in edges)
    args.output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"status": "SU2_MESH_WRITTEN", "points": len(points), "cells": len(cells), "markers": list(marker_nodes), "output": str(args.output)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
