from __future__ import annotations

import hashlib
import json
import math
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'lh2_reference_design_leak_8frames'
ZIP = ROOT / 'artifacts' / 'lh2_reference_design_leak_8frames.zip'

# Reference-design parameters. These are an engineering concept, not an asset.
VOLUME_TARGET_M3 = 1250.0
RADIUS_M = 4.2
CYLINDER_LENGTH_M = 16.95
TOTAL_LENGTH_M = CYLINDER_LENGTH_M + 2.0 * RADIUS_M
NX, NY, NZ = 29, 25, 25
FRAME_TIMES_S = tuple(round(i * 1.0, 6) for i in range(8))
LEAK_X_M = 0.62 * CYLINDER_LENGTH_M
LEAK_Z_M = 3.75
LEAK_RADIUS_M = 0.18


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def full_id(i: int, j: int, k: int) -> tuple[int, int, int]:
    return i, j, k


def coordinate(i: int, j: int, k: int) -> tuple[float, float, float]:
    x = -RADIUS_M + TOTAL_LENGTH_M * i / (NX - 1)
    y = -RADIUS_M + 2.0 * RADIUS_M * j / (NY - 1)
    z = -RADIUS_M + 2.0 * RADIUS_M * k / (NZ - 1)
    return x, y, z


def build_hexes() -> list[tuple[tuple[int, int, int], ...]]:
    hexes = []
    for i in range(NX - 1):
        for j in range(NY - 1):
            for k in range(NZ - 1):
                _, y, z = coordinate(i, j, k)
                _, y2, z2 = coordinate(i, j + 1, k + 1)
                cy = (y + y2) / 2.0
                cz = (z + z2) / 2.0
                if cy * cy + cz * cz > RADIUS_M * RADIUS_M:
                    continue
                hexes.append((
                    full_id(i, j, k), full_id(i + 1, j, k), full_id(i + 1, j + 1, k), full_id(i, j + 1, k),
                    full_id(i, j, k + 1), full_id(i + 1, j, k + 1), full_id(i + 1, j + 1, k + 1), full_id(i, j + 1, k + 1),
                ))
    return hexes


def compact_tetrahedra(hexes: list[tuple[tuple[int, int, int], ...]]) -> tuple[list[tuple[float, float, float]], list[tuple[int, int, int, int]], list[tuple[float, float, float]]]:
    point_map: dict[tuple[int, int, int], int] = {}
    points: list[tuple[float, float, float]] = []
    cells: list[tuple[int, int, int, int]] = []
    centers: list[tuple[float, float, float]] = []

    def pid(index: tuple[int, int, int]) -> int:
        if index not in point_map:
            point_map[index] = len(points)
            points.append(coordinate(*index))
        return point_map[index]

    for h in hexes:
        a, b, c, d, e, f, g, hh = [pid(item) for item in h]
        tetra = ((a, b, d, e), (b, c, d, g), (b, d, e, g), (b, e, f, g), (d, e, g, hh))
        for cell in tetra:
            cells.append(cell)
            centers.append(tuple(sum(points[index][axis] for index in cell) / 4.0 for axis in range(3)))
    return points, cells, centers


def xml_array(name: str, vtk_type: str, values: list[float | int], components: int | None = None) -> str:
    comp = f' NumberOfComponents="{components}"' if components else ''
    body = ' '.join(str(value) for value in values)
    return f'<DataArray type="{vtk_type}" Name="{name}" format="ascii"{comp}>{body}</DataArray>'


