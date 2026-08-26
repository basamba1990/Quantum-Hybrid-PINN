from __future__ import annotations

import json
import sys
from pathlib import Path

API = Path(__file__).resolve().parents[1] / 'apps' / 'api'
sys.path.insert(0, str(API))
from cfd_import_router import _build_dataset, _parse_vtu, _verify_sidecar  # noqa: E402

ROOT = Path(__file__).resolve().parents[1] / 'artifacts' / 'lh2_reference_design_leak_8frames'
sidecar_bytes = (ROOT / 'sidecar.json').read_bytes()
sidecar = json.loads(sidecar_bytes)
files = {frame['file']: (ROOT / frame['file']).read_bytes() for frame in sidecar['frames']}
_verify_sidecar(sidecar, files)
parsed = [_parse_vtu(files[frame['file']], frame['file'], sidecar['fieldDescriptors']) for frame in sidecar['frames']]
dataset = _build_dataset(sidecar, parsed)
assert dataset['contractVersion'] == 'cfd-volume.v1'
assert dataset['pointCount'] == 14413
assert dataset['cellCount'] == 62720
assert len(dataset['frames']) == 8
assert dataset['residuals']['mass'] is None
assert dataset['classification'] == 'REFERENCE_DESIGN'
print({'status': 'PASS', 'api_parser': 'cfd_import_router', 'frames': len(dataset['frames']), 'points': dataset['pointCount'], 'cells': dataset['cellCount'], 'classification': dataset['classification'], 'certification_allowed': False})
