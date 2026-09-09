#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "artifacts" / "synthetic_lh2_vtu"

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> None:
    report_path = ROOT / "topology_report.json"
    frame0 = ROOT / "frame_0000.vtu"
    frame1 = ROOT / "frame_0001.vtu"
    report_hash = sha256(report_path)
    mesh_hash = sha256(frame0)
    sidecar = {
        "contractVersion": "cfd-volume.v1",
        "meshRevision": "synthetic-lh2-mesh-v1-topology-proof-v1",
        "coordinateSystem": "cartesian-right-handed",
        "lengthUnit": "m",
        "fieldDescriptors": {
            "temperature": {"unit": "K", "quantity": "temperature"},
            "pressure": {"unit": "MPa", "quantity": "pressure"},
            "velocity": {"unit": "m/s", "quantity": "velocity"},
            "region_id": {"unit": "1", "quantity": "cell region identifier"}
        },
        "boundarySets": [{
            "name": "synthetic_boundary",
            "association": "point",
            "indexSpace": "point-index-space-v1",
            "indices": list(range(8))
        }],
        "topologyEvidence": {
            "closedDomain": True,
            "tool": "meshio-plus-deterministic-tetra-face-audit",
            "toolVersion": "meshio-runtime",
            "proofType": "VOLUMETRIC_TOPOLOGY_REPORT",
            "meshSha256": mesh_hash,
            "reportSha256": report_hash,
            "limitations": "Synthetic structural diagnostic; discrete boundary closure only; no physical validity, solver execution, or industrial certification."
        },
        "provenance": {
            "solver": "synthetic-structure-generator",
            "solverVersion": "1.0.0",
            "sourceUri": "urn:quantum-hybrid-pinn:test:synthetic-lh2-vtu-v1",
            "sourceHash": mesh_hash,
            "calculationId": "synthetic-lh2-structure-test-topology-proof-v1",
            "generatedAt": "2026-09-09T21:35:00+00:00"
        },
        "residuals": {"mass": None, "momentum": None, "energy": None, "norm": None, "computedBy": None, "computedAt": None},
        "references": [{
            "id": "synthetic-topology-report-v1",
            "title": "Synthetic tetrahedral topology report",
            "uri": "https://example.invalid/quantum-hybrid-pinn/synthetic-topology-report-v1",
            "variables": ["geometry", "topology", "boundaries"],
            "comparisonHash": report_hash
        }],
        "evidence": {
            "meshGeometryAndTopology": False,
            "fieldsAndUnits": False,
            "namedBoundaries": False,
            "solverProvenance": False,
            "solverResiduals": False,
            "referenceComparison": False,
            "immutableHashes": False,
            "calculatedTransientStates": False
        },
        "frames": [
            {"frameId": "synthetic-lh2-0000", "time": 0.0, "file": frame0.name, "payloadHash": sha256(frame0)},
            {"frameId": "synthetic-lh2-0001", "time": 1.0, "file": frame1.name, "payloadHash": sha256(frame1)}
        ],
        "classification": "SYNTHETIC_STRUCTURE_TEST_NOT_INDUSTRIAL_VALIDATION"
    }
    (ROOT / "sidecar_topology_complete_model.json").write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n")

    pinn = {
        "profileVersion": "pinn-training-profile.v1",
        "classification": "TEST_RECOMMENDATION_NOT_VALIDATION",
        "projectStatusRequired": "STRUCTURAL_TEST_UNVALIDATED",
        "solverExecution": "NOT_RUN",
        "dataset": {"meshRevision": sidecar["meshRevision"], "frames": 2, "pointCount": 8, "cellCount": 5, "sourceHash": mesh_hash},
        "modelConfig": {
            "layers": [4, 64, 64, 64, 64, 5],
            "inputOrder": ["t", "x", "y", "z"],
            "outputOrder": ["pressure", "u", "v", "w", "temperature"],
            "activation": "tanh",
            "normalization": {"coordinates": "map_each_dimension_to[-1,1]", "time": "map_to[-1,1]", "outputs": "standardize_from_training_split_only"},
            "epochs": 5000,
            "learningRate": 0.001,
            "optimizer": "Adam",
            "batchSize": 256,
            "seed": 20260909
        },
        "sampling": {"N_pde": 5000, "N_boundary": 512, "N_initial": 256, "N_data": 256, "strategy": "Sobol_fixed_seed", "evaluationSplit": "independent_20_percent_hidden_from_training"},
        "lossWeights": {"pde_mass": 1.0, "pde_momentum": 1.0, "pde_energy": 0.5, "boundary": 10.0, "initial": 5.0, "data": 1.0, "regularization": 1.0e-6},
        "schedule": {"warmupEpochs": 500, "reduceLROnPlateau": {"factor": 0.5, "patience": 250, "minLearningRate": 1.0e-6}, "earlyStopping": {"patience": 750, "minDelta": 1.0e-6}},
        "acceptance": {"reportResidualsAs": "N/D until computed by a physical solver or explicitly defined PINN residual evaluator", "doNotPromoteToValidated": True, "requiredArtifacts": ["config.json", "seed.json", "training_log.jsonl", "model_hash", "independent_evaluation.json", "reproduction_2_report.json"]}
    }
    (ROOT / "pinn_training_profile_test.json").write_text(json.dumps(pinn, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"sidecar": str(ROOT / 'sidecar_topology_complete_model.json'), "profile": str(ROOT / 'pinn_training_profile_test.json'), "meshSha256": mesh_hash, "reportSha256": report_hash}, indent=2))

if __name__ == "__main__":
    main()
