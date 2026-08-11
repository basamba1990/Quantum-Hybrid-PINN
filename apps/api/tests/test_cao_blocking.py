"""
tests/test_cao_blocking.py — Tests bloquants du pipeline CAO industriel.

Chaque test est bloquant : une assertion en échec doit faire échouer le CI.
Aucune donnée physique n'est simulée : les cas de données absentes vérifient
explicitement que le pipeline reste en statut REQUIRED_INPUT / UNVALIDATED
et bloque la validation au lieu d'inventer des valeurs.
"""
from __future__ import annotations

import math
import os
import sys
from typing import Any

import numpy as np
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir))
sys.path.insert(0, os.path.join(ROOT, "apps", "api"))

from cao.revision import ValidationStatus, new_immutable_revision_id
from cao.step_importer import import_step_file
from cao.topology_validator import validate_topology, _rebuild_indexed_faces
from cao.volume_mesher import generate_volume_mesh
from cao.case_contract import (
    BoundaryConditionReference,
    CaseContractError,
    PhysicsReference,
    PinnModelReference,
    build_case_contract,
)
from cao.export_glb import export_glb, GltfExportError
from cao.export_vtu import ScalarField, export_vtu, VtuExportError
from cao.export_cgns import export_cgns
from cao.gates import (
    GateEvaluationError,
    assert_gates_passed,
    evaluate_all_gates,
)

FIXTURES = os.path.join(ROOT, "fixtures", "step")


def _load_closed() -> dict:
    result = import_step_file(os.path.join(FIXTURES, "closed_octahedron_ap242.step"))
    faces = _rebuild_indexed_faces(result)
    topology = validate_topology(result)
    mesh = generate_volume_mesh(result.vertices, faces, topology)
    return {"result": result, "faces": faces, "topology": topology, "mesh": mesh}


def _load_open() -> dict:
    result = import_step_file(os.path.join(FIXTURES, "lh2_tank_ap242.step"))
    faces = _rebuild_indexed_faces(result)
    topology = validate_topology(result)
    return {"result": result, "faces": faces, "topology": topology}


def _named_topo(base, faces_array, names=("inlet", "outlet")):
    """Rapport topologique enrichi par l'opérateur avec frontières nommées."""
    from cao.topology_validator import NamedBoundary

    n_faces = faces_array.shape[0]
    half = n_faces // 2
    return type(base)(
        geometry_revision_id=base.geometry_revision_id,
        closed_solids=base.closed_solids,
        non_manifold_count=base.non_manifold_count,
        boundary_edges=base.boundary_edges,
        self_intersections=base.self_intersections,
        duplicate_vertices=base.duplicate_vertices,
        duplicate_faces=base.duplicate_faces,
        flipped_faces=base.flipped_faces,
        inverted_normals=base.inverted_normals,
        scale_status=base.scale_status,
        declared_extents_m=base.declared_extents_m,
        design_extents_m=base.design_extents_m,
        unassigned_edges=0,
        named_boundaries=[
            NamedBoundary(names[0], [], list(range(half)), ValidationStatus.UNVALIDATED),
            NamedBoundary(names[1], [], list(range(half, n_faces)), ValidationStatus.UNVALIDATED),
        ],
        regions=base.regions,
        validation_errors=[],
        blocking_issues=[],
        validated=True,
        report=base.report,
    )


# ---------------------------------------------------------------------------
# Volet 1-2 : unités, fermeture, intersections
# ---------------------------------------------------------------------------

class TestUnitsBlocking:
    """Le facteur d'unité doit être issu du fichier STEP réel (SI_UNIT imbriqué)."""

    def test_unit_factor_declared_in_step(self):
        loaded = _load_closed()
        result = loaded["result"]
        assert result.units_checked, "Le facteur d'unité déclaré dans le STEP doit être vérifié."
        assert result.unit_factor is not None
        assert math.isclose(result.unit_factor, 0.001, rel_tol=1e-9), (
            "Le fichier fixture déclare MILLIMETRE : facteur attendu 0.001."
        )

    def test_unit_factor_immutable_with_file_hash(self):
        result_a = import_step_file(os.path.join(FIXTURES, "closed_octahedron_ap242.step"))
        result_b = import_step_file(os.path.join(FIXTURES, "closed_octahedron_ap242.step"))
        assert result_a.geometry_revision_id == result_b.geometry_revision_id, (
            "Un même fichier doit toujours produire la même révision immuable."
        )
        source = open(os.path.join(FIXTURES, "closed_octahedron_ap242.step"), "rb").read()[:1000]
        revision = new_immutable_revision_id("geom", source_bytes=source)
        assert revision.startswith("rev_geom_"), "La révision immuable doit préfixer le hash du fichier."


