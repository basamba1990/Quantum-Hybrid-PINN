import hashlib
import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))

from cfd_import_router import router


ROOT = Path('/tmp/cfdkit/artifacts/synthetic_lh2_vtu')


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_import_accepts_exact_hashes_and_builds_dataset():
    metadata = json.loads((ROOT / 'sidecar.json').read_text(encoding='utf-8'))
    files = []
    for spec in metadata['frames']:
        payload = (ROOT / spec['file']).read_bytes()
        files.append(('vtu_files', (spec['file'], payload, 'application/xml')))
    files.append(('sidecar', ('sidecar.json', json.dumps(metadata).encode(), 'application/json')))
    with patch.dict(os.environ, {'CFD_IMPORT_API_TOKEN': 'test-token'}), patch(
        'cfd_import_router._persist_dataset', return_value='analysis-test'
    ) as persist:
        response = make_client().post(
            '/v2/cfd/import',
            headers={'Authorization': 'Bearer test-token'},
            data={'case_id': 'LH2_TEST', 'owner_id': 'user-test'},
            files=files,
        )
    assert response.status_code == 201, response.text
    assert response.json()['status'] == 'STRUCTURAL_TEST_UNVALIDATED'
    assert response.json()['frameCount'] == 2
    persist.assert_called_once()


def test_import_rejects_tampered_vtu_hash():
    metadata = json.loads((ROOT / 'sidecar.json').read_text(encoding='utf-8'))
    metadata['frames'][0]['payloadHash'] = hashlib.sha256(b'tampered').hexdigest()
    files = []
    for spec in json.loads((ROOT / 'sidecar.json').read_text(encoding='utf-8'))['frames']:
        files.append(('vtu_files', (spec['file'], (ROOT / spec['file']).read_bytes(), 'application/xml')))
    files.append(('sidecar', ('sidecar.json', json.dumps(metadata).encode(), 'application/json')))
    with patch.dict(os.environ, {'CFD_IMPORT_API_TOKEN': 'test-token'}):
        response = make_client().post(
            '/v2/cfd/import',
            headers={'Authorization': 'Bearer test-token'},
            data={'case_id': 'LH2_TEST', 'owner_id': 'user-test'},
            files=files,
        )
    assert response.status_code == 422
    assert 'SHA-256 invalide' in response.json()['detail']