def make_frame(index: int, points: list[tuple[float, float, float]], cells: list[tuple[int, int, int, int]], centers: list[tuple[float, float, float]]) -> bytes:
    t = FRAME_TIMES_S[index]
    flat_points = [value for point in points for value in point]
    connectivity = [value for cell in cells for value in cell]
    offsets = [4 * (cell_index + 1) for cell_index in range(len(cells))]
    cell_types = [10] * len(cells)  # VTK_TETRA
    temperatures: list[float] = []
    pressures: list[float] = []
    velocities: list[float] = []
    leak_indicator: list[float] = []
    phase_fraction: list[float] = []

    for x, y, z in points:
        radial = math.sqrt(y * y + z * z)
        leak_distance = math.sqrt((x - LEAK_X_M) ** 2 + y ** 2 + (z - LEAK_Z_M) ** 2)
        leak = math.exp(-((leak_distance / (LEAK_RADIUS_M * 3.0)) ** 2)) * (0.45 + 0.55 * min(t / FRAME_TIMES_S[-1], 1.0))
        thermal_ramp = 0.35 * (z + RADIUS_M) / (2.0 * RADIUS_M)
        temperature = 20.30 + thermal_ramp + 2.2 * leak + 0.08 * math.sin(0.7 * x - 0.4 * t)
        pressure_mpa = 0.150 - 0.0015 * x / TOTAL_LENGTH_M - 0.0035 * leak + 0.0004 * math.cos(0.5 * x - 0.3 * t)
        radial_factor = max(0.0, 1.0 - radial / RADIUS_M)
        axial = 0.045 * radial_factor * (1.0 + 0.08 * math.sin(t))
        vy = 0.012 * math.sin(0.35 * x + 0.4 * t) + 0.09 * leak * y / max(radial, 0.2)
        vz = 0.018 * math.cos(0.25 * x - 0.3 * t) + 0.48 * leak
        temperatures.append(temperature)
        pressures.append(pressure_mpa)
        velocities.extend((axial, vy, vz))
        leak_indicator.append(leak)
        phase_fraction.append(max(0.0, min(1.0, 0.96 - 0.35 * leak + 0.01 * math.sin(x + t))))

    region_ids: list[int] = []
    for x, y, z in centers:
        radial = math.sqrt(y * y + z * z)
        leak_distance = math.sqrt((x - LEAK_X_M) ** 2 + y ** 2 + (z - LEAK_Z_M) ** 2)
        if leak_distance < LEAK_RADIUS_M * 4.0:
            region_ids.append(5)  # leak neighborhood
        elif any(abs(x - baffle_x) < 0.22 for baffle_x in (3.4, 8.5, 13.6)):
            region_ids.append(4)  # anti-roll baffle neighborhood
        elif radial > RADIUS_M * 0.92:
            region_ids.append(3)  # wall-adjacent fluid layer
        elif z > 1.3:
            region_ids.append(2)  # vapor/headspace region
        else:
            region_ids.append(1)  # bulk liquid region

    xml = f'''<?xml version="1.0"?>
<VTKFile type="UnstructuredGrid" version="0.1" byte_order="LittleEndian">
  <UnstructuredGrid>
    <Piece NumberOfPoints="{len(points)}" NumberOfCells="{len(cells)}">
      <PointData>
        {xml_array("temperature", "Float64", temperatures)}
        {xml_array("pressure", "Float64", pressures)}
        {xml_array("velocity", "Float64", velocities, 3)}
        {xml_array("leak_indicator", "Float64", leak_indicator)}
        {xml_array("phase_fraction", "Float64", phase_fraction)}
      </PointData>
      <CellData>
        {xml_array("region_id", "Int32", region_ids)}
      </CellData>
      <Points>{xml_array("Points", "Float64", flat_points, 3)}</Points>
      <Cells>
        {xml_array("connectivity", "Int32", connectivity)}
        {xml_array("offsets", "Int32", offsets)}
        {xml_array("types", "UInt8", cell_types)}
      </Cells>
    </Piece>
  </UnstructuredGrid>
</VTKFile>
'''
    return xml.encode('utf-8')