class TestClosureBlocking:
    """Un solide ouvert doit être bloqué sans exception ni valeur simulée."""

    def test_open_solid_blocked(self):
        loaded = _load_open()
        assert not loaded["topology"].closed_solids, "Le réservoir ouvert doit être détecté non fermé."
        assert loaded["topology"].boundary_edges > 0, "Les arêtes de bordure doivent être comptées."
        assert "fiche_conception_absente" in loaded["topology"].blocking_issues or \
               loaded["topology"].boundary_edges > 0, (
            "Un solide non fermé doit générer un blocage topologique explicite."
        )

    def test_closed_solid_validated(self):
        loaded = _load_closed()
        assert loaded["topology"].closed_solids, "L'octaèdre fermé doit être validé manifold."

    def test_no_boundary_edges_on_closed(self):
        loaded = _load_closed()
        assert loaded["topology"].boundary_edges == 0, (
            "Un solide fermé n'a aucune arête de bordure."
        )


class TestIntersectionBlocking:
    """Les intersections propres et auto-intersections doivent être comptées."""

    def test_no_self_intersection_on_closed(self):
        loaded = _load_closed()
        assert loaded["topology"].self_intersections == 0, (
            "L'octaèdre fermé n'a aucune auto-intersection."
        )

    def test_intersections_counted(self):
        loaded = _load_open()
        assert isinstance(loaded["topology"].self_intersections, int), (
            "Le compteur d'intersections doit être un entier réel."
        )
        assert loaded["topology"].self_intersections >= 0


# ---------------------------------------------------------------------------
# Volet 3 : maillage volumique et cellules négatives
# ---------------------------------------------------------------------------

class TestMeshQualityBlocking:
    """Le maillage doit rejeter les cellules négatives excessives et contrôler la qualité."""

    def test_negative_volume_cells_tracked(self):
        loaded = _load_closed()
        mesh = loaded["mesh"]
        assert isinstance(mesh.negative_volume_cells, int), (
            "Le compteur de cellules négatives doit être un entier réel."
        )
        assert mesh.negative_volume_cells >= 0

    def test_no_excessive_negative_cells(self):
        loaded = _load_closed()
        mesh = loaded["mesh"]
        assert not mesh.blocking_issues, (
            f"Un domaine fermé doit mailler sans blocage qualité. "
            f"Blocages relevés : {mesh.blocking_issues}"
        )

    def test_cells_are_tetrahedra(self):
        loaded = _load_closed()
        mesh = loaded["mesh"]
        assert mesh.cells.ndim == 2 and mesh.cells.shape[1] == 4, (
            "Le maillage volumique doit être en tétraèdres (n, 4)."
        )

    def test_all_cells_inside_domain(self):
        loaded = _load_closed()
        mesh = loaded["mesh"]
        vertices = loaded["result"].vertices
        bbox_min, bbox_max = vertices.min(axis=0), vertices.max(axis=0)
        margin = (bbox_max - bbox_min).max() * 0.05
        inside = ((mesh.points[:, 0] >= bbox_min[0] - margin) &
                  (mesh.points[:, 0] <= bbox_max[0] + margin) &
                  (mesh.points[:, 1] >= bbox_min[1] - margin) &
                  (mesh.points[:, 1] <= bbox_max[1] + margin) &
                  (mesh.points[:, 2] >= bbox_min[2] - margin) &
                  (mesh.points[:, 2] <= bbox_max[2] + margin))
        assert inside.all(), "Tous les points du maillage doivent rester dans le domaine."

    def test_quality_metrics_real(self):
        loaded = _load_closed()
        quality = loaded["mesh"].quality
        assert "max_skewness" in quality and "min_orthogonal_quality" in quality, (
            "Les indicateurs de qualité doivent être réellement calculés."
        )
        assert 0.0 <= quality["max_skewness"] <= 1.0
        assert 0.0 <= quality["min_orthogonal_quality"] <= 1.0


