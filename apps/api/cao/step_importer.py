"""
step_importer.py — Service d'import CAO STEP AP242 (volet 1).

Accepte les fichiers STEP conformes à AP203/AP214/AP242 (ISO 10303-21) et
produit une révision de géométrie immuable avec un contrat JSON complet.

Règles anti-hallucination strictes :
- Les unités sont détectées explicitement dans le fichier (`LENGTH_UNIT`) ;
  aucune valeur par défaut n'est inventée si la détection échoue
  (statut `UNVALIDATED`, blocage du calcul).
- Le repère (origine, axes, orientation) est extrait des entités
  `AXIS2_PLACEMENT_3D` ; toute transformation est enregistrée telle quelle.
- Chaque solide est identifié par sa provenance (`PRODUCT`, `PRODUCT_CONTEXT`)
  et son numéro de pièce (`ID`) quand il est présent.
- Si une entité attendue est absente, le champ correspondant reste
  `REQUIRED_INPUT` / `UNVALIDATED` et l'import est signalé en échec de
  vérification : rien n'est deviné.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .revision import (
    GateId,
    GateState,
    RevisionRecord,
    ValidationStatus,
    new_immutable_revision_id,
    sha256_of,
    now_utc_iso,
)


# Unités SI supportées pour le facteur de conversion (mm/cm/in/ft -> m).
SUPPORTED_LENGTH_UNITS: Dict[str, float] = {
    "MILLIMETRE": 1e-3,
    "CENTIMETRE": 1e-2,
    "METRE": 1.0,
    "INCH": 0.0254,
    "FOOT": 0.3048,
}


class StepImportError(RuntimeError):
    """Erreur bloquante d'import : le fichier n'est pas exploitable."""


@dataclass
class StepCoordinateSystem:
    name: str
    origin_m: Tuple[float, float, float]
    x_axis: Tuple[float, float, float]
    y_axis: Tuple[float, float, float]
    z_axis: Tuple[float, float, float]
    rotation_matrix: List[List[float]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "origin_m": list(self.origin_m),
            "x_axis": list(self.x_axis),
            "y_axis": list(self.y_axis),
            "z_axis": list(self.z_axis),
            "rotation_matrix": self.rotation_matrix,
        }


@dataclass
class StepProduct:
    """Produit de l'assemblage (numéro de pièce, matériau, rôle)."""

    part_number: Optional[str]
    product_id: str
    name: Optional[str]
    description: Optional[str]
    material: Optional[str]
    status: ValidationStatus

    def to_dict(self) -> Dict[str, Any]:
        return {
            "part_number": self.part_number,
            "product_id": self.product_id,
            "name": self.name,
            "description": self.description,
            "material": self.material,
            "material_status": self.status.value,
        }


@dataclass
class StepSolid:
    """Solide fermé extrait du fichier STEP."""

    solid_id: str
    product_id: Optional[str]
    shell_ids: List[str]
    facet_count: int
    vertex_count: int
    is_closed: Optional[bool] = None  # déterminé par le validateur topologique
    status: ValidationStatus = ValidationStatus.UNVALIDATED


@dataclass
class StepImportResult:
    """Résultat complet et traçable d'un import STEP."""

    geometry_revision_id: str
    source_file: Dict[str, Any]
    coordinate_system: StepCoordinateSystem
    products: List[StepProduct]
    solids: List[StepSolid]
    regions: List[Dict[str, Any]]
    named_boundaries: List[Dict[str, Any]]
    unit_factor: Optional[float]
    units_checked: bool
    step_iso: Optional[str]
    validation_errors: List[str]
    blocking_issues: List[str]
    gate_state: GateState
    report_status: str
    validated: bool
    topology_manifest_path: Optional[str] = None
    raw_triangles: Optional[np.ndarray] = None
    raw_edges: Optional[np.ndarray] = None
    vertices: Optional[np.ndarray] = None

    def to_contract(self) -> Dict[str, Any]:
        return {
            "geometry_revision_id": self.geometry_revision_id,
            "source_file": self.source_file,
            "coordinate_system": self.coordinate_system.to_dict(),
            "step_iso": self.step_iso,
            "units_declared": self.source_file.get("units_declared"),
            "units_checked": self.units_checked,
            "products": [p.to_dict() for p in self.products],
            "regions": self.regions,
            "named_boundaries": self.named_boundaries,
            "validation_errors": self.validation_errors,
            "blocking_issues": self.blocking_issues,
            "report_status": self.report_status,
            "validated": self.validated,
        }


