from __future__ import annotations

import hashlib
import json
import math
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'deep_mining_block_acoustic_pulse_8frames'
ZIP = ROOT / 'artifacts' / 'deep_mining_block_acoustic_pulse_8frames.zip'

# Abstract underground-panel control volume. This is not a mine asset and contains
# no explosive-charge, detonation-energy, or initiation parameters.
LX, LY, LZ = 120.0, 30.0, 20.0
NX, NY, NZ = 31, 16, 11
FRAME_TIMES_S = tuple(round(i * 0.1, 6) for i in range(8))
WAVE_SPEED_M_S = 343.0
PEAK_OVERPRESSURE_PA = 250.0
PULSE_WIDTH_M = 4.0
PULSE_ORIGIN_X_M = 12.0
REFLECTION_COEFFICIENT = 0.65


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def pid(i: int, j: int, k: int) -> int:
    return i * NY * NZ + j * NZ + k


def coordinate(i: int, j: int, k: int) -> tuple[float, float, float]:
    return LX * i / (NX - 1), LY * j / (NY - 1), LZ * k / (NZ - 1)


def build_cells() -> tuple[list[tuple[float, float, float]], list[tuple[int, int, int, int]], list[tuple[float, float, float]]]:
    points = [coordinate(i, j, k) for i in range(NX) for j in range(NY) for k in range(NZ)]
    cells: list[tuple[int, int, int, int]] = []
    centers: list[tuple[float, float, float]] = []
    for i in range(NX - 1):
        for j in range(NY - 1):
            for k in range(NZ - 1):
                a, b, c, d = pid(i, j, k), pid(i + 1, j, k), pid(i + 1, j + 1, k), pid(i, j + 1, k)
                e, f, g, h = pid(i, j, k + 1), pid(i + 1, j, k + 1), pid(i + 1, j + 1, k + 1), pid(i, j + 1, k + 1)
                for cell in ((a, b, d, e), (b, c, d, g), (b, d, e, g), (b, e, f, g), (d, e, g, h)):
                    cells.append(cell)
                    centers.append(tuple(sum(points[index][axis] for index in cell) / 4.0 for axis in range(3)))
    return points, cells, centers


def xml_array(name: str, vtk_type: str, values: list[float | int], components: int | None = None) -> str:
    comp = f' NumberOfComponents="{components}"' if components else ''
    body = ' '.join(str(value) for value in values)
    return f'<DataArray type="{vtk_type}" Name="{name}" format="ascii"{comp}>{body}</DataArray>'


def pulse_at(x: float, t: float) -> tuple[float, float]:
    front = PULSE_ORIGIN_X_M + WAVE_SPEED_M_S * t
    incident = PEAK_OVERPRESSURE_PA * math.exp(-((x - front) / PULSE_WIDTH_M) ** 2)
    reflected_front = 2.0 * LX - PULSE_ORIGIN_X_M - WAVE_SPEED_M_S * t
    reflected = REFLECTION_COEFFICIENT * PEAK_OVERPRESSURE_PA * math.exp(-((x - reflected_front) / PULSE_WIDTH_M) ** 2) if reflected_front <= LX + PULSE_WIDTH_M else 0.0
    return incident + reflected, max(incident, reflected)


