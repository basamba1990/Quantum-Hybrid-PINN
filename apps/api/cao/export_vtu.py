"""Export VTU — volet 5b.

Produit un fichier VTU (VTK Unstructured Grid XML) pour le maillage volumique
et les champs physiques. Chaque champ exporté transporte sa provenance
(computed/interpolated/experimental), ses unités et ses min/max réels. Un
champ absent reste explicitement non exporté : aucune valeur simulée n'est
jamais écrite dans le fichier.
"""
from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from .revision import ValidationStatus


class VtuExportError(Exception):
    """L'export VTU a échoué de manière bloquante."""


# Types VTK
VTK_FLOAT32 = 4
VTK_FLOAT64 = 5
VTK_INT32 = 6
VTK_UINT32 = 22

# Cell types VTK
VTK_TETRA = 10


@dataclass
class ScalarField:
    """Champ scalaire avec provenance et unités réelles."""

    name: str
    values: np.ndarray  # (n_points,) ou (n_cells,)
    units: str  # ex: K, Pa, m/s, REQUIRED_INPUT si inconnues
    provenance: str  # computed | interpolated | experimental
    component_name: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None

    def validate(self) -> None:
        values = np.asarray(self.values)
        if self.values is None or values.size == 0:
            raise VtuExportError(f"Champ {self.name} vide : aucun export simulé autorisé.")
        if self.min_value is None:
            self.min_value = float(np.nanmin(values))
        if self.max_value is None:
            self.max_value = float(np.nanmax(values))
        if not np.isfinite(values).all():
            raise VtuExportError(f"Champ {self.name} contient des valeurs non finies.")


@dataclass
class VtuExportResult:
    file_path: str
    vtu_revision_id: str
    points_count: int
    cells_count: int
    exported_fields: List[Dict[str, Any]]
    missing_fields: List[str]
    status: str


def export_vtu(
    points: np.ndarray,
    cells: np.ndarray,
    geometry_revision_id: str,
    mesh_revision_id: str,
    scalar_fields: Optional[List[ScalarField]] = None,
    units_label: Optional[str] = None,
    status: str = ValidationStatus.REQUIRED_INPUT.value,
    destination: str = "output.vtu",
) -> VtuExportResult:
    """Exporte le maillage volumique et les champs validés en VTU."""
    if points is None or points.size == 0:
        raise VtuExportError("Aucun point de maillage disponible pour l'export VTU.")
    if cells is None or cells.size == 0:
        raise VtuExportError("Aucune cellule de maillage disponible pour l'export VTU.")

    points = np.asarray(points, dtype=np.float64)
    cells = np.asarray(cells, dtype=np.int64)

    n_points = points.shape[0]
    n_cells = cells.shape[0]
    cells_per_point = cells.shape[1] if cells.ndim == 2 else 0
    if cells_per_point == 0:
        raise VtuExportError("Format de cellules non supporté : attendu (n, 4) pour tétraèdres.")

    exported_fields: List[Dict[str, Any]] = []
    missing_fields: List[str] = []
    point_data_blocks: List[str] = []
    cell_data_blocks: List[str] = []

    for scalar in scalar_fields or []:
        try:
            scalar.validate()
        except VtuExportError as exception:
            # Un champ vide n'est jamais exporté : le comportement par défaut
            # est bloquant (VtuExportError), jamais silencieux.
            raise exception

        values = np.asarray(scalar.values, dtype=np.float64)
        association = "PointData" if values.shape[0] == n_points else "CellData"
        if values.shape[0] not in (n_points, n_cells):
            missing_fields.append(
                f"{scalar.name}: dimension {values.shape[0]} incompatible "
                f"({n_points} points, {n_cells} cellules)"
            )
            continue

        payload = base64.b64encode(values.tobytes()).decode("ascii")
        element = (
            f'      <DataArray type="Float64" Name="{scalar.name}" '
            f'format="binary" NumberOfComponents="1" '
            f'unit="{scalar.units}" provenance="{scalar.provenance}" '
            f'min="{scalar.min_value:.6e}" max="{scalar.max_value:.6e}">'
            f"\n        {payload}\n      </DataArray>"
        )
        if association == "PointData":
            point_data_blocks.append(element)
        else:
            cell_data_blocks.append(element)
        exported_fields.append(
            {
                "name": scalar.name,
                "units": scalar.units,
                "provenance": scalar.provenance,
                "association": association.lower(),
                "min": scalar.min_value,
                "max": scalar.max_value,
            }
        )

    # Coordonnées et connectivité.
    points_payload = base64.b64encode(points.tobytes()).decode("ascii")
    connect_payload = base64.b64encode(cells.tobytes()).decode("ascii")
    offsets = np.array([(i + 1) * cells_per_point for i in range(n_cells)], dtype=np.int64)
    offsets_payload = base64.b64encode(offsets.tobytes()).decode("ascii")
    types_payload = base64.b64encode(np.full(n_cells, VTK_TETRA, dtype=np.int32).tobytes()).decode("ascii")

    vtu_content = f"""<?xml version="1.0"?>
<VTKFile type="UnstructuredGrid" version="1.0" byte_order="LittleEndian">
  <UnstructuredGrid>
    <Piece NumberOfPoints="{n_points}" NumberOfCells="{n_cells}">
      <PointData>
{chr(10).join(point_data_blocks)}
      </PointData>
      <CellData>
{chr(10).join(cell_data_blocks)}
      </CellData>
      <Points>
        <DataArray type="Float64" NumberOfComponents="3" format="binary">
          {points_payload}
        </DataArray>
      </Points>
      <Cells>
        <DataArray type="Int64" Name="connectivity" format="binary">
          {connect_payload}
        </DataArray>
        <DataArray type="Int64" Name="offsets" format="binary">
          {offsets_payload}
        </DataArray>
        <DataArray type="Int32" Name="types" format="binary">
          {types_payload}
        </DataArray>
      </Cells>
    </Piece>
  </UnstructuredGrid>
  <FieldData>
    <DataArray type="String" Name="geometry_revision_id" NumberOfTuples="1" format="ascii">
      {geometry_revision_id}
    </DataArray>
    <DataArray type="String" Name="mesh_revision_id" NumberOfTuples="1" format="ascii">
      {mesh_revision_id}
    </DataArray>
    <DataArray type="String" Name="units_label" NumberOfTuples="1" format="ascii">
      {units_label or "REQUIRED_INPUT"}
    </DataArray>
    <DataArray type="String" Name="status" NumberOfTuples="1" format="ascii">
      {status}
    </DataArray>
  </FieldData>
</VTKFile>
"""
    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.write_text(vtu_content)

    vtu_revision_id = (
        "vtu_" + hashlib.sha256(vtu_content.encode("utf-8")).hexdigest()[:16]
    )
    export_status = ValidationStatus.VALIDATED.value if exported_fields else status
    return VtuExportResult(
        file_path=str(destination_path),
        vtu_revision_id=vtu_revision_id,
        points_count=int(n_points),
        cells_count=int(n_cells),
        exported_fields=exported_fields,
        missing_fields=missing_fields,
        status=export_status,
    )
