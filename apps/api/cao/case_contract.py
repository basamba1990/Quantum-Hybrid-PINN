"""Contrat de cas immuable — volet 4.

Un cas de simulation industriel ne se construit jamais à partir de valeurs
simulées. Chaque ingrédient (géométrie, maillage, physique, conditions aux
limites, modèle PINN) est référencé par une révision immuable validée par
les portes correspondantes. Le contrat refuse toute construction dont un
ingrédient est manquant, non validé ou simulé : les champs absents restent
explicitement `REQUIRED_INPUT` et le contrat échoue en bloquant.

Ce module ne dépend d'aucune donnée CAO ou physique réellement absente : il
vérifie et assemble les artefacts déjà validés par `step_importer`,
`topology_validator`, `volume_mesher` et les services physiques du dépôt.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from .revision import GateId, GateState, ValidationStatus, now_utc_iso


REQUIRED_INPUT = "REQUIRED_INPUT"
UNVALIDATED = "UNVALIDATED"


class CaseContractError(Exception):
    """Le contrat ne peut pas être émis : ingrédient manquant ou non validé."""


@dataclass
class PhysicsReference:
    """Référence immuable vers la physique d'un cas."""

    solver_type: str  # ex: ns_incompressible, heat_transfer
    governing_equations: List[str]  # ex: mass_momentum_energy, energy_only
    material: str  # ex: LH2, aluminium_alloy_2219
    units_checked: bool = False
    material_properties: Dict[str, Any] = field(default_factory=dict)
    source: str = "REQUIRED_INPUT"
    validated: bool = False
    revision_id: str = "REQUIRED_INPUT"
    validation_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        return data


@dataclass
class BoundaryConditionReference:
    """Référence immuable vers un ensemble de conditions aux limites."""

    bc_set_name: str
    assigned_boundaries: List[str]
    boundary_map: Dict[str, List[int]] = field(default_factory=dict)
    units_checked: bool = False
    source: str = "REQUIRED_INPUT"
    validated: bool = False
    revision_id: str = "REQUIRED_INPUT"
    validation_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["boundary_map"] = {
            name: list(faces) for name, faces in self.boundary_map.items()
        }
        return data


@dataclass
class PinnModelReference:
    """Référence immuable vers un modèle PINN enregistré."""

    architecture: str  # ex: quantum_hybrid_pinns_v3
    parameterization_id: str
    hyperparameters_revision: str
    quantization_bits: int = 4
    source_artifact_sha256: Optional[str] = None
    units_checked: bool = False
    source: str = "REQUIRED_INPUT"
    validated: bool = False
    revision_id: str = "REQUIRED_INPUT"
    validation_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CaseContract:
    """Contrat immuable référençant géométrie, maillage, physique, BC et PINN."""

    case_id: str
    contract_revision_id: str  # SHA-256 du contenu complet
    geometry_revision_id: str
    topology_report_id: Optional[str]
    mesh_revision_id: str
    physics: PhysicsReference
    boundary_conditions: BoundaryConditionReference
    pinn_model: PinnModelReference
    created_at: str
    ingredients_checksum: str
    status: str = ValidationStatus.REQUIRED_INPUT.value
    blocking_issues: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["physics"] = self.physics.to_dict()
        data["boundary_conditions"] = self.boundary_conditions.to_dict()
        data["pinn_model"] = self.pinn_model.to_dict()
        return data


def _content_checksum(payload: Dict[str, Any]) -> str:
    """Révision immuable dérivée du contenu complet du contrat."""
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _validate_ingredient(name: str, validated: bool, revision_id: str) -> Optional[str]:
    """Un ingrédient est accepté uniquement s'il est explicitement validé."""
    if not validated:
        return f"ingrediente_non_valide:{name}"
    if not revision_id or revision_id in (REQUIRED_INPUT, UNVALIDATED):
        return f"revision_manquante:{name}"
    return None


def build_case_contract(
    case_id: str,
    geometry_revision_id: str,
    topology_report_id: Optional[str],
    mesh_revision_id: str,
    physics: PhysicsReference,
    boundary_conditions: BoundaryConditionReference,
    pinn_model: PinnModelReference,
    topology_validated: bool = False,
) -> CaseContract:
    """Émet un contrat de cas immuable, en échec bloquant si un ingrédient
    est manquant ou non validé. Aucun ingrédient simulé n'est accepté."""
    errors: List[str] = []
    blocking: List[str] = []

    ingredient_issues = [
        _validate_ingredient("geometry", True, geometry_revision_id),
        _validate_ingredient("topology", topology_validated and topology_report_id is not None, topology_report_id or REQUIRED_INPUT),
        _validate_ingredient("mesh", True, mesh_revision_id),
        _validate_ingredient("physics", physics.validated, physics.revision_id),
        _validate_ingredient("boundary_conditions", boundary_conditions.validated, boundary_conditions.revision_id),
        _validate_ingredient("pinn_model", pinn_model.validated, pinn_model.revision_id),
    ]
    for issue in ingredient_issues:
        if issue is not None:
            blocking.append(issue)
            errors.append(f"Contrat rejeté : {issue.replace('_', ' ')} — aucun ingrédient simulé n'est accepté.")

    if not boundary_conditions.assigned_boundaries:
        blocking.append("frontieres_non_assignees")
        errors.append("Aucune frontière nommée n'est assignée à une condition aux limites.")

    if not physics.governing_equations:
        blocking.append("equations_gouvernantes_absentes")
        errors.append("Aucune équation gouvernante déclarée dans la physique du cas.")

    if not physics.material or physics.material in (REQUIRED_INPUT, UNVALIDATED):
        blocking.append("materiau_manquant")
        errors.append("Le matériau du cas est manquant ou non validé.")

    status = ValidationStatus.REQUIRED_INPUT.value
    if not blocking:
        status = ValidationStatus.VALIDATED.value
    elif any(ingredient in issue for issue in blocking for ingredient in ("revision_manquante", "ingrediente_non_valide")):
        status = ValidationStatus.VALIDATION_FAILED.value

    now = now_utc_iso()
    payload = {
        "case_id": case_id,
        "geometry_revision_id": geometry_revision_id,
        "topology_report_id": topology_report_id,
        "mesh_revision_id": mesh_revision_id,
        "physics": physics.to_dict(),
        "boundary_conditions": boundary_conditions.to_dict(),
        "pinn_model": pinn_model.to_dict(),
        "created_at": now,
        "status": status,
    }
    ingredients_checksum = _content_checksum(payload)

    return CaseContract(
        case_id=case_id,
        contract_revision_id=f"contract_{case_id}_{ingredients_checksum[:16]}",
        geometry_revision_id=geometry_revision_id,
        topology_report_id=topology_report_id,
        mesh_revision_id=mesh_revision_id,
        physics=physics,
        boundary_conditions=boundary_conditions,
        pinn_model=pinn_model,
        created_at=now,
        ingredients_checksum=ingredients_checksum,
        status=status,
        blocking_issues=blocking,
        errors=errors,
    )


def save_case_contract(contract: CaseContract, destination: str) -> str:
    """Persiste le contrat au format JSON immuable et retourne le chemin."""
    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.write_text(json.dumps(contract.to_dict(), indent=2, ensure_ascii=False))
    return str(destination_path)
