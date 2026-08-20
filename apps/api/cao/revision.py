"""
revision.py — Identités immuables et statuts de provenance.

Ce module est le socle du pipeline CAO : toute entité (géométrie, maillage,
modèle PINN, BC) est identifiée par un identifiant de révision immuable et
porte un statut de provenance. Aucune valeur physique absente n'est jamais
remplacée par une valeur simulée : les champs manquants restent
`REQUIRED_INPUT` et le statut reste `UNVALIDATED` jusqu'à preuve du contraire.
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class ValidationStatus(str, Enum):
    """Statut de provenance d'une entité du pipeline."""

    REQUIRED_INPUT = "REQUIRED_INPUT"   # Donnée attendue mais absente : blocage
    UNVALIDATED = "UNVALIDATED"         # Donnée présente mais non encore prouvée
    VALIDATED = "VALIDATED"             # Donnée vérifiée par un test bloquant
    VALIDATION_FAILED = "VALIDATION_FAILED"  # Donnée en échec sur un contrôle
    SIMULATED = "SIMULATED"             # Valeur de démonstration uniquement


class GateId(str, Enum):
    G0_SOURCE = "G0_SOURCE"
    G1_TOPOLOGY = "G1_TOPOLOGY"
    G2_MESH = "G2_MESH"
    G3_PHYSICS = "G3_PHYSICS"
    G4_NUMERICAL = "G4_NUMERICAL"
    G5_REFERENCE = "G5_REFERENCE"


class GateState(str, Enum):
    SATISFIED = "SATISFIED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"
    NOT_RUN = "NOT_RUN"


class ReportStatus(str, Enum):
    DRAFT = "DRAFT"
    READY_FOR_RUN = "READY_FOR_RUN"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    VALIDATED = "VALIDATED"


def new_immutable_revision_id(prefix: str, source_bytes: Optional[bytes] = None) -> str:
    """
    Crée un identifiant de révision immuable au format `rev_<prefix>_<uuidv4>`.
    Si les octets source sont fournis, le préfixe est préfixé du hash SHA-256
    sur 16 caractères hexadécimaux, ce qui garantit qu'un fichier différent
    produit une révision différente.
    """
    prefix = prefix.strip().lower().replace(" ", "_")[:40] or "unk"
    if source_bytes is not None:
        # Token entièrement déterministe : un même fichier produit toujours la
        # même révision immuable ; aucun aléa n'est introduit.
        digest = hashlib.sha256(source_bytes).hexdigest()
        token = f"{digest[:16]}_{digest[16:28]}"
    else:
        token = uuid.uuid4().hex[:28]
    return f"rev_{prefix}_{token}"


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


@dataclass(frozen=True)
class RevisionRecord:
    """Enregistrement immuable d'une révision du pipeline."""

    revision_id: str
    kind: str  # "geometry" | "mesh" | "pinn_model" | "case"
    source_sha256: Optional[str]
    created_at: str = field(default_factory=now_utc_iso)
