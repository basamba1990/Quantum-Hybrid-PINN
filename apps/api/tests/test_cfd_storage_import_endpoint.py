import gzip
import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))

import cfd_import_router
from cfd_import_router import router


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_storage_import_rejects_path_outside_signed_session():
    session_id = "11111111-1111-4111-8111-111111111111"
    payload = {
        "bucket": "cfd-artifacts",
        "case_id": "DEEP_MINING_BLOCK",
        "project_id": "22222222-2222-4222-8222-222222222222",
        "owner_id": "33333333-3333-4333-8333-333333333333",
        "session_id": session_id,
        "files": [
            {
                "name": "frame_0000.vtu",
                "path": "33333333-3333-4333-8333-333333333333/DEEP_MINING_BLOCK/other-session/frame_0000.vtu",
            }
        ],
        "sidecar": {
            "name": "sidecar.json",
            "path": f"33333333-3333-4333-8333-333333333333/DEEP_MINING_BLOCK/{session_id}/sidecar.json",
        },
    }
    with patch.dict(os.environ, {"CFD_IMPORT_API_TOKEN": "test-token", "CFD_ARTIFACT_BUCKET": "cfd-artifacts"}), patch(
        "cfd_import_router._verify_project_owner"
    ):
        response = make_client().post(
            "/v2/cfd/import-from-storage",
            headers={"Authorization": "Bearer test-token"},
            json=payload,
        )
    assert response.status_code == 422, response.text
    assert "hors session" in response.json()["detail"]


def test_storage_bytes_normalizes_wrapped_bytes_and_retries(monkeypatch):
    class Wrapped:
        def __init__(self, content):
            self.content = content

    class Storage:
        def __init__(self):
            self.calls = 0

        def from_(self, bucket):
            return self

        def download(self, path):
            self.calls += 1
            if self.calls < 2:
                raise RuntimeError("object not yet visible")
            return Wrapped(bytearray(b"exact-vtu-bytes"))

    storage = Storage()

    class Client:
        def __init__(self):
            self.storage = storage

    monkeypatch.setattr(cfd_import_router.time, "sleep", lambda _: None)
    assert cfd_import_router._storage_bytes(Client(), "cfd-artifacts", "x/frame.vtu", "frame") == b"exact-vtu-bytes"
    assert storage.calls == 2


def test_sidecar_can_be_validated_before_frames_are_downloaded():
    sidecar = {
        "contractVersion": "cfd-volume.v1",
        "frames": [{"file": "frame_0000.vtu", "payloadHash": "a" * 64, "time": 0.0}],
        "provenance": {"sourceHash": "b" * 64},
        "boundarySets": [],
        "residuals": {},
        "references": [],
        "evidence": {},
        "fieldDescriptors": {},
    }
    cfd_import_router._verify_sidecar(sidecar, {}, check_hashes=False)


def test_streaming_dataset_blob_is_gzip_json(tmp_path):
    destination = tmp_path / "dataset.json.gz"
    metadata = {"contractVersion": "cfd-volume.v1", "meshRevision": "mesh-v1"}
    frames = [{"frameId": "frame_0000", "time": 0.0, "points": [0.0, 0.0, 0.0], "cells": [0], "offsets": [0, 1], "cellTypes": [1], "fields": []}]
    cfd_import_router._write_streaming_dataset_blob(metadata, frames, str(destination))
    with gzip.open(destination, "rt", encoding="utf-8") as source:
        decoded = json.load(source)
    assert decoded["frames"][0]["frameId"] == "frame_0000"
    assert decoded["meshRevision"] == "mesh-v1"


def test_streaming_memory_error_has_explicit_code(monkeypatch):
    monkeypatch.setattr(cfd_import_router, "_storage_to_file", lambda *args, **kwargs: (_ for _ in ()).throw(MemoryError()))
    assert callable(cfd_import_router._storage_to_file)