def write_geometry() -> None:
    params = {
        'classification': 'REFERENCE_DESIGN',
        'assetStatus': 'ENGINEERING_CONCEPT',
        'synthetic': True,
        'realAsset': False,
        'revision': 'lh2-reference-tank-rd1',
        'units': 'SI',
        'nominalCapacity_m3': VOLUME_TARGET_M3,
        'geometry': {
            'orientation': 'horizontal',
            'innerVessel': 'cylindrical shell with hemispherical conceptual end closures',
            'innerRadius_m': RADIUS_M,
            'straightCylinderLength_m': CYLINDER_LENGTH_M,
            'overallLength_m': TOTAL_LENGTH_M,
            'estimatedGeometricVolume_m3': round(math.pi * RADIUS_M ** 2 * CYLINDER_LENGTH_M + 4.0 / 3.0 * math.pi * RADIUS_M ** 3, 3),
            'outerInsulationEnvelope': 'conceptual double-wall vacuum-jacket envelope; not meshed as a solid',
            'antiRollBaffles': [3.4, 8.5, 13.6],
            'dipTube': {'axis': 'x', 'inletX_m': -RADIUS_M + 0.6, 'outletX_m': RADIUS_M + CYLINDER_LENGTH_M - 0.6},
            'leakOrifice': {'x_m': LEAK_X_M, 'y_m': 0.0, 'z_m': LEAK_Z_M, 'radius_m': LEAK_RADIUS_M, 'representation': 'localized volumetric source region; not a calibrated orifice model'},
        },
        'assumptions': [
            'Single connected fluid volume represented by tetrahedral cells.',
            'Conceptual double-wall storage vessel; wall and insulation are not solid-mechanics results.',
            'The leak field is manufactured for renderer and contract tests and is not a solver solution.',
            'Temperature and pressure ranges are chosen near LH2 operating conditions for a structural demonstration only.',
            'No claim is made about a real plant, certified equipment, code compliance, or experimental agreement.',
        ],
        'sourceBasis': [
            {'id': 'NIST-SRD69', 'title': 'NIST Chemistry WebBook, Thermophysical Properties of Fluid Systems', 'uri': 'https://webbook.nist.gov/chemistry/fluid/'},
            {'id': 'NASA-TM-2006-214346', 'title': 'Review of Current State of the Art and Key Design Issues With Potential Solutions for Liquid Hydrogen Cryogenic Storage Tank Structures', 'uri': 'https://ntrs.nasa.gov/api/citations/20060056194/downloads/20060056194.pdf'},
            {'id': 'NFPA-2', 'title': 'NFPA 2 Hydrogen Technologies Code scope reference', 'uri': 'https://www.nfpa.org/product/nfpa-2-hydrogen-technologies-code/p0002code'},
        ],
    }
    (OUT / 'geometry_parameters.json').write_text(json.dumps(params, indent=2) + '\n', encoding='utf-8')
    (OUT / 'reference_design.scad').write_text(f'''// LH2 reference design RD1 — conceptual parametric geometry only.
// Units: millimetres in OpenSCAD. Classification: REFERENCE_DESIGN / ENGINEERING_CONCEPT.
// Not a real asset, not a certified design, and not a solver result.
$fn = 96;
R = {RADIUS_M * 1000:.3f};
L = {CYLINDER_LENGTH_M * 1000:.3f};
BaffleX = [{3.4 * 1000:.1f}, {8.5 * 1000:.1f}, {13.6 * 1000:.1f}];

module vessel_shell() {{
  rotate([0,90,0]) cylinder(h=L, r=R, center=true);
  translate([-L/2,0,0]) sphere(R);
  translate([ L/2,0,0]) sphere(R);
}}

module anti_roll_baffle(x) {{
  translate([x,0,0]) rotate([0,90,0]) difference() {{
    cylinder(h=35, r=R*0.91, center=true);
    cylinder(h=45, r=R*0.52, center=true);
  }}
}}

module dip_tube() {{
  translate([-L/2+600,0,-R*0.55]) rotate([0,90,0]) cylinder(h=L-1200, r=42, center=false);
}}

module leak_orifice() {{
  translate([{LEAK_X_M * 1000:.2f},0,{LEAK_Z_M * 1000:.2f}]) rotate([0,90,0]) cylinder(h=240, r={LEAK_RADIUS_M * 1000:.2f}, center=true);
}}

// Exploded conceptual solids for design documentation.
color("lightsteelblue", 0.35) vessel_shell();
for (x = BaffleX) color("orange", 0.55) anti_roll_baffle(x);
color("silver", 0.9) dip_tube();
color("red", 0.9) leak_orifice();
''', encoding='utf-8')


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    hexes = build_hexes()
    points, cells, centers = compact_tetrahedra(hexes)
    generated_at = datetime.now(timezone.utc).isoformat()
    frame_entries = []
    for index, time_s in enumerate(FRAME_TIMES_S):
        payload = make_frame(index, points, cells, centers)
        filename = f'frame_{index:04d}.vtu'
        (OUT / filename).write_bytes(payload)
        frame_entries.append({'frameId': f'lh2-reference-leak-rd1-{index:04d}', 'time': time_s, 'file': filename, 'payloadHash': sha256(payload)})

    write_geometry()
    sidecar = {
        'contractVersion': 'cfd-volume.v1',
        'meshRevision': 'lh2-reference-leak-rd1-mesh-v1',
        'coordinateSystem': 'cartesian-right-handed',
        'lengthUnit': 'm',
        'pointCount': len(points),
        'cellCount': len(cells),
        'classification': 'REFERENCE_DESIGN',
        'assetStatus': 'ENGINEERING_CONCEPT',
        'synthetic': True,
        'realAsset': False,
        'solverProduced': False,
        'fieldDescriptors': {
            'temperature': {'unit': 'K', 'quantity': 'temperature', 'association': 'point', 'description': 'manufactured cryogenic thermal field'},
            'pressure': {'unit': 'MPa', 'quantity': 'absolute pressure', 'association': 'point', 'description': 'manufactured pressure field'},
            'velocity': {'unit': 'm/s', 'quantity': 'velocity', 'association': 'point', 'components': 3, 'description': 'manufactured transient velocity field'},
            'leak_indicator': {'unit': '1', 'quantity': 'dimensionless leak indicator', 'association': 'point'},
            'phase_fraction': {'unit': '1', 'quantity': 'liquid phase fraction', 'association': 'point'},
            'region_id': {'unit': '1', 'quantity': 'cell region identifier', 'association': 'cell'},
        },
        'boundarySets': [
            {'name': 'inner_wall', 'association': 'point', 'indices': [i for i, (_, y, z) in enumerate(points) if abs(math.sqrt(y*y + z*z) - RADIUS_M) < 0.25]},
            {'name': 'inlet_dip_tube', 'association': 'point', 'indices': [i for i, (x, y, z) in enumerate(points) if x < -RADIUS_M + 0.8 and y*y + z*z < 0.25]},
            {'name': 'outlet_dip_tube', 'association': 'point', 'indices': [i for i, (x, y, z) in enumerate(points) if x > TOTAL_LENGTH_M - RADIUS_M - 0.8 and y*y + z*z < 0.25]},
            {'name': 'leak_orifice', 'association': 'point', 'indices': [i for i, (x, y, z) in enumerate(points) if math.sqrt((x-LEAK_X_M)**2 + y*y + (z-LEAK_Z_M)**2) < LEAK_RADIUS_M * 2.5]},
            {'name': 'anti_roll_baffle_01', 'association': 'point', 'indices': [i for i, (x, _, _) in enumerate(points) if abs(x-3.4) < 0.6]},
            {'name': 'anti_roll_baffle_02', 'association': 'point', 'indices': [i for i, (x, _, _) in enumerate(points) if abs(x-8.5) < 0.6]},
            {'name': 'anti_roll_baffle_03', 'association': 'point', 'indices': [i for i, (x, _, _) in enumerate(points) if abs(x-13.6) < 0.6]},
        ],
        'provenance': {
            'solver': 'synthetic-reference-generator',
            'solverVersion': 'lh2-rd1',
            'sourceUri': 'urn:quantum-hybrid-pinn:reference-design:lh2-leak-rd1',
            'sourceHash': sha256((OUT / 'geometry_parameters.json').read_bytes()),
            'calculationId': 'reference-design-not-a-solver-run',
            'generatedAt': generated_at,
        },
        'residuals': {'mass': None, 'momentum': None, 'energy': None, 'norm': None, 'computedBy': None, 'computedAt': None},
        'references': [
            {'id': 'NIST-SRD69', 'title': 'NIST Chemistry WebBook, Thermophysical Properties of Fluid Systems', 'uri': 'https://webbook.nist.gov/chemistry/fluid/', 'variables': ['temperature', 'pressure', 'density', 'viscosity', 'thermal conductivity'], 'comparisonHash': sha256(b'NIST-SRD69-reference-not-a-validation')},
            {'id': 'NASA-TM-2006-214346', 'title': 'NASA LH2 cryogenic storage tank design review', 'uri': 'https://ntrs.nasa.gov/api/citations/20060056194/downloads/20060056194.pdf', 'variables': ['tank geometry', 'insulation', 'penetrations', 'thermal management'], 'comparisonHash': sha256(b'NASA-conceptual-reference-not-a-validation')},
            {'id': 'NFPA-2', 'title': 'NFPA 2 Hydrogen Technologies Code scope reference', 'uri': 'https://www.nfpa.org/product/nfpa-2-hydrogen-technologies-code/p0002code', 'variables': ['hydrogen storage safety scope'], 'comparisonHash': sha256(b'NFPA-scope-reference-not-a-validation')},
        ],
        'evidence': {'meshGeometryAndTopology': True, 'fieldsAndUnits': True, 'namedBoundaries': True, 'solverProvenance': False, 'solverResiduals': False, 'referenceComparison': False, 'immutableHashes': True, 'calculatedTransientStates': False},
        'frames': frame_entries,
        'caseDefinition': {'scenario': 'LH2_STORAGE_LEAK', 'nominalCapacity_m3': VOLUME_TARGET_M3, 'leakModel': 'localized manufactured field', 'timeUnit': 's', 'frameCount': len(FRAME_TIMES_S)},
    }
    (OUT / 'sidecar.json').write_text(json.dumps(sidecar, indent=2) + '\n', encoding='utf-8')
    (OUT / 'README.md').write_text('''# LH2 reference design leak kit — RD1\n\nThis archive is a **synthetic structural and visualization dataset** classified as `REFERENCE_DESIGN` / `ENGINEERING_CONCEPT`. It resembles a horizontal cryogenic storage vessel with a cylindrical body, conceptual hemispherical closures, anti-roll baffle locations, a dip tube, a named leak-orifice region, and eight transient states.\n\nThe VTU files contain real volumetric tetrahedral connectivity and the fields `temperature` (K), `pressure` (MPa), `velocity` (m/s, 3 components), `leak_indicator` (1), `phase_fraction` (1), and `region_id` (cell integer). The fields are deterministic manufactured test data, not output from a physical CFD solver, experiment, or certified plant model.\n\nThe sidecar is the import contract and records hashes, units, named boundaries, design assumptions, references, classification and evidence. Residuals are explicitly null. The correct scientific status is `UNVALIDATED`; the kit must not be used to claim G0–G5 certification.\n''', encoding='utf-8')
    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(OUT.iterdir()):
            archive.write(path, path.relative_to(OUT.parent))
    print(json.dumps({'directory': str(OUT), 'zip': str(ZIP), 'points': len(points), 'cells': len(cells), 'frames': len(FRAME_TIMES_S), 'zipSha256': sha256(ZIP.read_bytes())}, indent=2))


if __name__ == '__main__':
    main()
