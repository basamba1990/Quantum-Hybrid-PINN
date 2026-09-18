"""Server-authoritative G0-G5 evidence evaluation for cfd-volume.v1 datasets.

This module never fabricates evidence. It evaluates only persisted dataset fields,
server-computed artifact manifests, and explicitly persisted comparison evidence.
A structurally readable dataset is not automatically industrially validated.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List
import re


GATE_NAMES = {
    "G0": "geometry_identity",
    "G1": "topology_boundaries",
    "G2": "volume_mesh_quality",
    "G3": "physics_contract",
    "G4": "solver_execution",
    "G5": "independent_comparison",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gate(code: str, state: str, reasons: List[str], evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "gate": code,
        "name": GATE_NAMES[code],
        "state": state,
        "satisfied": state == "PASS",
        "checkedAt": _now(),
        "reasons": reasons,
        "evidence": evidence,
    }


def _not_reached(code: str, previous: str) -> Dict[str, Any]:
    return _gate(code, "NOT_REACHED", [f"Previous gate {previous} is not satisfied."], {})


def _mapping(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value == value and value not in (float("inf"), float("-inf"))


def _sha256_text(value: Any) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[0-9a-fA-F]{64}", value) is not None


def _boundary_indices_are_valid(dataset: Dict[str, Any]) -> tuple[bool, List[str], Dict[str, Any]]:
    boundaries = dataset.get("boundarySets")
    reasons: List[str] = []
    evidence: Dict[str, Any] = {"sets": []}
    if not isinstance(boundaries, list) or not boundaries:
        return False, ["Named boundaries with non-empty assignments are missing."], evidence
    point_count = dataset.get("pointCount")
    cell_count = dataset.get("cellCount")
    valid = True
    for boundary in boundaries:
        if not isinstance(boundary, dict):
            valid = False
            reasons.append("Boundary entry is not an object.")
            continue
        name = str(boundary.get("name", "")).strip()
        association = boundary.get("association")
        index_space = boundary.get("indexSpace")
        indices = boundary.get("indices")
        # The production PCCV sidecar currently carries OpenFOAM patch
        # declarations (name/type) rather than persisted point/cell indices.
        # Preserve that evidence in the report, but do not promote it to a
        # passing G1: patch names alone cannot prove volumetric boundaries.
        legacy_patch_type = boundary.get("type")
        if name and isinstance(legacy_patch_type, str) and legacy_patch_type.strip() and association is None and indices is None:
            evidence["sets"].append({"name": name, "type": legacy_patch_type, "declarationOnly": True})
            valid = False
            reasons.append(f"Boundary {name} is declared as an OpenFOAM patch only; point/cell indices are required for G1.")
            continue
        expected_space = {"point": "point-index-space-v1", "cell": "cell-index-space-v1"}.get(association)
        evidence["sets"].append({"name": name, "association": association, "indexSpace": index_space, "count": len(indices) if isinstance(indices, list) else 0})
        if not name or association not in ("point", "cell") or index_space != expected_space or not isinstance(indices, list) or not indices:
            valid = False
            reasons.append(f"Boundary {name or '<unnamed>'} has an invalid declared index space.")
            continue
        limit = point_count if association == "point" else cell_count
        if not isinstance(limit, int) or any(not isinstance(index, int) or isinstance(index, bool) or index < 0 or index >= limit for index in indices):
            valid = False
            reasons.append(f"Boundary {name} contains an index outside its declared {association} space.")
        if len(set(indices)) != len(indices):
            valid = False
            reasons.append(f"Boundary {name} contains duplicate indices.")
    return valid, reasons, evidence


def _verify_topology_evidence(dataset: Dict[str, Any]) -> tuple[bool, List[str], Dict[str, Any]]:
    topology = _mapping(dataset.get("topologyEvidence"))
    provenance = _mapping(dataset.get("provenance"))
    references = dataset.get("references")
    reasons: List[str] = []
    evidence = {"closedDomain": topology.get("closedDomain"), "tool": topology.get("tool"), "toolVersion": topology.get("toolVersion"), "proofType": topology.get("proofType"), "meshSha256": topology.get("meshSha256"), "reportSha256": topology.get("reportSha256"), "limitations": topology.get("limitations"), "hashConsistency": False}
    for key in ("tool", "toolVersion", "proofType", "meshSha256", "reportSha256", "limitations"):
        if not isinstance(topology.get(key), str) or not topology[key].strip():
            reasons.append(f"Topology evidence field missing: {key}.")
    if topology.get("closedDomain") is not True:
        reasons.append("Explicit closed-domain proof is absent or false.")
    if topology.get("proofType") not in ("CLOSED_VOLUME_BOUNDARY_CHECK", "VOLUMETRIC_TOPOLOGY_REPORT"):
        reasons.append("Topology proof type is not an accepted volumetric closure proof.")
    if not _sha256_text(topology.get("meshSha256")) or topology.get("meshSha256") != provenance.get("sourceHash"):
        reasons.append("Topology meshSha256 does not match the declared source artifact hash.")
    reference_hashes = [item.get("comparisonHash") for item in references if isinstance(item, dict)] if isinstance(references, list) else []
    if not _sha256_text(topology.get("reportSha256")) or topology.get("reportSha256") not in reference_hashes:
        reasons.append("Topology reportSha256 has no matching persisted reference hash.")
    evidence["hashConsistency"] = topology.get("meshSha256") == provenance.get("sourceHash") and topology.get("reportSha256") in reference_hashes
    return not reasons, reasons, evidence


def _valid_artifact_manifest(manifest: Any) -> bool:
    manifest = _mapping(manifest)
    frames = manifest.get("frames")
    if not isinstance(manifest.get("sidecarSha256"), str) or len(manifest["sidecarSha256"]) != 64:
        return False
    if not isinstance(frames, list) or not frames:
        return False
    return all(isinstance(item, dict) and isinstance(item.get("sha256"), str) and len(item["sha256"]) == 64 for item in frames)


def _dataset_fields(dataset: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    for frame in dataset.get("frames", []):
        for field in frame.get("fields", []):
            if isinstance(field, dict):
                yield field


def _topology_is_structurally_valid(dataset: Dict[str, Any]) -> bool:
    point_count = dataset.get("pointCount")
    cell_count = dataset.get("cellCount")
    if not isinstance(point_count, int) or not isinstance(cell_count, int) or point_count <= 0 or cell_count <= 0:
        return False
    frames = dataset.get("frames")
    if not isinstance(frames, list) or not frames:
        return False
    first = frames[0]
    for frame in frames:
        # The compact row persisted in cfd_datasets keeps full connectivity
        # only for the first frame; later entries intentionally contain
        # frameId/time/pointCount/cellCount/fieldNames. This is sufficient to
        # verify mesh cardinality without claiming that omitted arrays match.
        if "points" not in frame and "cells" not in frame and "offsets" not in frame and "cellTypes" not in frame:
            if frame.get("pointCount") != point_count or frame.get("cellCount") != cell_count:
                return False
            continue
        if len(frame.get("points", [])) != point_count * 3:
            return False
        if len(frame.get("cellTypes", [])) != cell_count or len(frame.get("offsets", [])) != cell_count + 1:
            return False
        if not frame.get("offsets") or frame["offsets"][0] != 0 or frame["offsets"][-1] != len(frame.get("cells", [])):
            return False
        if any(index < 0 or index >= point_count for index in frame.get("cells", [])):
            return False
        if frame["cells"] != first["cells"] or frame["offsets"] != first["offsets"] or frame["cellTypes"] != first["cellTypes"]:
            return False
    return True


def evaluate_cfd_gates(dataset: Dict[str, Any], artifact_manifest: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate G0-G5 sequentially; never infer PASS from a score or UI flag."""
    dataset = _mapping(dataset)
    gates: List[Dict[str, Any]] = []

    g0_reasons: List[str] = []
    g0_evidence = {
        "contractVersion": dataset.get("contractVersion"),
        "meshRevision": dataset.get("meshRevision"),
        "coordinateSystem": dataset.get("coordinateSystem"),
        "lengthUnit": dataset.get("lengthUnit"),
        "artifactManifestPresent": _valid_artifact_manifest(artifact_manifest),
    }
    if dataset.get("contractVersion") != "cfd-volume.v1":
        g0_reasons.append("Unsupported or missing CFD contract version.")
    for key in ("meshRevision", "coordinateSystem", "lengthUnit"):
        if not isinstance(dataset.get(key), str) or not dataset[key].strip():
            g0_reasons.append(f"Missing {key}.")
    if not g0_evidence["artifactManifestPresent"]:
        g0_reasons.append("Server-computed artifact manifest with SHA-256 hashes is missing.")
    gates.append(_gate("G0", "PASS" if not g0_reasons else "BLOCKED", g0_reasons, g0_evidence))

    if not gates[-1]["satisfied"]:
        for code in ("G1", "G2", "G3", "G4", "G5"):
            gates.append(_not_reached(code, "G0"))
        return _report(gates)

    boundaries = dataset.get("boundarySets")
    g1_reasons: List[str] = []
    structural_valid = _topology_is_structurally_valid(dataset)
    boundary_valid, boundary_reasons, boundary_evidence = _boundary_indices_are_valid(dataset)
    proof_valid, proof_reasons, proof_evidence = _verify_topology_evidence(dataset)
    g1_evidence = {"namedBoundaryCount": len(boundaries) if isinstance(boundaries, list) else 0, "topologyStructurallyValid": structural_valid, "boundaryIndexSpaceVerified": boundary_valid, "boundaryIndexSpace": boundary_evidence, "topologyProofVerified": proof_valid, "topologyProof": proof_evidence, "decision": "G1_EVIDENCE_GENERATED_NOT_CERTIFIED", "limitations": ["Structural topology evidence does not establish solver execution or experimental validation.", "Hashes are cross-checked against persisted provenance and reference evidence."]}
    if not structural_valid:
        g1_reasons.append("Volume connectivity is structurally invalid.")
    g1_reasons.extend(boundary_reasons)
    g1_reasons.extend(proof_reasons)
    gates.append(_gate("G1", "PASS" if not g1_reasons else "BLOCKED", g1_reasons, g1_evidence))

    if not gates[-1]["satisfied"]:
        for code in ("G2", "G3", "G4", "G5"):
            gates.append(_not_reached(code, "G1"))
        return _report(gates)

    mesh_quality = _mapping(dataset.get("meshQuality"))
    g2_reasons: List[str] = []
    g2_evidence = {"meshQualityPresent": bool(mesh_quality), "meshQuality": mesh_quality}
    if not mesh_quality:
        g2_reasons.append("No persisted volumetric mesh-quality report is available.")
    if mesh_quality.get("validated") is not True:
        g2_reasons.append("Volumetric mesh quality is not explicitly validated.")
    gates.append(_gate("G2", "PASS" if not g2_reasons else "BLOCKED", g2_reasons, g2_evidence))

    if not gates[-1]["satisfied"]:
        for code in ("G3", "G4", "G5"):
            gates.append(_not_reached(code, "G2"))
        return _report(gates)

    provenance = _mapping(dataset.get("provenance"))
    fields = list(_dataset_fields(dataset))
    g3_reasons: List[str] = []
    g3_evidence = {"fieldCount": len(fields), "solver": provenance.get("solver"), "solverVersion": provenance.get("solverVersion")}
    if not fields or any(not str(field.get("unit", "")).strip() or not str(field.get("quantity", "")).strip() for field in fields):
        g3_reasons.append("Physical fields, quantities or units are incomplete.")
    if not all(isinstance(provenance.get(key), str) and provenance[key].strip() for key in ("solver", "solverVersion", "calculationId")):
        g3_reasons.append("Solver provenance is incomplete.")
    if not isinstance(dataset.get("physicsContract"), dict) or dataset["physicsContract"].get("validated") is not True:
        g3_reasons.append("No validated physics contract is persisted.")
    gates.append(_gate("G3", "PASS" if not g3_reasons else "BLOCKED", g3_reasons, g3_evidence))

    if not gates[-1]["satisfied"]:
        for code in ("G4", "G5"):
            gates.append(_not_reached(code, "G3"))
        return _report(gates)

    residuals = _mapping(dataset.get("residuals"))
    frames = dataset.get("frames") if isinstance(dataset.get("frames"), list) else []
    g4_reasons: List[str] = []
    g4_evidence = {"residuals": residuals, "frameCount": len(frames), "solverOutputPresent": bool(artifact_manifest.get("frames"))}
    if not all(_finite_number(residuals.get(key)) for key in ("mass", "momentum", "energy")):
        g4_reasons.append("Mass, momentum and energy residuals are not finite solver outputs.")
    if len(frames) < 2 or not any(frame.get("fields") != frames[0].get("fields") for frame in frames[1:]):
        g4_reasons.append("At least two solver states with a measurable field change are required.")
    if not isinstance(dataset.get("executionEvidence"), dict) or dataset["executionEvidence"].get("runLogHash") is None:
        g4_reasons.append("Solver run log/configuration evidence is missing.")
    gates.append(_gate("G4", "PASS" if not g4_reasons else "BLOCKED", g4_reasons, g4_evidence))

    if not gates[-1]["satisfied"]:
        gates.append(_not_reached("G5", "G4"))
        return _report(gates)

    references = dataset.get("references")
    comparison = _mapping(dataset.get("validationComparison"))
    g5_reasons: List[str] = []
    g5_evidence = {"referenceCount": len(references) if isinstance(references, list) else 0, "comparison": comparison}
    if not isinstance(references, list) or not references or any(not isinstance(item, dict) or not item.get("comparisonHash") for item in references):
        g5_reasons.append("Independent reference with comparison hash is missing.")
    for key in ("metric", "acceptanceThreshold", "uncertainty", "alignmentMethod", "reviewer"):
        if comparison.get(key) in (None, ""):
            g5_reasons.append(f"Validation comparison field missing: {key}.")
    if comparison.get("decision") != "VALIDATED":
        g5_reasons.append("No attributable independent comparison decision is persisted.")
    gates.append(_gate("G5", "PASS" if not g5_reasons else "BLOCKED", g5_reasons, g5_evidence))
    return _report(gates)


def _report(gates: List[Dict[str, Any]]) -> Dict[str, Any]:
    all_satisfied = bool(gates) and all(item["state"] == "PASS" for item in gates)
    blocked = next((item for item in gates if item["state"] == "BLOCKED"), None)
    return {
        "contract": "cfd-volume.v1",
        "overallStatus": "VALIDATED" if all_satisfied else "UNVALIDATED",
        "allSatisfied": all_satisfied,
        "publishingAllowed": all_satisfied,
        "blockingGate": blocked["gate"] if blocked else None,
        "evaluatedAt": _now(),
        "gates": gates,
        "decisionBasis": "server_authoritative_evidence_only",
    }


__all__ = ["evaluate_cfd_gates"]
