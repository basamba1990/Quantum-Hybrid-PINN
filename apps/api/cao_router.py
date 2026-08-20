"""Router CAO industriel — pipeline STEP AP242 avec portes bloquantes.

Aucune valeur n'est simulée : chaque étape retourne explicitement les statuts
REQUIRED_INPUT / UNVALIDATED lorsque les données réellement absentes ne
peuvent pas être fournies. La publication et les badges « converged/validated »
sont interdits tant que les portes G0–G5 ne sont pas satisfaites.
"""
from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from cao.step_importer import import_step_file
from cao.topology_validator import validate_topology, _rebuild_indexed_faces
from cao.volume_mesher import generate_volume_mesh
from cao.case_contract import (
    BoundaryConditionReference,
    PhysicsReference,
    PinnModelReference,
    build_case_contract,
)
from cao.export_glb import export_glb, GltfExportError
from cao.export_vtu import export_vtu, ScalarField
from cao.export_cgns import export_cgns
from cao.gates import evaluate_all_gates, assert_gates_passed, GateEvaluationError

router = APIRouter(prefix="/v2/cao", tags=["cao"])


# ----------------------------- Modèles Pydantic -----------------------------

class PhysicsReferenceRequest(BaseModel):
    solver_type: str
    governing_equations: List[str]
    material: str
    units_checked: bool = False
    material_properties: Dict[str, Any] = {}
    validated: bool = False


class BoundaryConditionsRequest(BaseModel):
    bc_set_name: str
    assigned_boundaries: List[str]
    boundary_map: Dict[str, List[int]] = {}
    validated: bool = False


class PinnModelReferenceRequest(BaseModel):
    architecture: str
    parameterization_id: str
    hyperparameters_revision: str
    quantization_bits: int = 4
    validated: bool = False


class CaseContractRequest(BaseModel):
    case_id: str
    geometry_revision_id: str
    physics: PhysicsReferenceRequest
    boundary_conditions: BoundaryConditionsRequest
    pinn_model: PinnModelReferenceRequest


class MeshRequest(BaseModel):
    geometry_revision_id: str
    refinement_factor: float = 2.0
    boundary_refinement_radius: float = 0.25


class ExportRequest(BaseModel):
    format: str  # glb | vtu | cgns
    geometry_revision_id: Optional[str] = None
    mesh_revision_id: Optional[str] = None
    scalar_fields: Optional[List[Dict[str, Any]]] = None
    units_label: Optional[str] = None


# ----------------------------- Registre du pipeline -------------------------

_PIPELINE_REGISTRY: Dict[str, Dict[str, Any]] = {}


def _find_stage(key: str, geometry_revision_id: str, required: str) -> Any:
    """Recherche un artefact du pipeline par révision. Bloquant si absent."""
    entry = _PIPELINE_REGISTRY.get(geometry_revision_id)
    if entry is None or key not in entry or entry[key] is None:
        raise HTTPException(
            status_code=404,
            detail=f"{required} absent du pipeline pour la révision {geometry_revision_id} : aucune donnée simulée ne sera substituée.",
        )
    return entry[key]


@router.post("/import")
async def cao_import(file: UploadFile = File(...)):
    """Importe un fichier STEP AP242 et crée une révision immuable."""
    suffix = os.path.splitext(file.filename or "model.step")[1] or ".step"
    content = await file.read()
    if not content.startswith(b"ISO-10303-21") and b"HEADER" not in content:
        raise HTTPException(
            status_code=400,
            detail="Fichier STEP AP242 invalide : en-tête ISO-10303-21 manquant.",
        )
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp.write(content)
        temp_path = temp.name
    try:
        result = import_step_file(temp_path)
        faces = _rebuild_indexed_faces(result)
        topology = validate_topology(result)
        registry_entry: Dict[str, Any] = {
            "import": result,
            "topology": topology,
            "faces": faces,
        }
        _PIPELINE_REGISTRY[result.geometry_revision_id] = registry_entry
        return {
            "geometry_revision_id": result.geometry_revision_id,
            "unit_factor": result.unit_factor,
            "units_checked": result.units_checked,
            "coordinate_system": result.coordinate_system.to_dict(),
            "products": [p.to_dict() for p in result.products],
            "vertex_count": int(result.vertices.shape[0]) if result.vertices is not None else 0,
            "triangle_count": int(result.raw_triangles.shape[0]) if result.raw_triangles is not None else 0,
            "topology_blocking": topology.blocking_issues,
            "status": "imported",
        }
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass


@router.post("/mesh")
async def cao_mesh(request: MeshRequest):
    """Génère le maillage volumique avec contrôle qualité."""
    import_entry = _find_stage("import", request.geometry_revision_id, "Import CAO")
    topology = _find_stage("topology", request.geometry_revision_id, "Rapport topologique")
    faces = _find_stage("faces", request.geometry_revision_id, "Faces CAO")
    mesh = generate_volume_mesh(
        import_entry.vertices,
        faces,
        topology,
        refinement_factor=request.refinement_factor,
        boundary_refinement_radius=request.boundary_refinement_radius,
    )
    entry = _PIPELINE_REGISTRY[request.geometry_revision_id]
    entry["mesh"] = mesh
    payload = {
        "mesh_revision_id": mesh.mesh_revision_id,
        "points": int(mesh.points_count),
        "cells": int(mesh.cells_count),
        "blocking": mesh.blocking_issues,
        "quality": mesh.quality,
        "validated": mesh.validated,
    }
    if mesh.blocking_issues or not mesh.validated:
        raise HTTPException(status_code=424, detail=payload)
    return payload


@router.post("/contract")
async def cao_contract(request: CaseContractRequest):
    """Émet un contrat de cas immuable référençant tous les ingrédients."""
    import_entry = _find_stage("import", request.geometry_revision_id, "Import CAO")
    mesh = _find_stage("mesh", request.geometry_revision_id, "Maillage volumique")
    topology = _find_stage("topology", request.geometry_revision_id, "Rapport topologique")
    physics = PhysicsReference(
        solver_type=request.physics.solver_type,
        governing_equations=request.physics.governing_equations,
        material=request.physics.material,
        units_checked=request.physics.units_checked,
        material_properties=request.physics.material_properties,
        validated=request.physics.validated,
        revision_id="REQUIRED_INPUT",
    )
    boundary_conditions = BoundaryConditionReference(
        bc_set_name=request.boundary_conditions.bc_set_name,
        assigned_boundaries=request.boundary_conditions.assigned_boundaries,
        boundary_map=request.boundary_conditions.boundary_map,
        validated=request.boundary_conditions.validated,
        revision_id="REQUIRED_INPUT",
    )
    pinn_model = PinnModelReference(
        architecture=request.pinn_model.architecture,
        parameterization_id=request.pinn_model.parameterization_id,
        hyperparameters_revision=request.pinn_model.hyperparameters_revision,
        quantization_bits=request.pinn_model.quantization_bits,
        validated=request.pinn_model.validated,
        revision_id="REQUIRED_INPUT",
    )
    topology_validated = topology.validated and not topology.blocking_issues
    topology_report_id = (
        f"topo_{topology.geometry_revision_id}" if topology_validated else None
    )
    contract = build_case_contract(
        case_id=request.case_id,
        geometry_revision_id=request.geometry_revision_id,
        topology_report_id=topology_report_id,
        mesh_revision_id=mesh.mesh_revision_id,
        physics=physics,
        boundary_conditions=boundary_conditions,
        pinn_model=pinn_model,
        topology_validated=topology_validated,
    )
    _PIPELINE_REGISTRY[request.geometry_revision_id]["case_contract"] = contract
    payload = contract.to_dict()
    if contract.blocking_issues:
        raise HTTPException(status_code=424, detail=payload)
    return payload