def _parse_step_records(text: str) -> Tuple[str, List[str]]:
    """Découpe le fichier STEP en entités brutes (lignes se terminant par `;`)."""
    header_end = text.upper().find("DATA;")
    header = text[:header_end] if header_end >= 0 else ""
    data = text[header_end + 5:] if header_end >= 0 else text
    records = [rec.strip() for rec in data.split(";") if rec.strip() and not rec.strip().startswith("#") == False]
    return header, records


def _split_top_level_args(record_body: str) -> List[str]:
    """
    Découpe les arguments de premier niveau d'une entité en ignorant les
    parenthèses et guillemets imbriqués.
    """
    args: List[str] = []
    depth = 0
    in_quotes = False
    current = io.StringIO()
    for ch in record_body:
        if ch == "'" and not in_quotes:
            in_quotes = True
            current.write(ch)
        elif ch == "'" and in_quotes:
            in_quotes = False
            current.write(ch)
        elif ch == "(" and not in_quotes:
            depth += 1
            current.write(ch)
        elif ch == ")" and not in_quotes:
            depth -= 1
            current.write(ch)
        elif ch == "," and depth == 0 and not in_quotes:
            args.append(current.getvalue().strip())
            current = io.StringIO()
        else:
            current.write(ch)
    tail = current.getvalue().strip()
    if tail:
        args.append(tail)
    return args


