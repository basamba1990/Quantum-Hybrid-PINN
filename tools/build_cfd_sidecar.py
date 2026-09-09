#!/usr/bin/env python3
"""Build an auditable cfd-volume.v1 sidecar from VTU frames.

The script computes frame hashes from the bytes that will be imported. It never
promotes synthetic data to a validated physical contract. To mark a physical
contract validated, provide a separate reviewed JSON contract with
validated=true and pass --physics-contract.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import meshio


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frame", action="append", required=True, type=Path, help="VTU frame; repeat in chronological order")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--mesh-quality", type=Path, help="Previously computed mesh_quality_report.json")
    parser.add_argument("--physics-contract", type=Path, help="Reviewed physics contract JSON")
    parser.add_argument("--solver", default="synthetic-structure-generator")
    parser.add_argument("--solver-version", default="1.0.0")
    parser.add_argument("--calculation-id", default="synthetic-structure-test")
    parser.add_argument("--classification", default="SYNTHETIC_STRUCTURE_TEST_NOT_INDUSTRIAL_VALIDATION")
    args = parser.parse_args()

    frames = args.frame
    if not frames:
        raise ValueError("At least one frame is required")
    for path in frames:
        if not path.is_file():
            raise FileNotFoundError(path)

    # Read all frames to verify that they are valid VTU files and have a stable topology.
    meshes = [meshio.read(path) for path in frames]
    first_points = len(meshes[0].points)
    first_cells = [(block.type, block.data.tolist()) for block in meshes[0].cells]
    for path, mesh in zip(frames[1:], meshes[1:]):
        cells = [(block.type, block.data.tolist()) for block in mesh.cells]
        if len(mesh.points) != first_points or cells != first_cells:
            raise ValueError(f"Topology mismatch in {path}")

    frame_hashes = [sha256(path) for path in frames]
    times = [float(index) for index in range(len(frames))]
    provenance: dict[str, Any] = {
        "solver": args.solver,
        "solverVersion": args.solver_version,
        "calculationId": args.calculation_id,
        "sourceHash": frame_hashes[0],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }

    if args.physics_contract:
        physics_contract = read_json(args.physics_contract)
        if physics_contract.get("validated") is not True:
            raise ValueError("The supplied physics contract must explicitly contain validated=true")
    else:
        physics_contract = {
            "version": "physics-contract.v1",
            "validated": False,
            "status": "NOT_VALIDATED",
            "reason": "No reviewed physical contract was supplied; synthetic or structural data must not pass G3.",
        }

    descriptors = {
        "temperature": {"unit": "K", "quantity": "temperature"},
        "pressure": {"unit": "Pa", "quantity": "pressure"},
        "velocity": {"unit": "m/s", "quantity": "velocity"},
        "region_id": {"unit": "1", "quantity": "cell region identifier"},
    }

    sidecar: dict[str, Any] = {
        "contractVersion": "cfd-volume.v1",
        "meshRevision": f"{args.calculation_id}-mesh-v1",
        "coordinateSystem": "cartesian-right-handed",
        "lengthUnit": "m",
        "fieldDescriptors": descriptors,
        "boundarySets": [],
        "provenance": provenance,
        "physicsContract": physics_contract,
        "residuals": {
            "mass": None,
            "momentum": None,
            "energy": None,
            "norm": None,
            "computedBy": None,
            "computedAt": None,
        },
        "references": [],
        "evidence": {
            "meshGeometryAndTopology": False,
            "fieldsAndUnits": False,
            "namedBoundaries": False,
            "solverProvenance": bool(provenance["solver"] and provenance["solverVersion"] and provenance["calculationId"]),
            "solverResiduals": False,
            "referenceComparison": False,
            "immutableHashes": True,
            "calculatedTransientStates": len(frames) >= 2,
        },
        "frames": [
            {"frameId": f"{args.calculation_id}-{index:04d}", "time": time, "file": path.name, "payloadHash": digest}
            for index, (time, path, digest) in enumerate(zip(times, frames, frame_hashes))
        ],
        "classification": args.classification,
    }

    if args.mesh_quality:
        quality = read_json(args.mesh_quality)
        if quality.get("meshSha256") != frame_hashes[0]:
            raise ValueError("mesh quality report hash does not match the first imported frame")
        quality["reportSha256"] = sha256(args.mesh_quality)
        sidecar["meshQuality"] = quality
        sidecar["references"].append({
            "id": "mesh-quality-report-v1",
            "title": "Volumetric mesh-quality report",
            "uri": f"urn:artifact:{args.mesh_quality.name}",
            "variables": ["mesh_quality", "cell_volume", "jacobian", "skewness"],
            "comparisonHash": quality["reportSha256"],
        })
    else:
        sidecar["meshQuality"] = {
            "validated": False,
            "reason": "No mesh-quality report supplied",
            "meshSha256": frame_hashes[0],
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(sidecar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "frameCount": len(frames),
        "frameHashes": frame_hashes,
        "meshQualityValidated": sidecar["meshQuality"].get("validated"),
        "physicsContractValidated": sidecar["physicsContract"].get("validated"),
        "classification": sidecar["classification"],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