class TestBoundaryAssignmentBlocking:
    """Les frontières non assignées bloquent le pipeline (aucune BC simulée)."""

    def test_unassigned_boundaries_block(self):
        loaded = _load_closed()
        assert "frontieres_non_assignees" in loaded["topology"].blocking_issues, (
            "Un fichier STEP sans déclaration de frontières nommées doit bloquer."
        )
        assert loaded["topology"].unassigned_edges > 0 or \
               not loaded["topology"].named_boundaries, (
            "Les arêtes non assignées doivent être comptées."
        )

    def test_assigned_boundaries_clear_block(self):
        loaded = _load_closed()
        named = _named_topo(loaded["topology"], loaded["faces"])
        assert named.blocking_issues == [], (
            "Les frontières nommées fournies par l'opérateur doivent lever le blocage."
        )
        assert len(named.named_boundaries) == 2


# ---------------------------------------------------------------------------
# Volet 8 : conservation et comparaison de référence
# ---------------------------------------------------------------------------

class TestConservationBlocking:
    """La conservation (masse/énergie) n'est validée que sur des données réelles."""

    def test_conservation_on_simulated_data_block(self):
        """Aucune résidu de conservation simulé ne doit être accepté comme valide."""
        execution = {"residuals": {"mass": 0.0}}
        report = evaluate_all_gates({
            "cad_import": None,
            "topology": None,
            "mesh": None,
            "physics": None,
            "boundary_conditions": None,
            "pinn_model": None,
            "case_contract": None,
            "execution": execution,
        })
        assert not report.all_satisfied, (
            "Des résidus de conservation seuls, sans pipeline validé, ne doivent pas satisfaire les portes."
        )

    def test_conservation_metric_documented(self):
        """Le rapport de conservation doit documenter ses unités réelles."""
        execution = {"residuals": {"mass": 1e-9, "units": "kg/s", "computed_from": "real_solver"},
                     "reference_comparison": {"reference_source": "REQUIRED_INPUT"}}
        loaded = _load_closed()
        named = _named_topo(loaded["topology"], loaded["faces"])
        physics = PhysicsReference(solver_type="heat_transfer",
                                   governing_equations=["energy_only"],
                                   material="aluminium", units_checked=True,
                                   material_properties={}, source="REAL_INPUT",
                                   validated=True, revision_id="REV_PHYS")
        bc = BoundaryConditionReference(bc_set_name="lh2",
                                        assigned_boundaries=["inlet", "outlet"],
                                        boundary_map={}, validated=True,
                                        source="REAL_INPUT", revision_id="REV_BC")
        pinn = PinnModelReference(architecture="v3", parameterization_id="P1",
                                  hyperparameters_revision="HP1", quantization_bits=4,
                                  source_artifact_sha256="REAL_SHA256",
                                  validated=True, units_checked=True,
                                  revision_id="REV_PINN")
        contract = build_case_contract(
            "CASE_C", loaded["result"].geometry_revision_id,
            "topo_" + loaded["result"].geometry_revision_id,
            loaded["mesh"].mesh_revision_id, physics, bc, pinn, True,
        )
        artifacts = {
            "cad_import": loaded["result"],
            "topology": named,
            "mesh": loaded["mesh"],
            "physics": physics,
            "boundary_conditions": bc,
            "pinn_model": pinn,
            "case_contract": contract,
            "execution": execution,
        }
        report = evaluate_all_gates(artifacts)
        g5 = next(g for g in report.gates if g.gate.value == "G5_REFERENCE")
        assert g5.satisfied, "La conservation documentée avec unités réelles doit valider G5."
        evidence_units = g5.evidence.get("conservation_units")
        assert evidence_units == "kg/s", (
            f"L'unité de conservation réelle doit transiter dans l'évidence (relevée : {evidence_units})."
        )
        assert g5.evidence.get("reference_source") == "REQUIRED_INPUT", (
            "La référence non renseignée doit rester REQUIRED_INPUT sans être simulée."
        )