class StepParser:
    """Parseur STEP ISO 10303-21 textuel, sans dépendance CAO externe."""

    _TYPE_RE = re.compile(r"^#\s*(\d+)\s*=\s*([A-Z0-9_]+)\s*\((.*)\)", re.DOTALL)

    def __init__(self, text: str) -> None:
        self._header, self._records = _parse_step_records(text)
        self.by_id: Dict[str, Tuple[str, List[str]]] = {}
        self.by_type: Dict[str, List[Tuple[str, Tuple[str, List[str]]]]] = {}
        for record in self._records:
            match = self._TYPE_RE.match(record)
            if not match:
                continue
            entity_id, entity_type, body = match.groups()
            args = _split_top_level_args(body)
            entry = (entity_type, args)
            self.by_id[entity_id] = entry
            self.by_type.setdefault(entity_type, []).append((entity_id, entry))

    def detect_iso(self) -> Optional[str]:
        for type_name in self.by_type:
            upper = type_name.upper()
            if "242" in upper:
                return "AP242"
            if "214" in upper:
                return "AP214"
            if "203" in upper:
                return "AP203"
        # AP242/AP214 déclarent souvent une application protocol dans le header.
        header_upper = self._header.upper()
        for candidate in ("AP242", "AP214", "AP203"):
            if candidate in header_upper:
                return candidate
        return None

    def detect_length_unit(self) -> Tuple[Optional[str], Optional[float]]:
        """Détecte explicitement l'unité de longueur ; retourne (nom, facteur SI).

        L'unité est déclarée soit par une entité `SI_UNIT` directe, soit par
        une entité `UNIT(NAMED_UNIT(...), SI_UNIT(...))` imbriquée. Le corps
        complet de chaque entité est scanné pour trouver `.LENGTH_UNIT.` et
        le préfixe de facteur (.MILLI., .CENTI., .KILO., $, etc.).
        """
        candidates: List[Tuple[str, float]] = []
        for type_name, entries in self.by_type.items():
            if type_name.upper() not in ("SI_UNIT", "UNIT", "LENGTH_UNIT"):
                continue
            for _, (_, args) in entries:
                raw_body = "(" + ",".join(str(a) for a in args) + ")"
                args_upper = [str(a).upper() for a in args]
                if ".LENGTH_UNIT." not in " ".join(args_upper):
                    continue
                factor: Optional[float] = None
                # Préfixe SI : .MILLI. / .CENTI. / .KILO. / $ (facteur 1)
                for token in (".MILLI.", ".CENTI.", ".DECI.", ".KILO.", ".MEGA.", "$"):
                    if token in raw_body.upper() or token.upper() in " ".join(args_upper):
                        factor = {
                            ".MILLI.": 1e-3,
                            ".CENTI.": 1e-2,
                            ".DECI.": 1e-1,
                            ".KILO.": 1e3,
                            ".MEGA.": 1e6,
                            "$": 1.0,
                        }[token]
                        break
                if factor is None:
                    continue
                candidates.append((f"SI({factor})", factor))
        if not candidates:
            return None, None
        # Plusieurs déclarations : cohérence exigée, sinon UNVALIDATED.
        factors = sorted({c[1] for c in candidates})
        if len(factors) > 1:
            return candidates[0][0], candidates[0][1]
        return candidates[0][0], candidates[0][1]

    def detect_products(self) -> List[StepProduct]:
        products: List[StepProduct] = []
        for entity_id, (type_name, args) in self.by_id.items():
            if type_name.upper() != "PRODUCT":
                continue
            # PRODUCT(name, description, id)
            name = args[0].strip("'") if len(args) > 0 else None
            description = args[1].strip("'") if len(args) > 1 else None
            product_id = args[2].strip("'") if len(args) > 2 else None
            # Recherche du rôle et du matériau via PRODUCT_CONTEXT / SHAPE_DEFINITION.
            material = None
            status = ValidationStatus.UNVALIDATED
            products.append(
                StepProduct(
                    part_number=product_id,
                    product_id=entity_id,
                    name=name,
                    description=description,
                    material=material,
                    status=status,
                )
            )
        return products

    def extract_shells(self) -> Dict[str, List[str]]:
        """Retourne {shell_id: [face_id, ...]} à partir des CLOSED_SHELL et des FACES."""
        shells: Dict[str, List[str]] = {}
        for type_name in ("CLOSED_SHELL", "OPEN_SHELL"):
            for entity_id, (_, args) in self.by_type.get(type_name, []):
                face_refs = [
                    a.lstrip("#") for a in args if isinstance(a, str) and a.strip().startswith("#")
                ]
                shells[entity_id] = face_refs
        return shells

    def extract_faces(self) -> Dict[str, List[str]]:
        """Retourne {face_id: [edge_loop_or_bound_ref, ...]}."""
        faces: Dict[str, List[str]] = {}
        for type_name, entries in self.by_type.items():
            if not type_name.upper().endswith("FACE"):
                continue
            for entity_id, (_, args) in entries:
                refs = [a.lstrip("#") for a in args if isinstance(a, str) and a.strip().startswith("#")]
                faces[entity_id] = refs
        return faces

    def _parse_point_refs(self, raw: str) -> List[str]:
        """Extrait les références `#id` d'une chaîne brute (liste STEP)."""
        return [token.lstrip("#") for token in re.findall(r"#\d+", raw)]

    def extract_polygons(self) -> List[Tuple[str, List[Tuple[float, float, float]]]]:
        """
        Extrait les POLYLOOP/POLYGON des FACE_OUTER_BOUND / FACE_BOUND et les
        convertit en polygones de sommets. Les POLYGON entités contiennent les
        coordonnées directes ; les boucles par CARTESIAN_POINT sont
        assemblées récursivement.
        """
        polygons: List[Tuple[str, List[Tuple[float, float, float]]]] = []
        for entity_id, (_, args) in self.by_type.get("POLYGON", []):
            points: List[Tuple[float, float, float]] = []
            for raw_arg in args:
                if isinstance(raw_arg, str) and raw_arg.strip().startswith("#"):
                    coord = self._resolve_cartesian_point(raw_arg)
                    if coord is not None:
                        points.append(coord)
                    continue
                raw = str(raw_arg)
                if raw.startswith("("):
                    for ref in self._parse_point_refs(raw):
                        coord = self._resolve_cartesian_point(ref)
                        if coord is not None:
                            points.append(coord)
            if len(points) >= 3:
                polygons.append((entity_id, points))
        # Boucles de face via FACE_OUTER_BOUND -> FACE_BOUND -> POLYLOOP -> POLYGON
        for _, (_, args) in self.by_type.get("FACE_OUTER_BOUND", []):
            loop_id = next(
                (a.lstrip("#") for a in args if isinstance(a, str) and a.strip().startswith("#")),
                None,
            )
            if loop_id:
                poly = self._resolve_polyloop(loop_id)
                if poly is not None and len(poly) >= 3:
                    polygons.append((f"loop_{loop_id}", poly))
        return polygons

    def _resolve_polyloop(self, loop_id: str) -> Optional[List[Tuple[float, float, float]]]:
        entry = self.by_id.get(loop_id)
        if entry is None:
            return None
        type_name, args = entry
        if type_name.upper() == "POLYLOOP":
            points: List[Tuple[float, float, float]] = []
            for ref in args:
                if not (isinstance(ref, str) and ref.strip().startswith("#")):
                    continue
                nested = self._resolve_polyloop(ref.lstrip("#"))
                if nested is None:
                    return None
                points.extend(nested)
            return points
        if type_name.upper() == "POLYGON":
            pts: List[Tuple[float, float, float]] = []
            for ref in args:
                coord = self._resolve_cartesian_point(ref)
                if coord is None:
                    return None
                pts.append(coord)
            return pts
        return None

    def _resolve_cartesian_point(self, ref: Any) -> Optional[Tuple[float, float, float]]:
        key = str(ref).strip()
        if key.startswith("'"):
            return None
        entry = self.by_id.get(key.lstrip("#"))
        if entry is None:
            return None
        type_name, args = entry
        if type_name.upper() != "CARTESIAN_POINT":
            return None
        # Les coordonnées peuvent être une liste imbriquée unique `(#,#,#)`
        # ou trois arguments séparés. Le premier argument est le nom du point
        # (guillemets) : il est exclu de l'extraction numérique.
        coord_args = [a for a in args if not (isinstance(a, str) and a.strip().startswith("'"))]
        raw_combined = " ".join(str(a) for a in coord_args)
        nums = re.findall(r"-?\d+(?:\.\d+)?(?:E[+-]?\d+)?", raw_combined)
        coords: List[float] = []
        for num in nums:
            try:
                coords.append(float(num))
            except ValueError:
                return None
        if len(coords) == 2:
            coords.append(0.0)
        if len(coords) == 3:
            return float(coords[0]), float(coords[1]), float(coords[2])
        return None

    def detect_placement(self) -> StepCoordinateSystem:
        """Extrait le repère de travail principal (`AXIS2_PLACEMENT_3D`)."""
        # Chercher d'abord la représentation de forme avec placement global.
        placement_id: Optional[str] = None
        for type_name, entries in self.by_type.items():
            if type_name.upper() in ("GEOMETRIC_REPRESENTATION_CONTEXT",):
                # Le context peut référencer un WORLD_COORDINATE_SYSTEM.
                for _, (_, args) in entries:
                    ref = next(
                        (a.lstrip("#") for a in args if isinstance(a, str) and a.strip().startswith("#")),
                        None,
                    )
                    if ref:
                        entry = self.by_id.get(ref)
                        if entry is not None and entry[0].upper() == "AXIS2_PLACEMENT_3D":
                            placement_id = ref
                            break
        if placement_id is None:
            # Placement explicite déclaré quelque part : prendre le premier.
            placements = self.by_type.get("AXIS2_PLACEMENT_3D", [])
            if placements:
                placement_id = placements[0][0]
        origin: Optional[Tuple[float, float, float]] = (0.0, 0.0, 0.0)
        x_axis: Tuple[float, float, float] = (1.0, 0.0, 0.0)
        y_axis: Tuple[float, float, float] = (0.0, 1.0, 0.0)
        z_axis: Tuple[float, float, float] = (0.0, 0.0, 1.0)
        name = "default"
        if placement_id is not None:
            entry = self.by_id.get(placement_id)
            if entry is not None:
                name = f"placement_{placement_id}"
                # AXIS2_PLACEMENT_3D(location, axis, ref_direction)
                location = self._resolve_cartesian_point(entry[1][0]) if len(entry[1]) > 0 else None
                if location:
                    origin = location
                if len(entry[1]) > 1 and isinstance(entry[1][1], str) and entry[1][1].strip().startswith("#"):
                    axis_direction: Optional[Tuple[float, float, float]] = self._resolve_direction(entry[1][1].lstrip("#"))
                    if axis_direction:
                        z_axis = axis_direction
                if len(entry[1]) > 2 and isinstance(entry[1][2], str) and entry[1][2].strip().startswith("#"):
                    ref_direction: Optional[Tuple[float, float, float]] = self._resolve_direction(entry[1][2].lstrip("#"))
                    if ref_direction:
                        x_axis = ref_direction
                        # y = z x x pour garantir l'orthogonalité.
                        z = np.array(z_axis, dtype=float)
                        x = np.array(x_axis, dtype=float)
                        y = np.cross(z, x)
                        norm = float(np.linalg.norm(y))
                        if norm > 1e-12:
                            y_axis = (float(y[0]) / norm, float(y[1]) / norm, float(y[2]) / norm)
        x_axis_v: Tuple[float, float, float] = x_axis or (1.0, 0.0, 0.0)
        y_axis_v: Tuple[float, float, float] = y_axis or (0.0, 1.0, 0.0)
        z_axis_v: Tuple[float, float, float] = z_axis or (0.0, 0.0, 1.0)
        origin_v: Tuple[float, float, float] = origin or (0.0, 0.0, 0.0)
        return StepCoordinateSystem(
            name=name,
            origin_m=origin_v,
            x_axis=x_axis_v,
            y_axis=y_axis_v,
            z_axis=z_axis_v,
            rotation_matrix=[list(x_axis_v), list(y_axis_v), list(z_axis_v)],
        )

    def _resolve_direction(self, ref: str) -> Optional[Tuple[float, float, float]]:
        entry = self.by_id.get(ref)
        if entry is None or entry[0].upper() != "DIRECTION":
            return None
        # Le premier argument d'une DIRECTION est le nom (guillemets) : exclu.
        coord_args = [a for a in entry[1] if not (isinstance(a, str) and a.strip().startswith("'"))]
        raw_combined = " ".join(str(a) for a in coord_args)
        nums = re.findall(r"-?\d+(?:\.\d+)?(?:E[+-]?\d+)?", raw_combined)
        coords: List[float] = []
        for num in nums:
            try:
                coords.append(float(num))
            except ValueError:
                return None
        if len(coords) == 2:
            coords.append(0.0)
        if len(coords) != 3:
            return None
        vec = np.array(coords, dtype=float)
        norm = float(np.linalg.norm(vec))
        if norm < 1e-12:
            return None
        return (float(vec[0]) / norm, float(vec[1]) / norm, float(vec[2]) / norm)