@router.post("/export")
async def cao_export(request: ExportRequest):
    """Exporte GLB (surface), VTU ou CGNS (maillage + champs)."""
    if not request.geometry_revision_id:
        raise HTTPException(status_code=400, detail="Révision de géométrie manquante : aucune donnée simulée ne sera substituée.")
    import_result = _find_stage("import", request.geometry_revision_id, "Import CAO")
    faces = _find_stage("faces", request.geometry_revision_id, "Faces CAO")

    if request.format == "glb":
        units_label = request.units_label or (
            import_result.source_file.get("units_declared")
            if import_result.units_checked
            else "REQUIRED_INPUT"
        )
        try:
            path = export_glb(
                import_result.vertices,
                faces,
                import_result.geometry_revision_id,
                units_label=units_label,
                status="VALIDATED" if import_result.validated else "UNVALIDATED",
            )
        except GltfExportError as exception:
            raise HTTPException(status_code=424, detail=str(exception))
        return {"format": "glb", "path": path, "status": "exported"}

    mesh = _find_stage("mesh", request.geometry_revision_id, "Maillage volumique")
    units_label = request.units_label or "REQUIRED_INPUT"
    scalar_fields = [
        ScalarField(
            name=field["name"],
            values=field["values"],
            units=field.get("units", "REQUIRED_INPUT"),
            provenance=field.get("provenance", "unknown"),
        )
        for field in (request.scalar_fields or [])
    ]
    if request.format == "vtu":
        vtu_result = export_vtu(
            mesh.points,
            mesh.cells,
            import_result.geometry_revision_id,
            mesh.mesh_revision_id,
            scalar_fields=scalar_fields,
            units_label=units_label,
        )
        return {
            "format": "vtu",
            "path": vtu_result.file_path,
            "vtu_revision_id": vtu_result.vtu_revision_id,
            "exported_fields": vtu_result.exported_fields,
            "missing_fields": vtu_result.missing_fields,
            "status": vtu_result.status,
        }
    if request.format == "cgns":
        cgns_result = export_cgns(
            mesh.points,
            mesh.cells,
            import_result.geometry_revision_id,
            mesh.mesh_revision_id,
            scalar_fields=scalar_fields,
            units_label=units_label,
        )
        return {
            "format": "cgns",
            "path": cgns_result.file_path,
            "cgns_revision_id": cgns_result.cgns_revision_id,
            "exported_fields": cgns_result.exported_fields,
            "missing_fields": cgns_result.missing_fields,
            "status": cgns_result.status,
            "reason": cgns_result.reason,
        }
    raise HTTPException(status_code=400, detail=f"Format non supporté : {request.format}. Formats : glb, vtu, cgns.")


@router.get("/gates")
async def cao_gates(geometry_revision_id: str):
    """Évalue les portes G0–G5 de manière séquentielle et bloquante."""
    entry = _PIPELINE_REGISTRY.get(geometry_revision_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Révision {geometry_revision_id} absente du pipeline.")
    artifacts: Dict[str, Any] = {
        "cad_import": entry["import"],
        "topology": entry.get("topology"),
        "mesh": entry.get("mesh"),
        "physics": entry.get("physics"),
        "boundary_conditions": entry.get("boundary_conditions"),
        "pinn_model": entry.get("pinn_model"),
        "case_contract": entry.get("case_contract"),
        "execution": entry.get("execution"),
    }
    report = evaluate_all_gates(artifacts)
    return report.to_dict()


@router.post("/publish")
async def cao_publish(geometry_revision_id: str, platform: str = "linkedin"):
    """Publie les résultats uniquement si les portes G0–G5 sont satisfaites."""
    entry = _PIPELINE_REGISTRY.get(geometry_revision_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Révision {geometry_revision_id} absente du pipeline.")
    artifacts: Dict[str, Any] = {
        "cad_import": entry["import"],
        "topology": entry.get("topology"),
        "mesh": entry.get("mesh"),
        "physics": entry.get("physics"),
        "boundary_conditions": entry.get("boundary_conditions"),
        "pinn_model": entry.get("pinn_model"),
        "case_contract": entry.get("case_contract"),
        "execution": entry.get("execution"),
    }
    report = evaluate_all_gates(artifacts)
    try:
        assert_gates_passed(report)
    except GateEvaluationError as exception:
        raise HTTPException(
            status_code=403,
            detail={
                "blocked": True,
                "platform": platform,
                "gate_report": report.to_dict(),
                "message": str(exception),
            },
        )
    return {
        "published": True,
        "platform": platform,
        "geometry_revision_id": geometry_revision_id,
        "gate_report": report.to_dict(),
        "note": "Publication autorisée : toutes les portes G0–G5 sont satisfaites avec des artefacts réellement validés.",
    }