def make_frame(index: int, points: list[tuple[float, float, float]], cells: list[tuple[int, int, int, int]], centers: list[tuple[float, float, float]]) -> bytes:
    t = FRAME_TIMES_S[index]
    flat_points = [value for point in points for value in point]
    connectivity = [value for cell in cells for value in cell]
    offsets = [4 * (cell_index + 1) for cell_index in range(len(cells))]
    cell_types = [10] * len(cells)
    temperatures: list[float] = []
    pressures: list[float] = []
    velocities: list[float] = []
    gas_concentration: list[float] = []
    leak_indicator: list[float] = []
    wavefront_indicator: list[float] = []

    for x, y, z in points:
        pulse, front = pulse_at(x, t)
        tunnel_profile = math.exp(-((y - LY / 2.0) / 8.5) ** 2 - ((z - LZ / 2.0) / 5.5) ** 2)
        source = math.exp(-(((x - 88.0) / 7.0) ** 2 + ((y - LY / 2.0) / 4.0) ** 2 + ((z - 7.0) / 3.0) ** 2))
        temperature = 298.15 + 3.0 * (z / LZ) + 5.5 * source + 0.4 * pulse / PEAK_OVERPRESSURE_PA
        pressure_mpa = 0.101325 + (0.000095 * (LZ - z)) + pulse / 1_000_000.0
        u = 1.2 * tunnel_profile + 0.18 * pulse / PEAK_OVERPRESSURE_PA
        v = 0.08 * math.sin(0.08 * x - t) * tunnel_profile
        w = 0.04 * math.cos(0.15 * y + t) * tunnel_profile + 0.06 * source
        methane_ppm = 450.0 + 4200.0 * source * (0.5 + 0.5 * t / FRAME_TIMES_S[-1])
        temperatures.append(temperature)
        pressures.append(pressure_mpa)
        velocities.extend((u, v, w))
        gas_concentration.append(methane_ppm)
        leak_indicator.append(source)
        wavefront_indicator.append(front / PEAK_OVERPRESSURE_PA)

    region_ids: list[int] = []
    for x, y, z in centers:
        source = math.exp(-(((x - 88.0) / 10.0) ** 2 + ((y - LY / 2.0) / 6.0) ** 2 + ((z - 7.0) / 4.0) ** 2))
        tunnel = abs(y - LY / 2.0) < 10.0 and abs(z - LZ / 2.0) < 6.0
        if source > 0.18:
            region_ids.append(3)  # abstract gas-source neighborhood
        elif tunnel:
            region_ids.append(2)  # ventilation gallery air region
        elif abs(x - 30.0) < 1.0 or abs(x - 65.0) < 1.0 or abs(x - 100.0) < 1.0:
            region_ids.append(4)  # support/obstacle neighborhood
        else:
            region_ids.append(1)  # surrounding rock-control volume

    xml = f'''<?xml version="1.0"?>
<VTKFile type="UnstructuredGrid" version="0.1" byte_order="LittleEndian">
  <UnstructuredGrid>
    <Piece NumberOfPoints="{len(points)}" NumberOfCells="{len(cells)}">
      <PointData>
        {xml_array("temperature", "Float64", temperatures)}
        {xml_array("pressure", "Float64", pressures)}
        {xml_array("velocity", "Float64", velocities, 3)}
        {xml_array("gas_concentration", "Float64", gas_concentration)}
        {xml_array("leak_indicator", "Float64", leak_indicator)}
        {xml_array("wavefront_indicator", "Float64", wavefront_indicator)}
      </PointData>
      <CellData>{xml_array("region_id", "Int32", region_ids)}</CellData>
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


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    points, cells, centers = build_cells()
    generated_at = datetime.now(timezone.utc).isoformat()
    frame_entries = []
    for index, time_s in enumerate(FRAME_TIMES_S):
        payload = make_frame(index, points, cells, centers)
        filename = f'frame_{index:04d}.vtu'
        (OUT / filename).write_bytes(payload)
        frame_entries.append({'frameId': f'deep-mining-block-acoustic-rd1-{index:04d}', 'time': time_s, 'file': filename, 'payloadHash': sha256(payload)})

    geometry = {
        'classification': 'REFERENCE_DESIGN',
        'assetStatus': 'ENGINEERING_CONCEPT',
        'synthetic': True,
        'realAsset': False,
        'revision': 'deep-mining-block-acoustic-rd1',
        'units': 'SI',
        'geometry': {'domain': 'rectangular underground-panel control volume', 'length_m': LX, 'width_m': LY, 'height_m': LZ, 'galleryCenter_m': [0.0, LY / 2.0, LZ / 2.0]},
        'event': {'eventType': 'PUBLIC_OVERPRESSURE_BENCHMARK', 'sourceProvenance': {'document': 'NIOSH public explosion-pressure design context', 'uri': 'https://stacks.cdc.gov/view/cdc/161327', 'datasetRevision': 'public-context-v1', 'measuredValueUsed': False}, 'arrivalTime_s': 0.0, 'arrivalTimeDefinition': 'pulse reference plane at x=12 m; not a field measurement', 'peakOverpressure_Pa': PEAK_OVERPRESSURE_PA, 'peakOverpressureStatus': 'bounded_synthetic_reference_not_measured', 'uncertainty': {'peakOverpressureRelative': 0.20, 'arrivalTime_s': 0.01, 'interpretation': 'synthetic parameter uncertainty, not measurement confidence'}, 'boundaryReflectionModel': 'one-dimensional rigid-end acoustic reflection surrogate', 'solverProduced': False},
    }
    (OUT / 'geometry_parameters.json').write_text(json.dumps(geometry, indent=2) + '\n', encoding='utf-8')
    sidecar = {
        'contractVersion': 'cfd-volume.v1',
        'meshRevision': 'deep-mining-block-acoustic-rd1-mesh-v1',
        'coordinateSystem': 'cartesian-right-handed',
        'lengthUnit': 'm',
        'pointCount': len(points),
        'cellCount': len(cells),
        'classification': 'REFERENCE_DESIGN',
        'assetStatus': 'ENGINEERING_CONCEPT',
        'synthetic': True,
        'realAsset': False,
        'solverProduced': False,
        'eventType': 'PUBLIC_OVERPRESSURE_BENCHMARK',
        'sourceProvenance': {'document': 'NIOSH public explosion-pressure design context', 'uri': 'https://stacks.cdc.gov/view/cdc/161327', 'datasetRevision': 'public-context-v1', 'scope': 'context for overpressure/reflection terminology only', 'measuredValueUsed': False, 'noExplosiveChargeParameters': True},
        'arrivalTime': 0.0,
        'arrivalTimeDefinition': 'reference plane at x=12 m; not a field measurement',
        'peakOverpressureStatus': 'bounded_synthetic_reference_not_measured',
        'uncertainty': {'peakOverpressureRelative': 0.20, 'arrivalTime_s': 0.01, 'interpretation': 'synthetic parameter uncertainty, not measurement confidence'},
        'peakOverpressure': PEAK_OVERPRESSURE_PA,
        'boundaryReflectionModel': 'one-dimensional rigid-end acoustic reflection surrogate',
        'fieldDescriptors': {
            'temperature': {'unit': 'K', 'quantity': 'temperature', 'association': 'point'},
            'pressure': {'unit': 'MPa', 'quantity': 'absolute pressure including abstract pulse', 'association': 'point'},
            'velocity': {'unit': 'm/s', 'quantity': 'velocity', 'association': 'point', 'components': 3},
            'gas_concentration': {'unit': 'ppm', 'quantity': 'synthetic methane concentration indicator', 'association': 'point'},
            'leak_indicator': {'unit': '1', 'quantity': 'abstract source-region indicator', 'association': 'point'},
            'wavefront_indicator': {'unit': '1', 'quantity': 'normalized acoustic pulse indicator', 'association': 'point'},
            'region_id': {'unit': '1', 'quantity': 'cell region identifier', 'association': 'cell'},
        },
        'boundarySets': [
            {'name': 'ventilation_inlet', 'association': 'point', 'indices': [pid(0, j, k) for j in range(NY) for k in range(NZ)]},
            {'name': 'ventilation_outlet', 'association': 'point', 'indices': [pid(NX - 1, j, k) for j in range(NY) for k in range(NZ)]},
            {'name': 'gallery_walls', 'association': 'point', 'indices': [pid(i, j, k) for i in range(NX) for j in range(NY) for k in range(NZ) if j in (0, NY - 1) or k in (0, NZ - 1)]},
            {'name': 'abstract_source_region', 'association': 'point', 'indices': [pid(i, j, k) for i in range(NX) for j in range(NY) for k in range(NZ) if abs(i * LX / (NX - 1) - 88.0) < 8.0 and abs(j * LY / (NY - 1) - LY / 2.0) < 5.0]},
        ],
        'provenance': {'solver': 'synthetic-reference-generator', 'solverVersion': 'deep-mining-acoustic-rd1', 'sourceUri': 'urn:quantum-hybrid-pinn:reference-design:deep-mining-block-acoustic-rd1', 'sourceHash': sha256((OUT / 'geometry_parameters.json').read_bytes()), 'calculationId': 'abstract-pressure-pulse-not-a-solver-run', 'generatedAt': generated_at},
        'residuals': {'mass': None, 'momentum': None, 'energy': None, 'norm': None, 'computedBy': None, 'computedAt': None},
        'references': [
            {'id': 'NIOSH-VENTILATION', 'title': 'NIOSH Mining Topic: Ventilation Overview', 'uri': 'https://archive.cdc.gov/www_cdc_gov/niosh/mining/topics/ventilation.html', 'variables': ['ventilation', 'methane control'], 'comparisonHash': sha256(b'NIOSH-context-not-validation')},
            {'id': 'NIOSH-METHANE', 'title': 'NIOSH Guidelines for Control and Monitoring of Methane Gas', 'uri': 'https://www.cdc.gov/niosh/engcontrols/ecd/detail159.html', 'variables': ['methane monitoring'], 'comparisonHash': sha256(b'NIOSH-methane-context-not-validation')},
            {'id': 'MSHA-30CFR75D', 'title': '30 CFR Part 75 Subpart D Ventilation', 'uri': 'https://www.ecfr.gov/current/title-30/chapter-I/subchapter-O/part-75/subpart-D', 'variables': ['ventilation plan scope'], 'comparisonHash': sha256(b'MSHA-scope-reference-not-validation')},
        ],
        'evidence': {'meshGeometryAndTopology': True, 'fieldsAndUnits': True, 'namedBoundaries': True, 'solverProvenance': False, 'solverResiduals': False, 'referenceComparison': False, 'immutableHashes': True, 'calculatedTransientStates': False},
        'frames': frame_entries,
        'caseDefinition': {'scenario': 'DEEP_MINING_BLOCK_PUBLIC_OVERPRESSURE_BENCHMARK', 'eventType': 'PUBLIC_OVERPRESSURE_BENCHMARK', 'waveModel': 'low-amplitude compressible acoustic pulse with surrogate rigid-end reflection', 'timeUnit': 's', 'frameCount': len(FRAME_TIMES_S), 'safetyNote': 'Not an explosion model; no charge, detonation energy, initiation, or blast design parameters are present.'},
    }
    (OUT / 'sidecar.json').write_text(json.dumps(sidecar, indent=2) + '\n', encoding='utf-8')
    (OUT / 'README.md').write_text('''# deep_mining_block acoustic pulse RD1\n\nThis is a **synthetic, non-operational, low-amplitude public-overpressure benchmark** for testing volumetric CFD rendering, time animation, pressure-front transport and boundary reflection handling. It is not an explosion model, mine asset, blast design, detonation simulation or safety certification. The cited public document provides context only; no measured pressure trace is copied into this kit.\n\nThe archive contains eight VTU frames with shared tetrahedral connectivity and the fields `temperature` (K), `pressure` (MPa), `velocity` (m/s), `gas_concentration` (ppm), `leak_indicator` (1), `wavefront_indicator` (1), and `region_id` (cell integer).\n\nThe sidecar declares `eventType: PUBLIC_OVERPRESSURE_BENCHMARK`, provenance, arrival time, a bounded synthetic reference overpressure and a surrogate reflection model. Residuals are explicitly null and the correct scientific status is `UNVALIDATED`. No explosive-charge, detonation-energy or initiation parameters are included.\n''', encoding='utf-8')
    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(OUT.iterdir()):
            archive.write(path, path.relative_to(OUT.parent))
    print(json.dumps({'directory': str(OUT), 'zip': str(ZIP), 'points': len(points), 'cells': len(cells), 'frames': len(FRAME_TIMES_S), 'peakOverpressurePa': PEAK_OVERPRESSURE_PA, 'zipSha256': sha256(ZIP.read_bytes())}, indent=2))


if __name__ == '__main__':
    main()
