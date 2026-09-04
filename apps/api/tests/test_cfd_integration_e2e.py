import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))
import cfd_import_router as cfd

ROOT = Path(__file__).resolve().parents[3] / "artifacts" / "synthetic_lh2_vtu"
PROJECT_ID = "11111111-1111-4111-8111-111111111111"
OWNER_ID = "22222222-2222-4222-8222-222222222222"
ANALYSIS_ID = "33333333-3333-4333-8333-333333333333"


class FakeStorageBucket:
    def __init__(self, parent):
        self.parent = parent

    def upload(self, path, content, options=None):
        self.parent.objects[path] = content
        return {"path": path}

    def download(self, path):
        return self.parent.objects[path]

    def remove(self, paths):
        for path in paths:
            self.parent.objects.pop(path, None)
        return {"removed": paths}


class FakeStorage:
    def __init__(self):
        self.objects = {}

    def from_(self, bucket):
        assert bucket == "cfd-artifacts"
        return FakeStorageBucket(self)


class FakeTable:
    def __init__(self, client, name):
        self.client, self.name, self.filters = client, name, []

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args):
        return self

    def insert(self, row):
        self.client.row = row
        return self

    def execute(self):
        if self.name == "projects":
            return type("Response", (), {"data": [{"id": PROJECT_ID, "user_id": OWNER_ID}]})()
        if self.name == "analyses":
            return type("Response", (), {"data": [{"id": ANALYSIS_ID}]})()
        if self.name == "cfd_datasets" and self.client.row:
            return type("Response", (), {"data": [self.client.row]})()
        return type("Response", (), {"data": []})()


class FakeSupabase:
    def __init__(self):
        self.storage = FakeStorage()
        self.row = None

    def table(self, name):
        return FakeTable(self, name)


def test_full_multipart_import_then_latest_and_no_analysis():
    app = FastAPI()
    app.include_router(cfd.router)
    client = FakeSupabase()
    metadata = json.loads((ROOT / "sidecar.json").read_text(encoding="utf-8"))
    files = [
        ("vtu_files", (spec["file"], (ROOT / spec["file"]).read_bytes(), "application/xml"))
        for spec in metadata["frames"]
    ]
    files.append(("sidecar", ("sidecar.json", json.dumps(metadata).encode(), "application/json")))
    form = {"case_id": "LH2_TEST", "project_id": PROJECT_ID, "owner_id": OWNER_ID, "analysis_id": ANALYSIS_ID}

    with patch.dict(os.environ, {"CFD_IMPORT_API_TOKEN": "test-token", "CFD_ARTIFACT_BUCKET": "cfd-artifacts", "SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "test-key"}), patch.object(cfd, "_supabase", return_value=client):
        response = TestClient(app).post("/v2/cfd/import", headers={"Authorization": "Bearer test-token"}, data=form, files=files)
        assert response.status_code == 201, response.text
        payload = response.json()
        assert payload["analysisId"] == ANALYSIS_ID
        assert payload["projectId"] == PROJECT_ID
        assert client.row["analysis_id"] == ANALYSIS_ID
        assert client.row["project_id"] == PROJECT_ID
        assert client.row["owner_id"] == OWNER_ID
        assert client.row["case_id"] == "LH2_TEST"
        assert client.row["mesh_hash"]
        assert client.row["contract_hash"]
        assert len(client.row["frame_hashes"]) == len(metadata["frames"])

        latest = TestClient(app).get(f"/v2/cfd/project/{PROJECT_ID}/latest?owner_id={OWNER_ID}", headers={"Authorization": "Bearer test-token"})
        assert latest.status_code == 200, latest.text
        latest_payload = latest.json()
        assert latest_payload["status"] == "STRUCTURAL_TEST_UNVALIDATED"
        assert latest_payload["analysis"]["id"] == ANALYSIS_ID
        assert latest_payload["dataset"]["contractVersion"] == "cfd-volume.v1"

        client.row = None
        no_analysis = TestClient(app).get(f"/v2/cfd/project/{PROJECT_ID}/latest?owner_id={OWNER_ID}", headers={"Authorization": "Bearer test-token"})
        assert no_analysis.status_code == 200
        assert no_analysis.json() == {"status": "NO_ANALYSIS", "analysis": None, "dataset": None}
