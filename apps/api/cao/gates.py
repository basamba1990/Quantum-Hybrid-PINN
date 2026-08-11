"""Portes de validation G0–G5 et contrôle de publication — volet 9.

Les portes sont évaluées séquentiellement et de manière bloquante : la porte
G(k+1) n'est jamais atteinte tant que G(k) n'est pas satisfaite. Chaque porte
exige des artefacts réellement présents et validés ; aucun score simulé,
aucune validation codée en dur.

- G0 : géométrie CAO importée (révision immuable, unités détectées).
- G1 : topologie validée (solide fermé, pas d'intersection, frontières nommées).
- G2 : maillage volumique validé (qualité contrôlée, cellules positives).
- G3 : physique et conditions aux limites assignées (matériau, unités).
- G4 : modèle PINN référencé par révision et contraction du cas émise.
- G5 : exécution de référence satisfaite (résidus de conservation et
  comparaison de référence, uniquement si ces données existent réellement).

La publication LinkedIn et les badges « converged/validated » sont interdits
tant que les cinq portes ne sont pas toutes satisfaites.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .revision import GateId, GateState, ValidationStatus, now_utc_iso


def _safe_get(obj, name, default):
    """Lit un attribut ou une clé dict sans ambiguïté booléenne sur numpy arrays."""
    value = getattr(obj, name, default) if not isinstance(obj, dict) else obj.get(name, default)
    return value



class GateEvaluationError(Exception):
    """Une porte a échoué de manière bloquante."""


@dataclass
class GateResult:
    gate: GateId
    state: GateState
    satisfied: bool
    checked_at: str
    reasons: List[str] = field(default_factory=list)
    evidence: Dict[str, Any] = field(default_factory=dict)


def _state_for(satisfied: bool, reasons: List[str]) -> GateState:
    if satisfied:
        return GateState.SATISFIED
    return GateState.BLOCKED


def _result(gate: GateId, satisfied: bool, reasons: List[str], evidence: Dict[str, Any]) -> GateResult:
    return GateResult(
        gate=gate,
        state=_state_for(satisfied, reasons),
        satisfied=satisfied,
        checked_at=now_utc_iso(),
        reasons=reasons,
        evidence=evidence,
    )


def evaluate_g0(artifacts: Dict[str, Any]) -> GateResult:
    """G0 — géométrie CAO importée avec révision immuable et unités détectées."""
    reasons: List[str] = []
    evidence: Dict[str, Any] = {}
    cad = artifacts.get("cad_import")
    if cad is None:
        return _result(GateId.G0_SOURCE, False, ["Aucun import CAO fourni."], {})
    revision_id = getattr(cad, "geometry_revision_id", None) or cad.get("geometry_revision_id")
    units_factor = getattr(cad, "unit_factor", None) or (cad.get("unit_factor") if isinstance(cad, dict) else None)
    vertices = _safe_get(cad, "vertices", None)
    evidence["geometry_revision_id"] = revision_id or "absent"
    if not revision_id:
        reasons.append("Révision immuable de géométrie absente.")
    if units_factor is None:
        reasons.append("Unités de longueur non détectées : REQUIRED_INPUT.")
        evidence["units_checked"] = False
    else:
        evidence["units_checked"] = True
    if vertices is None:
        reasons.append("Aucune géométrie de surface extraite.")
    satisfied = not reasons
    if satisfied:
        evidence["status"] = ValidationStatus.VALIDATED.value
    return _result(GateId.G0_SOURCE, satisfied, reasons, evidence)


def evaluate_g1(artifacts: Dict[str, Any], g0: GateResult) -> GateResult:
    """G1 — topologie validée : solide fermé, sans intersection, frontières nommées."""
    if not g0.satisfied:
        return _result(GateId.G1_TOPOLOGY, False, [f"Porte précédente non satisfaite : {g0.gate.value}."], {})
    reasons: List[str] = []
    evidence: Dict[str, Any] = {}
    topo = artifacts.get("topology")
    if topo is None:
        return _result(GateId.G1_TOPOLOGY, False, ["Aucun rapport topologique fourni."], {})
    closed = getattr(topo, "closed_solids", False) or (topo.get("closed_solids") if isinstance(topo, dict) else False)
    intersections = getattr(topo, "self_intersections", 0) or (topo.get("self_intersections") if isinstance(topo, dict) else 0) or 0
    evidence["closed_solids"] = bool(closed)
    evidence["self_intersections"] = int(intersections)
    if not closed:
        reasons.append("Le solide de surface n'est pas fermé (arêtes de bord détectées).")
    if int(intersections) > 0:
        reasons.append(f"{int(intersections)} auto-intersection(s) détectée(s).")
    boundaries = _safe_get(topo, "named_boundaries", [])
    evidence["named_boundaries"] = [b.name if hasattr(b, "name") else b for b in boundaries]
    if not boundaries:
        reasons.append("Aucune frontière nommée déclarée : conditions aux limites non assignables.")
    satisfied = not reasons
    if satisfied:
        evidence["status"] = ValidationStatus.VALIDATED.value
    return _result(GateId.G1_TOPOLOGY, satisfied, reasons, evidence)


def evaluate_g2(artifacts: Dict[str, Any], g1: GateResult) -> GateResult:
    """G2 — maillage volumique validé avec contrôle qualité."""
    if not g1.satisfied:
        return _result(GateId.G2_MESH, False, [f"Porte précédente non satisfaite : {g1.gate.value}."], {})
    reasons: List[str] = []
    evidence: Dict[str, Any] = {}
    mesh = artifacts.get("mesh")
    if mesh is None:
        return _result(GateId.G2_MESH, False, ["Aucun rapport de maillage fourni."], {})
    validated = getattr(mesh, "validated", False) or (mesh.get("validated") if isinstance(mesh, dict) else False)
    blocking = _safe_get(mesh, "blocking_issues", [])
    cells_count = _safe_get(mesh, "cells_count", 0)
    evidence["mesh_revision_id"] = getattr(mesh, "mesh_revision_id", None) or (mesh.get("mesh_revision_id") if isinstance(mesh, dict) else None)
    evidence["cells_count"] = int(cells_count)
    evidence["blocking_issues"] = list(blocking)
    if not validated:
        reasons.append(f"Maillage non validé : {', '.join(blocking) if blocking else 'échec de contrôle qualité'}.")
    if int(cells_count) == 0:
        reasons.append("Aucune cellule volumique générée.")
    satisfied = not reasons
    if satisfied:
        evidence["status"] = ValidationStatus.VALIDATED.value
    return _result(GateId.G2_MESH, satisfied, reasons, evidence)


def evaluate_g3(artifacts: Dict[str, Any], g2: GateResult) -> GateResult:
    """G3 — physique et conditions aux limites : matériau, unités, frontières assignées."""
    if not g2.satisfied:
        return _result(GateId.G3_PHYSICS, False, [f"Porte précédente non satisfaite : {g2.gate.value}."], {})
    reasons: List[str] = []
    evidence: Dict[str, Any] = {}
    physics = artifacts.get("physics")
    if physics is None:
        return _result(GateId.G3_PHYSICS, False, ["Aucune référence physique fournie."], {})
    material = _safe_get(physics, "material", "REQUIRED_INPUT")
    units_checked = _safe_get(physics, "units_checked", False)
    equations = _safe_get(physics, "governing_equations", [])
    evidence["material"] = material
    evidence["units_checked"] = bool(units_checked)
    evidence["equations"] = list(equations)
    if not material or material in ("REQUIRED_INPUT", "UNVALIDATED"):
        reasons.append("Matériau non renseigné ou non validé.")
    if not units_checked:
        reasons.append("Vérification des unités de la physique non effectuée.")
    if not equations:
        reasons.append("Aucune équation gouvernante déclarée.")
    bc = artifacts.get("boundary_conditions")
    if bc is None:
        reasons.append("Aucun ensemble de conditions aux limites fourni.")
    else:
        assigned = _safe_get(bc, "assigned_boundaries", [])
        validated_bc = _safe_get(bc, "validated", False)
        evidence["assigned_boundaries"] = list(assigned)
        if not assigned:
            reasons.append("Aucune frontière nommée assignée à une condition aux limites.")
        if not validated_bc:
            reasons.append("Conditions aux limites non validées.")
    satisfied = not reasons
    if satisfied:
        evidence["status"] = ValidationStatus.VALIDATED.value
    return _result(GateId.G3_PHYSICS, satisfied, reasons, evidence)


def evaluate_g4(artifacts: Dict[str, Any], g3: GateResult) -> GateResult:
    """G4 — modèle PINN référencé et contrat de cas émis et validé."""
    if not g3.satisfied:
        return _result(GateId.G4_NUMERICAL, False, [f"Porte précédente non satisfaite : {g3.gate.value}."], {})
    reasons: List[str] = []
    evidence: Dict[str, Any] = {}
    pinn = artifacts.get("pinn_model")
    if pinn is None:
        return _result(GateId.G4_NUMERICAL, False, ["Aucune référence de modèle PINN fournie."], {})
    pinn_validated = getattr(pinn, "validated", False) or (pinn.get("validated") if isinstance(pinn, dict) else False)
    pinn_revision = (
        _safe_get(pinn, "revision_id", None)
        or _safe_get(pinn, "source_artifact_sha256", "REQUIRED_INPUT")
        or "REQUIRED_INPUT"
    )
    evidence["pinn_revision_id"] = pinn_revision
    if not pinn_validated:
        reasons.append("Modèle PINN non validé.")
    contract = artifacts.get("case_contract")
    if contract is None:
        return _result(GateId.G4_NUMERICAL, False, ["Aucun contrat de cas émis."], {})
    contract_status = _safe_get(contract, "status", "REQUIRED_INPUT")
    contract_revision = _safe_get(contract, "contract_revision_id", None)
    evidence["contract_revision_id"] = contract_revision
    if contract_status != ValidationStatus.VALIDATED.value:
        reasons.append(f"Contrat de cas non validé : statut {contract_status}.")
    satisfied = not reasons
    if satisfied:
        evidence["status"] = ValidationStatus.VALIDATED.value
    return _result(GateId.G4_NUMERICAL, satisfied, reasons, evidence)


def evaluate_g5(artifacts: Dict[str, Any], g4: GateResult) -> GateResult:
    """G5 — exécution de référence : conservation et comparaison de référence,
    uniquement si ces données existent réellement. Sinon la porte reste
    explicitement UNVALIDATED (jamais simulée)."""
    if not g4.satisfied:
        return _result(GateId.G5_REFERENCE, False, [f"Porte précédente non satisfaite : {g4.gate.value}."], {})
    reasons: List[str] = []
    evidence: Dict[str, Any] = {}
    execution = artifacts.get("execution")
    if execution is None:
        return _result(
            GateId.G5_REFERENCE, False,
            ["Aucune donnée d'exécution fournie : la porte G5 reste non validée.",
             "Aucune valeur simulée ne sera substituée."],
            {"status": ValidationStatus.UNVALIDATED.value},
        )
    residuals = getattr(execution, "residuals", None) or (execution.get("residuals") if isinstance(execution, dict) else None)
    reference = getattr(execution, "reference_comparison", None) or (execution.get("reference_comparison") if isinstance(execution, dict) else None)
    evidence["residuals_provided"] = residuals is not None
    evidence["reference_provided"] = reference is not None
    if isinstance(residuals, dict):
        evidence["conservation_units"] = residuals.get("units", "REQUIRED_INPUT")
        evidence["conservation_source"] = residuals.get("computed_from", "REQUIRED_INPUT")
    if isinstance(reference, dict):
        evidence["reference_source"] = reference.get("reference_source", "REQUIRED_INPUT")
    if residuals is None:
        reasons.append("Résidus de conservation non fournis.")
    if reference is None:
        reasons.append("Données de comparaison de référence non fournies.")
    satisfied = not reasons
    if satisfied:
        evidence["status"] = ValidationStatus.VALIDATED.value
    else:
        evidence["status"] = ValidationStatus.UNVALIDATED.value
    return _result(GateId.G5_REFERENCE, satisfied, reasons, evidence)


@dataclass
class GateReport:
    """Rapport séquentiel des cinq portes : évaluation bloquante."""

    gates: List[GateResult] = field(default_factory=list)
    all_satisfied: bool = False
    evaluated_at: str = ""
    publishing_allowed: bool = False
    badges_allowed: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gates": [
                {
                    "gate": g.gate.value,
                    "state": g.state.value,
                    "satisfied": g.satisfied,
                    "checked_at": g.checked_at,
                    "reasons": g.reasons,
                    "evidence": g.evidence,
                }
                for g in self.gates
            ],
            "all_satisfied": self.all_satisfied,
            "evaluated_at": self.evaluated_at,
            "publishing_allowed": self.publishing_allowed,
            "badges_allowed": self.badges_allowed,
        }


def evaluate_all_gates(artifacts: Dict[str, Any]) -> GateReport:
    """Évalue G0→G5 séquentiellement. La première porte échouée bloque tout."""
    now = now_utc_iso()
    results: List[GateResult] = []
    for evaluator in (evaluate_g0, evaluate_g1, evaluate_g2, evaluate_g3, evaluate_g4, evaluate_g5):
        previous = results[-1] if results else None
        if previous is not None and not previous.satisfied:
            # Portes suivantes bloquées par construction : aucun artefact
            # ultérieur n'est examiné, aucune validation simulée.
            results.append(
                _result(
                    list(GateId)[len(results)],
                    False,
                    [f"Évaluation bloquée par la porte précédente : {previous.gate.value}."],
                    {"status": ValidationStatus.UNVALIDATED.value},
                )
            )
            continue
        if evaluator is evaluate_g0:
            results.append(evaluator(artifacts))  # type: ignore[arg-type]
        elif evaluator is evaluate_g1:
            results.append(evaluator(artifacts, results[0]))
        elif evaluator is evaluate_g2:
            results.append(evaluator(artifacts, results[1]))
        elif evaluator is evaluate_g3:
            results.append(evaluator(artifacts, results[2]))
        elif evaluator is evaluate_g4:
            results.append(evaluator(artifacts, results[3]))
        else:
            results.append(evaluator(artifacts, results[4]))  # type: ignore[call-arg]

    all_satisfied = all(g.satisfied for g in results)
    return GateReport(
        gates=results,
        all_satisfied=all_satisfied,
        evaluated_at=now,
        publishing_allowed=all_satisfied,
        badges_allowed=all_satisfied,
    )


def assert_gates_passed(gate_report: GateReport) -> None:
    """Bloque toute opération exigeant la validation complète."""
    if not gate_report.all_satisfied:
        failed = [g.gate.value for g in gate_report.gates if not g.satisfied]
        raise GateEvaluationError(
            f"Opération bloquée : portes non satisfaites {failed}. "
            f"Aucun badge converged/validated et aucune publication ne sont autorisés."
        )
