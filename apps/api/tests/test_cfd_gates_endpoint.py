import os
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))

from cfd_import_router import router


class _Response:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, data):
        self.data = data

    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        return _Response(self.data)


class _Client:
    def __init__(self, data):
        self.data = data

    def table(self, _name):
        return _Query(self.data)


def make_client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def dataset():
    return {
        "contractVersion": "cfd-volume.v1",
        "meshRevision": "mesh-test-v1",
        "coordinateSystem": "cartesian",
        "lengthUnit": "m",
        "pointCount": 4,
        "cellCount": 1,
        "frames": [
            {
                "frameId": "f0",
                "time": 0.0,
                "points": [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
                "cells": [0, 1, 2, 3],
                "offsets": [0, 4],
                "cellTypes": [10],
                "fields": [{"name": "temperature", "association": "point", "components": 1, "values": [20, 20, 20, 20], "unit": "K", "quantity": "temperature"}],
            },
            {
                "frameId": "f1",
                "time": 1.0,
                "points": [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
                "cells": [0, 1, 2, 3],
                "offsets": [0, 4],
                "cellTypes": [10],
                "fields": [{"name": "temperature", "association": "point", "components": 1, "values": [21, 20, 20, 20], "unit": "K", "quantity": "temperature"}],
            },
        ],
        "boundarySets": [{"name": "wall", "association": "point", "indices": [0, 1, 2]}],
        "provenance": {"solver": "test-solver", "solverVersion": "1.0", "sourceUri": "https://example.test/run", "sourceHash": "a" * 64, "calculationId": "run-1", "generatedAt": "2026-08-25T00:00:00+00:00"},
        "residuals": {"mass": 1e-8, "momentum": 2e-8, "energy": 3e-8, "norm": "L2", "computedBy": "test-solver", "computedAt": "2026-08-25T00:00:00+00:00"},
        "references": [{"id": "ref-1", "title": "Reference", "uri": "https://example.test/ref", "variables": ["temperature"], "comparisonHash": "b" * 64}],
        "evidence": {"meshGeometryAndTopology": True, "fieldsAndUnits": True, "namedBoundaries": True, "solverProvenance": True, "solverResiduals": True, "referenceComparison": True, "immutableHashes": True, "calculatedTransientStates": True},
        "classification": "SYNTHETIC_STRUCTURAL_TEST",
    }


def test_gates_endpoint_returns_sequential_matrix_and_blocks_at_g1():
    row = {"analysis_id": "analysis-1", "status": "STRUCTURAL_TEST_UNVALIDATED", "dataset": dataset(), "artifact_manifest": {"sidecarSha256": "c" * 64, "frames": [{"file": "frame.vtu", "sha256": "d" * 64}]}}
    with patch.dict(os.environ, {"CFD_IMPORT_API_TOKEN": "test-token"}), patch("cfd_import_router._supabase", return_value=_Client([row])):
        response = make_client().get("/v2/cfd/analysis-1/gates", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["overallStatus"] == "UNVALIDATED"
    assert payload["blockingGate"] == "G1"
    assert [gate["gate"] for gate in payload["gates"]] == ["G0", "G1", "G2", "G3", "G4", "G5"]
    assert payload["gates"][1]["state"] == "BLOCKED"
    assert payload["gates"][2]["state"] == "NOT_REACHED"


def test_gates_endpoint_requires_import_token():
    with patch.dict(os.environ, {"CFD_IMPORT_API_TOKEN": "test-token"}):
        response = make_client().get("/v2/cfd/analysis-1/gates")
    assert response.status_code == 401