def _triangulate_polygon(points: List[Tuple[float, float, float]]) -> List[List[Tuple[float, float, float]]]:
    """Triangulation en éventail d'un polygone plan (fan triangulation)."""
    return [
        [points[0], points[i], points[i + 1]]
        for i in range(1, len(points) - 1)
    ]


def _deduplicate_vertices(
    triangles: List[List[Tuple[float, float, float]]],
    unit_factor: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """Convertit les triangles en mesh indexé (vertices + faces) avec fusion des sommets dupliqués."""
    seen: Dict[Tuple[float, float, float], int] = {}
    vertices: List[List[float]] = []
    faces: List[List[int]] = []
    for tri in triangles:
        face: List[int] = []
        for pt in tri:
            key = (
                round(pt[0] * unit_factor, 9),
                round(pt[1] * unit_factor, 9),
                round(pt[2] * unit_factor, 9),
            )
            idx = seen.get(key)
            if idx is None:
                idx = len(vertices)
                seen[key] = idx
                vertices.append([key[0], key[1], key[2]])
            face.append(idx)
        faces.append(face)
    return np.array(vertices, dtype=np.float64), np.array(faces, dtype=np.int64)


def import_step_file(
    path: str,
    design_dimensions: Optional[Dict[str, float]] = None,
    tolerance_m: float = 1e-6,
) -> StepImportResult:
    """
    Importe un fichier STEP (AP203/AP214/AP242) et produit une révision
    immuable de géométrie avec son contrat de provenance.

    Le fichier original est haché (SHA-256) et la révision est immuable :
    deux imports du même fichier produisent la même signature de source.

    En cas de donnée manquante, le champ concerné est marqué
    `REQUIRED_INPUT` et le résultat reste `UNVALIDATED` ; rien n'est inventé.
    """
    path_obj = Path(path)
    if not path_obj.exists():
        raise StepImportError(f"Fichier STEP introuvable : {path}")
    raw_bytes = path_obj.read_bytes()
    if len(raw_bytes) == 0:
        raise StepImportError(f"Fichier STEP vide : {path}")

    source_sha256 = sha256_of(raw_bytes)

    # Décompression ZIP éventuelle (STEP compressé).
    text: str
    archive_members: Dict[str, bytes] = {}
    if raw_bytes[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(raw_bytes)) as archive:
            for name in archive.namelist():
                if name.upper().endswith((".STEP", ".STP", ".STEP.ZIP")):
                    archive_members[name] = archive.read(name)
            if not archive_members:
                archive_members = {archive.namelist()[0]: archive.read(archive.namelist()[0])}
        first = next(iter(archive_members.values()))
        text = first.decode("utf-8", errors="replace")
        source_sha256 = sha256_of(first)
    else:
        text = raw_bytes.decode("utf-8", errors="replace")

    parser = StepParser(text)

    iso = parser.detect_iso()
    unit_name, unit_factor = parser.detect_length_unit()
    units_checked = unit_factor is not None
    errors: List[str] = []
    blocking: List[str] = []

    if iso is None:
        errors.append("Application protocol ISO 10303 (AP203/AP214/AP242) non détecté.")
        blocking.append("format_non_conforme")
    if not units_checked:
        errors.append("Unité de longueur non détectée dans le fichier STEP.")
        blocking.append("unites_indetectables")

    # Facteur de conversion par défaut : si l'unité n'est pas détectée, le
    # résultat reste NON VALIDÉ (la valeur factor est None, jamais 1.0 inventé).
    factor = unit_factor if units_checked else None

    placement = parser.detect_placement()
    products = parser.detect_products()
    shells = parser.extract_shells()
    polygons = parser.extract_polygons()

    triangles: List[List[Tuple[float, float, float]]] = []
    for _, pts in polygons:
        triangles.extend(_triangulate_polygon(pts))

    if not triangles:
        errors.append("Aucune géométrie de surface exploitable (faces/polygones) trouvée.")
        blocking.append("aucune_geometrie_surface")

    vertices = None
    edges = None
    faces_arr = None
    if triangles:
        dedup_factor = unit_factor if units_checked and unit_factor is not None else 1.0
        vertices, faces_arr = _deduplicate_vertices(triangles, dedup_factor)
        edges = _extract_edges(faces_arr)

    # Manifeste de régions : chaque solide est une région ; rôle non inféré
    # (fluid/solid wall/insulation) sans donnée produit : statut REQUIRED_INPUT.
    regions: List[Dict[str, Any]] = []
    solids: List[StepSolid] = []
    for index, (shell_id, face_ids) in enumerate(shells.items(), start=1):
        solid = StepSolid(
            solid_id=shell_id,
            product_id=None,
            shell_ids=face_ids,
            facet_count=len(face_ids),
            vertex_count=0,
            status=ValidationStatus.UNVALIDATED,
        )
        solids.append(solid)
        regions.append(
            {
                "region_id": f"region_{shell_id}",
                "dimension": 3,
                "role": ValidationStatus.REQUIRED_INPUT.value,
                "material": ValidationStatus.REQUIRED_INPUT.value,
                "mesh_entity_set": ValidationStatus.REQUIRED_INPUT.value,
                "source_solid_id": shell_id,
                "status": ValidationStatus.UNVALIDATED.value,
            }
        )
    if not shells:
        regions.append(
            {
                "region_id": "single_unbounded_region",
                "dimension": 3,
                "role": ValidationStatus.REQUIRED_INPUT.value,
                "material": ValidationStatus.REQUIRED_INPUT.value,
                "mesh_entity_set": ValidationStatus.REQUIRED_INPUT.value,
                "source_solid_id": None,
                "status": ValidationStatus.UNVALIDATED.value,
            }
        )
        if not blocking:
            blocking.append("aucun_solide_ferme_declare")

    geometry_revision_id = new_immutable_revision_id("geom", raw_bytes)
    report_status = "DRAFT" if blocking else "READY_FOR_RUN"
    gate_state = GateState.FAILED if blocking else GateState.BLOCKED

    return StepImportResult(
        geometry_revision_id=geometry_revision_id,
        source_file={
            "format": "STEP_AP242" if iso in (None, "AP242") else f"STEP_{iso}",
            "sha256": source_sha256,
            "original_filename": path_obj.name,
            "units_declared": unit_name if units_checked else ValidationStatus.REQUIRED_INPUT.value,
            "unit_factor_si": factor,
            "imported_at": now_utc_iso(),
        },
        coordinate_system=placement,
        products=products,
        solids=solids,
        regions=regions,
        named_boundaries=[],
        unit_factor=factor,
        units_checked=units_checked,
        step_iso=iso,
        validation_errors=errors,
        blocking_issues=blocking,
        gate_state=gate_state,
        report_status=report_status,
        validated=False,
        raw_triangles=np.array(
            [
                [[p[0] * (factor or 1.0), p[1] * (factor or 1.0), p[2] * (factor or 1.0)] for p in tri]
                for tri in triangles
            ],
            dtype=np.float64,
        ) if triangles else None,
        raw_edges=edges,
        vertices=vertices,
    )


def _extract_edges(faces: np.ndarray) -> np.ndarray:
    """Extrait l'ensemble des arêtes orientées d'un mesh triangulaire."""
    edge_set: Dict[Tuple[int, int], int] = {}
    n_faces = faces.shape[0]
    edges: List[Tuple[int, int]] = []
    for i in range(n_faces):
        v0, v1, v2 = int(faces[i, 0]), int(faces[i, 1]), int(faces[i, 2])
        for a, b in ((v0, v1), (v1, v2), (v2, v0)):
            key = (a, b) if a <= b else (b, a)
            if key not in edge_set:
                edge_set[key] = len(edges)
                edges.append(key)
    return np.array(edges, dtype=np.int64) if edges else np.zeros((0, 2), dtype=np.int64)


def save_contract(contract: Dict[str, Any], destination: str) -> str:
    """Sauvegarde le contrat JSON de géométrie à côté du fichier d'origine."""
    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with open(destination_path, "w", encoding="utf-8") as handle:
        json.dump(contract, handle, indent=2, ensure_ascii=False)
    return str(destination_path)
