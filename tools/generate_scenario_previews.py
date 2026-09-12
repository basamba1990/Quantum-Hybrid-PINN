from __future__ import annotations
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "apps/web/public/cfd-demo"


def vtu(points, cells, temperature, pressure, velocity, region_ids):
    connectivity = " ".join(str(i) for cell in cells for i in cell)
    offsets = " ".join(str((i + 1) * 4) for i in range(len(cells)))
    types = " ".join("10" for _ in cells)
    def vector(values):
        return " ".join(str(value) for triple in values for value in triple)
    return f'''<?xml version="1.0"?>
<VTKFile type="UnstructuredGrid" version="0.1" byte_order="LittleEndian">
  <UnstructuredGrid><Piece NumberOfPoints="{len(points)}" NumberOfCells="{len(cells)}">
    <PointData>
      <DataArray type="Float64" Name="temperature" format="ascii">{" ".join(map(str, temperature))}</DataArray>
      <DataArray type="Float64" Name="pressure" format="ascii">{" ".join(map(str, pressure))}</DataArray>
      <DataArray type="Float64" Name="velocity" format="ascii" NumberOfComponents="3">{vector(velocity)}</DataArray>
    </PointData><CellData><DataArray type="Int32" Name="region_id" format="ascii">{" ".join(map(str, region_ids))}</DataArray></CellData>
    <Points><DataArray type="Float64" Name="Points" format="ascii" NumberOfComponents="3">{vector(points)}</DataArray></Points>
    <Cells><DataArray type="Int32" Name="connectivity" format="ascii">{connectivity}</DataArray>
      <DataArray type="Int32" Name="offsets" format="ascii">{offsets}</DataArray>
      <DataArray type="UInt8" Name="types" format="ascii">{types}</DataArray></Cells>
  </Piece></UnstructuredGrid>
</VTKFile>'''


def write_preview(name, points, cells, classification):
    out = ROOT / name
    out.mkdir(parents=True, exist_ok=True)
    for frame, shift in ((0, 0.0), (1, 0.02)):
        moved = [(x + shift, y, z) for x, y, z in points]
        n = len(points)
        payload = vtu(
            moved, cells,
            [20.268 + frame * 0.25 + (i % 3) * 0.01 for i in range(n)],
            [0.101325 + (i % 4) * 0.002 + frame * 0.001 for i in range(n)],
            [(0.05 + frame * 0.01, 0.01 * (i % 2), 0.005 * (i % 3)) for i in range(n)],
            [1 for _ in cells],
        )
        (out / f"frame_{frame:04d}.vtu").write_text(payload + "\n")
    frames = []
    for frame in range(2):
        payload = (out / f"frame_{frame:04d}.vtu").read_bytes()
        frames.append({"frameId": f"{name}-{frame:04d}", "time": float(frame), "file": f"frame_{frame:04d}.vtu", "payloadHash": hashlib.sha256(payload).hexdigest()})
    sidecar = {
        "contractVersion": "cfd-volume.v1", "meshRevision": f"preview-{name}-v1", "coordinateSystem": "cartesian-right-handed", "lengthUnit": "m",
        "fieldDescriptors": {"temperature": {"unit": "K", "quantity": "temperature"}, "pressure": {"unit": "MPa", "quantity": "pressure"}, "velocity": {"unit": "m/s", "quantity": "velocity"}, "region_id": {"unit": "1", "quantity": "cell region identifier"}},
        "boundarySets": [{"name": f"{name}_preview_boundary", "association": "point", "indexSpace": "point-index-space-v1", "indices": list(range(len(points)))}],
        "provenance": {"solver": "scenario-preview-generator", "solverVersion": "1.0.0", "sourceUri": f"urn:quantum-hybrid-pinn:preview:{name}", "sourceHash": "preview-only", "calculationId": f"preview-{name}-v1", "generatedAt": "2026-09-12T00:00:00Z"},
        "residuals": {"mass": None, "momentum": None, "energy": None, "norm": None, "computedBy": None, "computedAt": None},
        "references": [], "evidence": {"meshGeometryAndTopology": False, "fieldsAndUnits": False, "namedBoundaries": False, "solverProvenance": False, "solverResiduals": False, "referenceComparison": False, "immutableHashes": False, "calculatedTransientStates": False}, "frames": frames,
        "classification": classification,
    }
    (out / "sidecar.json").write_text(json.dumps(sidecar, indent=2) + "\n")


# A long cryogenic tank-like prism (distinct from the valve preview).
tank_points = [(x, y, z) for z in (0.0, 1.4) for y in (-0.28, 0.28) for x in (-0.28, 0.28)]
tank_cells = [(0, 1, 2, 4), (1, 3, 2, 7), (1, 2, 4, 7), (2, 4, 6, 7), (1, 4, 5, 7), (4, 5, 6, 7)]
write_preview("lh2-tank-preview", tank_points, tank_cells, "SCENARIO_PREVIEW_NOT_INDUSTRIAL_VALIDATION")

# A compact valve-body-like hub with five-port silhouette.
valve_points = [(-0.45, 0, 0), (0.45, 0, 0), (0, -0.45, 0), (0, 0.45, 0), (0, 0, -0.45), (0, 0, 0.45), (-0.18, -0.18, -0.18), (0.18, -0.18, -0.18), (0, 0.2, 0.0), (0, 0, 0.2)]
valve_cells = [(0, 2, 6, 8), (0, 6, 4, 8), (2, 4, 6, 8), (1, 3, 7, 8), (1, 7, 5, 9), (3, 5, 7, 9), (1, 5, 3, 9)]
write_preview("pccv-valve-preview", valve_points, valve_cells, "SCENARIO_PREVIEW_NOT_INDUSTRIAL_VALIDATION")
print("generated", ROOT / "lh2-tank-preview", ROOT / "pccv-valve-preview")
