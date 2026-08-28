import os
import sys
from copy import deepcopy
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
        "boundarySets": [{"name": "wall", "association": "point", "indexSpace": "point-index-space-v1", "indices": [0, 1, 2]}],
        "provenance": {"solver": "test-solver", "solverVersion": "1.0", "sourceUri": "https://example.test/run", "sourceHash": "a" * 64, "calculationId": "run-1", "generatedAt": "2026-08-25T00:00:00+00:00"},
        "residuals": {"mass": 1e-8, "momentum": 2e-8, "energy": 3e-8, "norm": "L2", "computedBy": "test-solver", "computedAt": "2026-08-25T00:00:00+00:00"},
        "references": [{"id": "ref-1", "title": "Reference", "uri": "https://example.test/ref", "variables": ["temperature"], "comparisonHash": "b" * 64}],
        "evidence": {"meshGeometryAndTopology": True, "fieldsAndUnits": True, "namedBoundaries": True, "solverProvenance": True, "solverResiduals": True, "referenceComparison": True, "immutableHashes": True, "calculatedTransientStates": True},
        "topologyEvidence": {"closedDomain": True, "tool": "Gmsh", "toolVersion": "4.15.2", "proofType": "CLOSED_VOLUME_BOUNDARY_CHECK", "meshSha256": "a" * 64, "reportSha256": "b" * 64, "limitations": "Structural proof only."},
        "classification": "SYNTHETIC_STRUCTURAL_TEST",
    }


def test_gates_endpoint_evaluates_full_storage_contract_not_sql_summary():
    full = dataset()
    summary = {key: value for key, value in full.items() if key != "frames"}
    summary["frames"] = [{"frameId": "f0", "time": 0.0, "pointCount": 4, "cellCount": 1, "fieldNames": ["temperature"]}]
    row = {"analysis_id": "analysis-1", "status": "STRUCTURAL_TEST_UNVALIDATED", "dataset": summary, "artifact_manifest": {"datasetPath": "owner/case/revision/analysis/dataset.json.gz", "sidecarSha256": "c" * 64, "frames": [{"file": "frame.vtu", "sha256": "d" * 64}]}}
    with patch.dict(os.environ, {"CFD_IMPORT_API_TOKEN": "test-token"}), patch("cfd_import_router._supabase", return_value=_Client([row])), patch("cfd_import_router._load_dataset", return_value=full) as load_dataset:
        response = make_client().get("/v2/cfd/analysis-1/gates", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 200, response.text
    payload = response.json()
    load_dataset.assert_called_once_with(row)
    assert payload["evaluationSource"] == "persisted_storage_contract"
    assert payload["summaryUsedForGateEvaluation"] is False
    assert payload["gates"][1]["state"] == "PASS"
    assert payload["gates"][1]["evidence"]["decision"] == "G1_EVIDENCE_GENERATED_NOT_CERTIFIED"


def test_g1_rejects_closed_domain_boolean_without_coherent_report():
    invalid = deepcopy(dataset())
    invalid["topologyEvidence"].pop("reportSha256")
    from cfd_gate_service import evaluate_cfd_gates
    report = evaluate_cfd_gates(invalid, {"sidecarSha256": "c" * 64, "frames": [{"file": "frame.vtu", "sha256": "d" * 64}]})
    gate = report["gates"][1]
    assert gate["state"] == "BLOCKED"
    assert any("reportSha256" in reason for reason in gate["reasons"])


def test_g1_rejects_boundary_index_outside_declared_space():
    invalid = deepcopy(dataset())
    invalid["boundarySets"][0]["indices"] = [0, 4]
    from cfd_gate_service import evaluate_cfd_gates
    report = evaluate_cfd_gates(invalid, {"sidecarSha256": "c" * 64, "frames": [{"file": "frame.vtu", "sha256": "d" * 64}]})
    gate = report["gates"][1]
    assert gate["state"] == "BLOCKED"
    assert any("outside its declared point space" in reason for reason in gate["reasons"])


def test_gates_endpoint_returns_sequential_matrix_when_g1_is_blocked():
    invalid = deepcopy(dataset())
    invalid["topologyEvidence"]["closedDomain"] = True
    invalid["topologyEvidence"]["reportSha256"] = "e" * 64
    row = {"analysis_id": "analysis-1", "status": "STRUCTURAL_TEST_UNVALIDATED", "dataset": invalid, "artifact_manifest": {"sidecarSha256": "c" * 64, "frames": [{"file": "frame.vtu", "sha256": "d" * 64}]}}
    with patch.dict(os.environ, {"CFD_IMPORT_API_TOKEN": "test-token"}), patch("cfd_import_router._supabase", return_value=_Client([row])):
        response = make_client().get("/v2/cfd/analysis-1/gates", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["blockingGate"] == "G1"
    assert payload["gates"][1]["state"] == "BLOCKED"
    assert payload["gates"][2]["state"] == "NOT_REACHED"


def test_gates_endpoint_requires_import_token():
    with patch.dict(os.environ, {"CFD_IMPORT_API_TOKEN": "test-token"}):
        response = make_client().get("/v2/cfd/analysis-1/gates")
    assert response.status_code == 401