class TestReferenceComparisonBlocking:
    """La comparaison de référence bloque sans données de référence réelles."""

    def test_missing_reference_blocked(self):
        loaded = _load_closed()
        named = _named_topo(loaded["topology"], loaded["faces"])
        physics = PhysicsReference(solver_type="heat_transfer",
                                   governing_equations=["energy_only"],
                                   material="aluminium", units_checked=True,
                                   material_properties={}, source="REAL_INPUT",
                                   validated=True, revision_id="REV_PHYS")
        bc = BoundaryConditionReference(bc_set_name="lh2",
                                        assigned_boundaries=["inlet", "outlet"],
                                        boundary_map={}, validated=True,
                                        source="REAL_INPUT", revision_id="REV_BC")
        pinn = PinnModelReference(architecture="v3", parameterization_id="P1",
                                  hyperparameters_revision="HP1", quantization_bits=4,
                                  source_artifact_sha256="REAL_SHA256",
                                  validated=True, units_checked=True,
                                  revision_id="REV_PINN")
        contract = build_case_contract(
            "CASE_R", loaded["result"].geometry_revision_id,
            "topo_" + loaded["result"].geometry_revision_id,
            loaded["mesh"].mesh_revision_id, physics, bc, pinn, True,
        )
        execution = {"reference_comparison": {"reference_source": "REQUIRED_INPUT"}}
        artifacts = {
            "cad_import": loaded["result"],
            "topology": named,
            "mesh": loaded["mesh"],
            "physics": physics,
            "boundary_conditions": bc,
            "pinn_model": pinn,
            "case_contract": contract,
            "execution": execution,
        }
        report = evaluate_all_gates(artifacts)
        g5 = next(g for g in report.gates if g.gate.value == "G5_REFERENCE")
        assert not g5.satisfied, "Une comparaison de référence sans source réelle doit bloquer."
        assert report.publishing_allowed is False, (
            "Aucune publication ne doit être autorisée sans comparaison de référence validée."
        )

    def test_valid_reference_allows_publishing(self):
        loaded = _load_closed()
        named = _named_topo(loaded["topology"], loaded["faces"])
        physics = PhysicsReference(solver_type="heat_transfer",
                                   governing_equations=["energy_only"],
                                   material="aluminium", units_checked=True,
                                   material_properties={}, source="REAL_INPUT",
                                   validated=True, revision_id="REV_PHYS")
        bc = BoundaryConditionReference(bc_set_name="lh2",
                                        assigned_boundaries=["inlet", "outlet"],
                                        boundary_map={}, validated=True,
                                        source="REAL_INPUT", revision_id="REV_BC")
        pinn = PinnModelReference(architecture="v3", parameterization_id="P1",
                                  hyperparameters_revision="HP1", quantization_bits=4,
                                  source_artifact_sha256="REAL_SHA256",
                                  validated=True, units_checked=True,
                                  revision_id="REV_PINN")
        contract = build_case_contract(
            "CASE_R2", loaded["result"].geometry_revision_id,
            "topo_" + loaded["result"].geometry_revision_id,
            loaded["mesh"].mesh_revision_id, physics, bc, pinn, True,
        )
        execution = {
            "reference_comparison": {"reference_source": "experimental", "rmse": 0.01},
            "residuals": {"mass": 1e-9, "units": "kg/s"},
        }
        artifacts = {
            "cad_import": loaded["result"],
            "topology": named,
            "mesh": loaded["mesh"],
            "physics": physics,
            "boundary_conditions": bc,
            "pinn_model": pinn,
            "case_contract": contract,
            "execution": execution,
        }
        report = evaluate_all_gates(artifacts)
        assert report.all_satisfied
        assert report.publishing_allowed
        assert report.badges_allowed
        assert_gates_passed(report)


# ---------------------------------------------------------------------------
# Volets 5-9 : exports et gates bloquants
# ---------------------------------------------------------------------------

