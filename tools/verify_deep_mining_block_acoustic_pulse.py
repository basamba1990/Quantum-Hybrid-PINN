from __future__ import annotations

import hashlib
import json
from pathlib import Path
import meshio
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / 'artifacts' / 'deep_mining_block_acoustic_pulse_8frames'
sidecar = json.loads((ROOT / 'sidecar.json').read_text(encoding='utf-8'))
assert sidecar['contractVersion'] == 'cfd-volume.v1'
assert sidecar['eventType'] == 'ABSTRACT_PRESSURE_PULSE'
assert sidecar['solverProduced'] is False
assert sidecar['synthetic'] is True and sidecar['realAsset'] is False
assert sidecar['peakOverpressure'] == 250.0
assert sidecar['boundaryReflectionModel'] == 'one-dimensional rigid-end acoustic reflection surrogate'
assert all(sidecar['residuals'][key] is None for key in ('mass', 'momentum', 'energy'))
assert all(item['indices'] for item in sidecar['boundarySets'])
assert set(sidecar['fieldDescriptors']) == {'temperature', 'pressure', 'velocity', 'gas_concentration', 'leak_indicator', 'wavefront_indicator', 'region_id'}

frames = []
for frame in sidecar['frames']:
    path = ROOT / frame['file']
    payload = path.read_bytes()
    assert hashlib.sha256(payload).hexdigest() == frame['payloadHash']
    mesh = meshio.read(path, file_format='vtu')
    assert len(mesh.points) == sidecar['pointCount']
    assert sum(len(block.data) for block in mesh.cells) == sidecar['cellCount']
    point_data = {name: np.asarray(values) for name, values in mesh.point_data.items()}
    cell_data = {name: np.concatenate([np.asarray(value) for value in values]) if isinstance(values, list) else np.asarray(values) for name, values in mesh.cell_data.items()}
    assert {'temperature', 'pressure', 'velocity', 'gas_concentration', 'leak_indicator', 'wavefront_indicator'}.issubset(point_data)
    assert 'region_id' in cell_data and len(cell_data['region_id']) == sidecar['cellCount']
    assert point_data['velocity'].shape[1] == 3
    assert all(np.isfinite(values).all() for values in point_data.values())
    assert all(np.isfinite(values).all() for values in cell_data.values())
    frames.append((float(frame['time']), point_data))

first_mesh = meshio.read(ROOT / sidecar['frames'][0]['file'], file_format='vtu')
first_cells = [(block.type, block.data.tolist()) for block in first_mesh.cells]
for frame in sidecar['frames'][1:]:
    mesh = meshio.read(ROOT / frame['file'], file_format='vtu')
    assert [(block.type, block.data.tolist()) for block in mesh.cells] == first_cells
assert len(frames) == 8 and all(a < b for (a, _), (b, _) in zip(frames, frames[1:]))
peak_by_frame = [float(np.max(data['pressure'])) for _, data in frames]
assert max(peak_by_frame) > min(peak_by_frame)
wavefront_by_frame = [float(np.mean(data['wavefront_indicator'])) for _, data in frames]
assert max(wavefront_by_frame) > min(wavefront_by_frame)
print(json.dumps({'status': 'PASS', 'frames': len(frames), 'points': sidecar['pointCount'], 'cells': sidecar['cellCount'], 'peakOverpressurePa': sidecar['peakOverpressure'], 'pressureRangeMPa': [min(peak_by_frame), max(peak_by_frame)], 'wavefrontMeanRange': [min(wavefront_by_frame), max(wavefront_by_frame)], 'eventType': sidecar['eventType'], 'certificationAllowed': False}, indent=2))
