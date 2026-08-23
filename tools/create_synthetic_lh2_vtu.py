from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "artifacts" / "synthetic_lh2_vtu"
OUT.mkdir(parents=True, exist_ok=True)

POINTS = [
    (0.0, 0.0, 0.0),
    (1.0, 0.0, 0.0),
    (1.0, 1.0, 0.0),
    (0.0, 1.0, 0.0),
    (0.0, 0.0, 1.0),
    (1.0, 0.0, 1.0),
    (1.0, 1.0, 1.0),
    (0.0, 1.0, 1.0),
]

# Five tetrahedra fill the unit cube. VTK cell type 10 = tetrahedron.
CELLS = [
    (0, 1, 3, 4),
    (1, 2, 3, 6),
    (1, 3, 4, 6),
    (1, 4, 5, 6),
    (3, 4, 6, 7),
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def vtk_array(name: str, vtk_type: str, values: list[float | int], components: int | None = None) -> str:
    component = f' NumberOfComponents="{components}"' if components else ""
    body = " ".join(str(value) for value in values)
    return f'<DataArray type="{vtk_type}" Name="{name}" format="ascii"{component}>{body}</DataArray>'


def make_vtu(frame_index: int) -> bytes:
    dt = float(frame_index)
    shifted = [(x + 0.01 * dt, y, z) for x, y, z in POINTS]
    point_flat = [value for point in shifted for value in point]
    connectivity = [value for cell in CELLS for value in cell]
    offsets = [4 * (index + 1) for index in range(len(CELLS))]
    types = [10] * len(CELLS)

    temperatures = []
    pressures = []
    velocities = []
    for x, y, z in shifted:
        radius = math.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2 + (z - 0.5) ** 2)
        temperatures.append(20.25 + 0.5 * radius + 0.15 * dt)
        pressures.append(0.12 - 0.01 * x + 0.002 * dt)
        velocities.extend((0.05 * (1.0 - y), 0.02 * x, 0.01 * z + 0.001 * dt))

    xml = f'''<?xml version="1.0"?>
<VTKFile type="UnstructuredGrid" version="0.1" byte_order="LittleEndian">
  <UnstructuredGrid>
    <Piece NumberOfPoints="{len(POINTS)}" NumberOfCells="{len(CELLS)}">
      <PointData>
        {vtk_array("temperature", "Float64", temperatures)}
        {vtk_array("pressure", "Float64", pressures)}
        {vtk_array("velocity", "Float64", velocities, 3)}
      </PointData>
      <CellData>
        {vtk_array("region_id", "Int32", [1, 1, 1, 1, 1])}
      </CellData>
      <Points>
        {vtk_array("Points", "Float64", point_flat, 3)}
      </Points>
      <Cells>
        {vtk_array("connectivity", "Int32", connectivity)}
        {vtk_array("offsets", "Int32", offsets)}
        {vtk_array("types", "UInt8", types)}
      </Cells>
    </Piece>
  </UnstructuredGrid>
</VTKFile>
'''
    return xml.encode("utf-8")


def main() -> None:
    generated_at = datetime.now(timezone.utc).isoformat()
    frame_entries = []
    for index, time_value in enumerate((0.0, 1.0)):
        payload = make_vtu(index)
        path = OUT / f"frame_{index:04d}.vtu"
        path.write_bytes(payload)
        frame_entries.append(
            {
                "frameId": f"synthetic-lh2-{index:04d}",
                "time": time_value,
                "file": path.name,
                "payloadHash": sha256_bytes(payload),
            }
        )

    case_hash = hashlib.sha256(b"synthetic-lh2-vtu-structure-only-v1").hexdigest()
    comparison_hash = hashlib.sha256(b"synthetic-test-no-physical-validation").hexdigest()
    sidecar = {
        "contractVersion": "cfd-volume.v1",
        "meshRevision": "synthetic-lh2-mesh-v1",
        "coordinateSystem": "cartesian-right-handed",
        "lengthUnit": "m",
        "fieldDescriptors": {
            "temperature": {"unit": "K", "quantity": "temperature"},
            "pressure": {"unit": "MPa", "quantity": "pressure"},
            "velocity": {"unit": "m/s", "quantity": "velocity"},
            "region_id": {"unit": "1", "quantity": "cell region identifier"},
        },
        "boundarySets": [
            {"name": "synthetic_boundary", "association": "point", "indices": list(range(8))}
        ],
        "provenance": {
            "solver": "synthetic-structure-generator",
            "solverVersion": "1.0.0",
            "sourceUri": "urn:quantum-hybrid-pinn:test:synthetic-lh2-vtu-v1",
            "sourceHash": case_hash,
            "calculationId": "synthetic-lh2-structure-test-v1",
            "generatedAt": generated_at,
        },
        "residuals": {
            "mass": 0.0,
            "momentum": 0.0,
            "energy": 0.0,
            "norm": "L2",
            "computedBy": "not-a-physical-solver",
            "computedAt": generated_at,
        },
        "references": [
            {
                "id": "test-only",
                "title": "No physical reference — structural parser test only",
                "uri": "https://example.invalid/quantum-hybrid-pinn/synthetic-test",
                "variables": ["temperature", "pressure", "velocity"],
                "comparisonHash": comparison_hash,
            }
        ],
        "evidence": {
            "meshGeometryAndTopology": False,
            "fieldsAndUnits": False,
            "namedBoundaries": False,
            "solverProvenance": False,
            "solverResiduals": False,
            "referenceComparison": False,
            "immutableHashes": False,
            "calculatedTransientStates": False,
        },
        "frames": frame_entries,
        "classification": "SYNTHETIC_STRUCTURE_TEST_NOT_INDUSTRIAL_VALIDATION",
    }
    (OUT / "sidecar.json").write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8")
    (OUT / "README.md").write_text(
        "# Synthetic LH2 VTU structure test\n\n"
        "This archive is intentionally synthetic. It tests XML/VTK topology, field descriptors, "
        "two time frames, interpolation and rejection of certification evidence. It is not a CFD "
        "solution, not a CAO model, and must never be marked VALIDATED.\n",
        encoding="utf-8",
    )
    print(json.dumps({"output": str(OUT), "frames": frame_entries}, indent=2))


if __name__ == "__main__":
    main()