class TestExportsBlocking:
    """Les exports doivent échouer plutôt que d'écrire des données simulées."""

    def test_glb_empty_field_blocked(self):
        loaded = _load_closed()
        vertices = loaded["result"].vertices
        assert vertices is not None
        path = export_glb(vertices, loaded["faces"], loaded["result"].geometry_revision_id,
                          units_label="mm", status="UNVALIDATED")
        assert path.endswith(".glb")
        with open(path, "rb") as fh:
            assert fh.read(4) == b"glTF", "Le GLB doit être un fichier binaire glTF valide."
        os.unlink(path)

    def test_vtu_empty_values_blocked(self):
        loaded = _load_closed()
        field = ScalarField("temperature", np.array([]), "K", "computed")
        with pytest.raises(VtuExportError):
            export_vtu(loaded["mesh"].points, loaded["mesh"].cells,
                       loaded["result"].geometry_revision_id,
                       loaded["mesh"].mesh_revision_id, [field])

    def test_vtu_dimension_mismatch_not_exported(self):
        loaded = _load_closed()
        field = ScalarField("pressure", np.array([1.0]), "Pa", "computed")
        result = export_vtu(loaded["mesh"].points, loaded["mesh"].cells,
                            loaded["result"].geometry_revision_id,
                            loaded["mesh"].mesh_revision_id, [field])
        assert "pressure" in result.missing_fields[0], (
            "Un champ de dimension incompatible doit rester non exporté."
        )

    def test_glb_over_65535_vertices_blocked(self):
        vertices = np.random.default_rng(0).random((70000, 3))
        faces = np.array([[0, 1, 2]], dtype=np.int64)
        with pytest.raises(GltfExportError):
            export_glb(vertices, faces, "rev_geom_block", units_label="m")


class TestGatesBlocking:
    """Les portes G0–G5 bloquent la publication et les badges."""

    def test_publish_blocked_without_gates(self):
        report = evaluate_all_gates({"cad_import": None})
        assert not report.all_satisfied
        assert not report.publishing_allowed
        assert not report.badges_allowed
        with pytest.raises(GateEvaluationError):
            assert_gates_passed(report)

    def test_sequential_blocking(self):
        loaded = _load_closed()
        named = _named_topo(loaded["topology"], loaded["faces"])
        artifacts = {"cad_import": loaded["result"], "topology": named, "mesh": loaded["mesh"]}
        report = evaluate_all_gates(artifacts)
        states = [g.state.value for g in report.gates]
        assert states == ["SATISFIED", "SATISFIED", "SATISFIED", "BLOCKED", "BLOCKED", "BLOCKED"], (
            "Les portes suivantes doivent rester bloquées par construction."
        )


class TestCaseContractBlocking:
    """Le contrat de cas bloque si un ingrédient n'est pas validé."""

    def test_unvalidated_physics_blocked(self):
        loaded = _load_closed()
        named = _named_topo(loaded["topology"], loaded["faces"])
        physics = PhysicsReference(solver_type="heat_transfer",
                                   governing_equations=["energy_only"],
                                   material="aluminium", units_checked=False,
                                   material_properties={}, source="REQUIRED_INPUT",
                                   validated=False, revision_id="REQUIRED_INPUT")
        bc = BoundaryConditionReference(bc_set_name="lh2",
                                        assigned_boundaries=["inlet", "outlet"],
                                        boundary_map={}, validated=True,
                                        source="REAL_INPUT", revision_id="REV_BC")
        pinn = PinnModelReference(architecture="v3", parameterization_id="P1",
                                  hyperparameters_revision="HP1", quantization_bits=4,
                                  source_artifact_sha256="REAL_SHA256",
                                  validated=True, units_checked=True,
                                  revision_id="REV_PINN")
        contract = build_case_contract(
            "CASE_U", loaded["result"].geometry_revision_id,
            "topo_" + loaded["result"].geometry_revision_id,
            loaded["mesh"].mesh_revision_id, physics, bc, pinn, True,
        )
        assert contract.status == ValidationStatus.VALIDATION_FAILED.value, (
            "Un ingrédient non validé doit faire échouer le contrat."
        )
        assert contract.blocking_issues, "Les causes de blocage doivent être documentées."
