from __future__ import annotations

import hashlib
import json
from pathlib import Path
import meshio
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / 'artifacts' / 'lh2_reference_design_leak_8frames'
sidecar = json.loads((ROOT / 'sidecar.json').read_text(encoding='utf-8'))
assert sidecar['contractVersion'] == 'cfd-volume.v1'
assert sidecar['classification'] == 'REFERENCE_DESIGN'
assert sidecar['assetStatus'] == 'ENGINEERING_CONCEPT'
assert sidecar['synthetic'] is True and sidecar['realAsset'] is False
assert sidecar['solverProduced'] is False
assert set(sidecar['fieldDescriptors']) == {'temperature', 'pressure', 'velocity', 'leak_indicator', 'phase_fraction', 'region_id'}
assert all(item['indices'] and max(item['indices']) < sidecar['pointCount'] for item in sidecar['boundarySets'])
assert all(value is not False for value in sidecar['evidence'].values()) is False
assert all(sidecar['residuals'][key] is None for key in ('mass', 'momentum', 'energy'))

parsed = []
for frame in sidecar['frames']:
    path = ROOT / frame['file']
    payload = path.read_bytes()
    assert hashlib.sha256(payload).hexdigest() == frame['payloadHash']
    mesh = meshio.read(path, file_format='vtu')
    point_data = {name: np.asarray(values) for name, values in mesh.point_data.items()}
    cell_data = {}
    for name, values in mesh.cell_data.items():
        cell_data[name] = np.concatenate([np.asarray(value) for value in values]) if isinstance(values, list) else np.asarray(values)
    assert len(mesh.points) == sidecar['pointCount']
    cell_count = sum(len(block.data) for block in mesh.cells)
    assert cell_count == sidecar['cellCount']
    required_point_fields = {'temperature', 'pressure', 'velocity', 'leak_indicator', 'phase_fraction'}
    assert required_point_fields.issubset(point_data)
    assert 'region_id' in cell_data
    assert len(cell_data['region_id']) == sidecar['cellCount']
    assert all(np.isfinite(values).all() for values in point_data.values())
    assert all(np.isfinite(values).all() for values in cell_data.values())
    assert point_data['velocity'].shape[1] == 3
    parsed.append(mesh)

first = parsed[0]
first_cells = [(block.type, block.data.tolist()) for block in first.cells]
assert all(mesh.points.shape == first.points.shape for mesh in parsed)
assert all([(block.type, block.data.tolist()) for block in mesh.cells] == first_cells for mesh in parsed)
assert len(sidecar['frames']) == 8
assert sidecar['frames'][0]['time'] < sidecar['frames'][-1]['time']
print(json.dumps({'status': 'PASS', 'frames': len(parsed), 'points': sidecar['pointCount'], 'cells': sidecar['cellCount'], 'fields': sorted(sidecar['fieldDescriptors']), 'boundarySets': [item['name'] for item in sidecar['boundarySets']], 'classification': sidecar['classification'], 'residuals': sidecar['residuals'], 'zipReady': True}, indent=2))
