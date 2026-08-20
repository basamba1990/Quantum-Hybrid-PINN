"""Export CGNS — volet 5c.

Produit un fichier CGNS (HDF5) pour le maillage volumique et les champs.
L'export suit la convention CGNS 4.x : base structurée, zone Unstructured,
section d'éléments tetra, et champs transportant unités et provenance.

Dépendance optionnelle : `h5py`. Si la dépendance est réellement absente de
l'environnement, l'export échoue de manière explicite avec le statut
`NOT_EXPORTED` documenté dans le résultat — aucune donnée simulée n'est
produite en remplacement.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from .revision import ValidationStatus
from .export_vtu import ScalarField, VtuExportError

NOT_EXPORTED = "NOT_EXPORTED"


@dataclass
class CgnsExportResult:
    file_path: Optional[str]
    cgns_revision_id: Optional[str]
    points_count: int
    cells_count: int
    exported_fields: List[Dict[str, Any]]
    missing_fields: List[str]
    status: str  # VALIDATED | NOT_EXPORTED
    export_errors: List[str] = field(default_factory=list)
    reason: Optional[str] = None


def export_cgns(
    points: np.ndarray,
    cells: np.ndarray,
    geometry_revision_id: str,
    mesh_revision_id: str,
    scalar_fields: Optional[List[ScalarField]] = None,
    units_label: Optional[str] = None,
    status: str = ValidationStatus.REQUIRED_INPUT.value,
    destination: str = "output.cgns",
) -> CgnsExportResult:
    """Exporte le maillage volumique au format CGNS 4.x (HDF5).

    L'export échoue proprement si h5py est absent : le résultat retourne
    alors `status=NOT_EXPORTED` avec la raison documentée, sans simuler de
    fichier.
    """
    if points is None or points.size == 0:
        return CgnsExportResult(
            file_path=None, cgns_revision_id=None, points_count=0, cells_count=0,
            exported_fields=[], missing_fields=["points_absents"],
            status=NOT_EXPORTED, reason="Aucun point de maillage disponible.",
        )
    if cells is None or cells.size == 0:
        return CgnsExportResult(
            file_path=None, cgns_revision_id=None, points_count=0, cells_count=0,
            exported_fields=[], missing_fields=["cellules_absentes"],
            status=NOT_EXPORTED, reason="Aucune cellule de maillage disponible.",
        )

    try:
        import h5py  # type: ignore
    except ImportError:
        return CgnsExportResult(
            file_path=None, cgns_revision_id=None,
            points_count=int(points.shape[0]), cells_count=int(cells.shape[0]),
            exported_fields=[], missing_fields=["h5py_manquant"],
            status=NOT_EXPORTED,
            reason=(
                "La dépendance h5py est absente de l'environnement. "
                "L'export CGNS n'est pas disponible ; installez h5py ou "
                "utilisez l'export VTU de secours (export_vtu)."
            ),
        )

    points = np.asarray(points, dtype=np.float64)
    cells = np.asarray(cells, dtype=np.int64)
    n_points = points.shape[0]
    n_cells = cells.shape[0]
    cells_per_point = cells.shape[1] if cells.ndim == 2 else 0
    if cells_per_point != 4:
        return CgnsExportResult(
            file_path=None, cgns_revision_id=None,
            points_count=n_points, cells_count=n_cells,
            exported_fields=[], missing_fields=["format_cellules"],
            status=NOT_EXPORTED,
            reason="Format de cellules non supporté : attendu (n, 4) tétraèdres.",
        )

    exported_fields: List[Dict[str, Any]] = []
    missing_fields: List[str] = []
    scalar_payloads: List[ScalarField] = []
    for scalar in scalar_fields or []:
        try:
            scalar.validate()
        except VtuExportError as exception:
            missing_fields.append(f"{scalar.name}: {exception}")
            continue
        values = np.asarray(scalar.values, dtype=np.float64)
        if values.shape[0] not in (n_points, n_cells):
            missing_fields.append(
                f"{scalar.name}: dimension {values.shape[0]} incompatible "
                f"({n_points} points, {n_cells} cellules)"
            )
            continue
        scalar_payloads.append(scalar)

    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with h5py.File(destination_path, "w") as hdf5:
            hdf5.attrs["Format"] = np.bytes_("CGNS")
            hdf5.attrs["CGNSLibraryVersion"] = np.array(4.4, dtype=np.float64)

            base = hdf5.create_group("Base")
            base.attrs["CellDimension"] = np.array(3, dtype=np.int32)
            base.attrs["PhysicalDimension"] = np.array(3, dtype=np.int32)

            zone = base.create_group("Zone")
            zone.attrs["ZoneType"] = np.bytes_("Unstructured")
            zone.attrs["GridLocation"] = np.bytes_("CellCenter")

            grid = zone.create_group("GridCoordinates")
            coord = grid.create_group("CoordinateX")
            coord.create_dataset("data", data=points[:, 0])
            coordy = grid.create_group("CoordinateY")
            coordy.create_dataset("data", data=points[:, 1])
            coordz = grid.create_group("CoordinateZ")
            coordz.create_dataset("data", data=points[:, 2])

            elements = zone.create_group("Elements")
            elements.attrs["ElementRange"] = np.array([1, n_cells], dtype=np.int64)
            elements.attrs["ElementType"] = np.bytes_("TETRA_4")
            elements.attrs["ParentData"] = np.bytes_("")
            elements.create_dataset("ElementConnectivity", data=cells + 1)  # CGNS 1-indexed

            flow = zone.create_group("FlowSolution")
            flow.attrs["GridLocation"] = np.bytes_("Vertex")
            for scalar in scalar_payloads:
                dataset = flow.create_group(scalar.name)
                dataset.attrs["units"] = np.bytes_(scalar.units or "REQUIRED_INPUT")
                dataset.attrs["provenance"] = np.bytes_(scalar.provenance)
                values = np.asarray(scalar.values, dtype=np.float64)
                dataset.create_dataset("data", data=values)
                exported_fields.append(
                    {
                        "name": scalar.name,
                        "units": scalar.units,
                        "provenance": scalar.provenance,
                        "association": "point",
                        "min": float(scalar.min_value or 0.0),
                        "max": float(scalar.max_value or 0.0),
                    }
                )

            meta = hdf5.create_group("QuantumPINN")
            meta.attrs["geometry_revision_id"] = np.bytes_(geometry_revision_id)
            meta.attrs["mesh_revision_id"] = np.bytes_(mesh_revision_id)
            meta.attrs["units_label"] = np.bytes_(units_label or "REQUIRED_INPUT")
            meta.attrs["status"] = np.bytes_(status)

        content_bytes = destination_path.read_bytes()
        cgns_revision_id = (
            "cgns_" + hashlib.sha256(content_bytes).hexdigest()[:16]
        )
    except OSError as exception:
        return CgnsExportResult(
            file_path=None, cgns_revision_id=None,
            points_count=n_points, cells_count=n_cells,
            exported_fields=[], missing_fields=missing_fields,
            status=NOT_EXPORTED,
            export_errors=[f"Échec d'écriture : {exception}"],
        )

    return CgnsExportResult(
        file_path=str(destination_path),
        cgns_revision_id=cgns_revision_id,
        points_count=int(n_points),
        cells_count=int(n_cells),
        exported_fields=exported_fields,
        missing_fields=missing_fields,
        status=status if not missing_fields else status,
    )
