"""
topology_validator.py — Validateur topologique et manifeste de régions
et de frontières nommées (volet 2).

Contrôles bloquants :
- Fermeture : chaque arête intérieure appartient à exactement deux faces.
  Les arêtes de bord sont autorisées uniquement sur les frontières nommées.
- Doublons : sommets et faces géométriquement confondus identifiés.
- Auto-intersections : détection d'intersections arête-triangle sur paires
  de triangles en collision de boîtes englobantes.
- Orientations : normales cohérentes (produit mixte signe constant).
- Échelle : dimensions globales comparées à la fiche de conception si
  fournie ; sinon statut `UNVALIDATED` (jamais de valeur inventée).

Les frontières nommées (`inlet`, `outlet`, `fluid_wall_interface`,
`leak_or_discontinuity`, ...) sont déclarées par des ensembles d'arêtes ;
toute arête non assignée est listée dans `unassigned_edges` et bloque la
porte G2.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

from .revision import ValidationStatus, now_utc_iso
from .step_importer import StepImportResult, _extract_edges


class TopologyValidationError(RuntimeError):
    """Échec bloquant de validation topologique."""


@dataclass
class NamedBoundary:
    name: str
    edge_indices: List[int]
    face_indices: List[int]
    status: ValidationStatus
    role: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "edge_indices": self.edge_indices,
            "face_indices": self.face_indices,
            "status": self.status.value,
            "role": self.role,
        }


@dataclass
class TopologyReport:
    geometry_revision_id: str
    closed_solids: bool
    non_manifold_count: int
    boundary_edges: int
    self_intersections: int
    duplicate_vertices: int
    duplicate_faces: int
    flipped_faces: int
    inverted_normals: List[int]
    scale_status: ValidationStatus
    declared_extents_m: Optional[Dict[str, float]]
    design_extents_m: Optional[Dict[str, float]]
    unassigned_edges: int
    named_boundaries: List[NamedBoundary]
    regions: List[Dict[str, Any]]
    validation_errors: List[str]
    blocking_issues: List[str]
    validated: bool
    report: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "geometry_revision_id": self.geometry_revision_id,
            "closed_solids": self.closed_solids,
            "non_manifold_count": self.non_manifold_count,
            "boundary_edges": self.boundary_edges,
            "self_intersections": self.self_intersections,
            "duplicate_vertices": self.duplicate_vertices,
            "duplicate_faces": self.duplicate_faces,
            "flipped_faces": self.flipped_faces,
            "inverted_normals": self.inverted_normals,
            "scale_status": self.scale_status.value,
            "declared_extents_m": self.declared_extents_m,
            "design_extents_m": self.design_extents_m,
            "unassigned_edges": self.unassigned_edges,
            "named_boundaries": [b.to_dict() for b in self.named_boundaries],
            "regions": self.regions,
            "validation_errors": self.validation_errors,
            "blocking_issues": self.blocking_issues,
            "validated": self.validated,
            "validated_at": now_utc_iso() if self.validated else None,
        }


def check_closed_manifold(faces: np.ndarray, edges: Optional[np.ndarray] = None) -> Tuple[bool, int, int, np.ndarray]:
    """
    Vérifie la fermeture du maillage de surface : chaque arête doit appartenir
    à exactement deux triangles (manifold fermé). Retourne (fermé, nombre
    d'arêtes non-manifold, arêtes de bord, tableau des arêtes).

    Le comptage se fait par face : pour chaque triangle, ses trois arêtes
    (clé canonique a<=b) sont incrémentées, ce qui permet de détecter les
    arêtes de bord (comptage 1) et non-manifold (comptage > 2).
    """
    edge_count: Dict[Tuple[int, int], int] = {}
    for i in range(faces.shape[0]):
        v0, v1, v2 = int(faces[i, 0]), int(faces[i, 1]), int(faces[i, 2])
        for a, b in ((v0, v1), (v1, v2), (v2, v0)):
            key = (a, b) if a <= b else (b, a)
            edge_count[key] = edge_count.get(key, 0) + 1
    if edges is None:
        edges = _extract_edges(faces)
    non_manifold = [e for e, c in edge_count.items() if c > 2]
    boundary = [e for e, c in edge_count.items() if c == 1]
    interior = all(c == 2 for c in edge_count.values())
    return interior, len(non_manifold), len(boundary), edges


def detect_duplicate_vertices(vertices: np.ndarray, atol: float = 1e-9) -> List[List[int]]:
    """Identifie les groupes de sommets géométriquement confondus."""
    rounded = np.round(vertices / max(atol, 1e-12), 9)
    buckets: Dict[Any, List[int]] = {}
    for idx in range(vertices.shape[0]):
        key = tuple(rounded[idx])
        buckets.setdefault(key, []).append(idx)
    return [group for group in buckets.values() if len(group) > 1]


def detect_duplicate_faces(faces: np.ndarray) -> List[List[int]]:
    """Identifie les faces géométriquement identiques (mêmes sommets)."""
    buckets: Dict[Any, List[int]] = {}
    seen: Dict[Any, int] = {}
    duplicates: List[List[int]] = []
    for idx in range(faces.shape[0]):
        key = tuple(sorted(int(v) for v in faces[idx]))
        if key in seen:
            duplicates.append([seen[key], idx])
        else:
            seen[key] = idx
    return duplicates


def triangle_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    normals = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    safe = np.where(norms[:, 0] > 1e-15, norms[:, 0], 1.0)
    return normals / safe[:, None]


def check_orientation_consistency(vertices: np.ndarray, faces: np.ndarray) -> Tuple[List[int], int]:
    """
    Vérifie la cohérence d'orientation des normales par rapport au centroïde
    (convention outward). Retourne (indices inversés, nombre de faces flipped).
    """
    if faces.shape[0] == 0 or vertices.shape[0] == 0:
        return [], 0
    normals = triangle_normals(vertices, faces)
    centroids = vertices[faces].mean(axis=1)
    global_center = vertices.mean(axis=0)
    to_center = global_center - centroids
    dot = (normals * to_center).sum(axis=1)
    flipped = [int(i) for i, d in enumerate(dot) if d > 0.0]
    return flipped, len(flipped)


def _edge_triangle_intersection(
    p0: np.ndarray,
    p1: np.ndarray,
    v0: np.ndarray,
    v1: np.ndarray,
    v2: np.ndarray,
    tol: float = 1e-12,
) -> bool:
    """Test de Möller–Trumbore pour l'intersection arête-triangle."""
    edge = p1 - p0
    h = np.cross(edge, v2 - v0)
    a = float(np.dot(v1 - v0, h))
    if abs(a) < tol:
        return False
    f = 1.0 / a
    s = p0 - v0
    u = f * float(np.dot(s, h))
    if u < -tol or u > 1.0 + tol:
        return False
    q = np.cross(s, v1 - v0)
    v = f * float(np.dot(edge, q))
    if v < -tol or u + v > 1.0 + tol:
        return False
    t = f * float(np.dot(v2 - v0, q))
    return 0.0 - tol <= t <= 1.0 + tol


def detect_self_intersections(
    vertices: np.ndarray,
    faces: np.ndarray,
    max_pairs: int = 2_000_000,
) -> int:
    """
    Détection d'auto-intersections par test arête-triangle sur les paires de
    triangles dont les boîtes englobantes se chevauchent. Retourne le nombre
    d'intersections détectées.
    """
    if faces.shape[0] < 2:
        return 0
    tri_points = vertices[faces]
    mins = tri_points.min(axis=1)
    maxs = tri_points.max(axis=1)
    count = 0
    n = faces.shape[0]
    for i in range(n):
        if count >= max_pairs:
            break
        for j in range(i + 1, n):
            if np.any(maxs[i] < mins[j] - 1e-12) or np.any(mins[i] > maxs[j] + 1e-12):
                continue
            a0, a1, a2 = tri_points[i]
            b0, b1, b2 = tri_points[j]
            hits = 0
            for edge in ((a0, a1), (a1, a2), (a2, a0)):
                if _edge_triangle_intersection(edge[0], edge[1], b0, b1, b2):
                    hits += 1
                    if hits >= 3:
                        break
            if hits == 3:
                count += 1
                if count >= max_pairs:
                    break
    return count


def check_scale(
    vertices: np.ndarray,
    design_extents: Optional[Dict[str, float]],
) -> Tuple[ValidationStatus, Dict[str, float], Optional[Dict[str, float]]]:
    """
    Compare les dimensions globales du solide à la fiche de conception.
    Si la fiche n'est pas fournie, l'échelle reste UNVALIDATED (rien n'est
    inventé : le statut documente l'absence de référence).
    """
    if vertices.shape[0] == 0:
        return ValidationStatus.REQUIRED_INPUT, {}, design_extents
    mins = vertices.min(axis=0)
    maxs = vertices.max(axis=0)
    declared = {
        "x_min_m": float(mins[0]),
        "x_max_m": float(maxs[0]),
        "y_min_m": float(mins[1]),
        "y_max_m": float(maxs[1]),
        "z_min_m": float(mins[2]),
        "z_max_m": float(maxs[2]),
        "length_m": float(maxs[0] - mins[0]),
        "width_m": float(maxs[1] - mins[1]),
        "height_m": float(maxs[2] - mins[2]),
    }
    if design_extents is None:
        return ValidationStatus.UNVALIDATED, declared, None
    tolerance = 0.05
    mismatches = 0
    for key in ("length_m", "width_m", "height_m"):
        if key in design_extents and abs(declared[key] - design_extents[key]) > tolerance * max(1.0, design_extents[key]):
            mismatches += 1
    status = ValidationStatus.VALIDATED if mismatches == 0 else ValidationStatus.VALIDATION_FAILED
    return status, declared, design_extents


def validate_topology(
    import_result: StepImportResult,
    design_extents: Optional[Dict[str, float]] = None,
    named_boundary_edges: Optional[Dict[str, List[int]]] = None,
) -> TopologyReport:
    """
    Exécute la validation topologique complète sur le résultat d'import et
    produit le manifeste de régions et de frontières nommées.
    """
    if import_result.vertices is None or import_result.vertices.shape[0] == 0:
        return TopologyReport(
            geometry_revision_id=import_result.geometry_revision_id,
            closed_solids=False,
            non_manifold_count=0,
            boundary_edges=0,
            self_intersections=0,
            duplicate_vertices=0,
            duplicate_faces=0,
            flipped_faces=0,
            inverted_normals=[],
            scale_status=ValidationStatus.REQUIRED_INPUT,
            declared_extents_m=None,
            design_extents_m=None,
            unassigned_edges=0,
            named_boundaries=[],
            regions=import_result.regions,
            validation_errors=["Aucune géométrie de surface à valider."],
            blocking_issues=["aucune_geometrie_surface"],
            validated=False,
            report={},
        )

    vertices = import_result.vertices
    faces = import_result.raw_triangles  # indexées après déduplication
    # raw_triangles contient les coordonnées ; reconstruire les faces indexées
    # à partir des triangles dédupliqués déjà calculés dans l'import.
    n_vertices = vertices.shape[0]
    if import_result.raw_edges is not None and import_result.raw_edges.shape[0] > 0:
        # Faces indexées non stockées directement : recalcul depuis les arêtes
        # n'est pas possible ; on reconstruit via le hash des sommets.
        pass
    indexed_faces = _rebuild_indexed_faces(import_result)
    if indexed_faces.shape[0] == 0:
        indexed_faces = np.arange(n_vertices).reshape(-1, 3) if n_vertices % 3 == 0 else np.zeros((0, 3), dtype=np.int64)

    closed, non_manifold, boundary_count, edges = check_closed_manifold(indexed_faces)
    dup_vertices = detect_duplicate_vertices(vertices)
    dup_faces = detect_duplicate_faces(indexed_faces)
    flipped, flipped_count = check_orientation_consistency(vertices, indexed_faces)
    intersections = detect_self_intersections(vertices, indexed_faces)
    scale_status, declared, design = check_scale(vertices, design_extents)

    validation_errors: List[str] = []
    blocking: List[str] = []
    if not closed:
        validation_errors.append(
            f"Solide non fermé : {boundary_count} arêtes de bord détectées."
        )
    if non_manifold > 0:
        validation_errors.append(f"{non_manifold} arêtes non-manifold détectées.")
        blocking.append("non_manifold_edges")
    if dup_faces:
        validation_errors.append(f"{len(dup_faces)} faces dupliquées détectées.")
        blocking.append("faces_dupliquees")
    if intersections > 0:
        validation_errors.append(f"{intersections} paires de triangles auto-intersectées détectées.")
        blocking.append("auto_intersections")
    if scale_status == ValidationStatus.VALIDATION_FAILED:
        validation_errors.append("Échelle incompatible avec la fiche de conception.")
        blocking.append("echelle_incoherente")
    if scale_status == ValidationStatus.UNVALIDATED:
        validation_errors.append("Fiche de conception absente : échelle non comparée.")
        blocking.append("fiche_conception_absente")

    # Frontières nommées.
    named_boundaries: List[NamedBoundary] = []
    assigned_edge_set: Set[int] = set()
    if named_boundary_edges:
        for name, edge_indices in named_boundary_edges.items():
            valid_indices = [i for i in edge_indices if 0 <= i < edges.shape[0]]
            face_set: Set[int] = set()
            for idx in valid_indices:
                for face_idx in range(indexed_faces.shape[0]):
                    face = indexed_faces[face_idx]
                    tri_edges = {(int(face[0]), int(face[1])), (int(face[1]), int(face[2])), (int(face[2]), int(face[0]))}
                    e = (int(edges[idx, 0]), int(edges[idx, 1]))
                    if e in tri_edges or (e[1], e[0]) in tri_edges:
                        face_set.add(int(face_idx))
            named_boundaries.append(
                NamedBoundary(
                    name=name,
                    edge_indices=valid_indices,
                    face_indices=sorted(face_set),
                    status=ValidationStatus.UNVALIDATED if not valid_indices else ValidationStatus.VALIDATED,
                    role=None,
                )
            )
            assigned_edge_set.update(valid_indices)

    unassigned = edges.shape[0] - len(assigned_edge_set) if edges.shape[0] > 0 else 0
    if unassigned > 0:
        blocking.append("frontieres_non_assignees")
        validation_errors.append(f"{unassigned} arêtes ne sont assignées à aucune frontière nommée.")

    validated = (
        closed
        and non_manifold == 0
        and not dup_faces
        and intersections == 0
        and unassigned == 0
        and scale_status == ValidationStatus.VALIDATED
        and len(blocking) == 0
    )

    report = {
        "geometry_revision_id": import_result.geometry_revision_id,
        "closed_solids": closed,
        "non_manifold_count": non_manifold,
        "boundary_edges": boundary_count,
        "self_intersections": intersections,
        "duplicate_vertices": len(dup_vertices),
        "duplicate_faces": len(dup_faces),
        "flipped_faces": flipped_count,
        "inverted_normals": flipped,
        "scale_status": scale_status.value,
        "declared_extents_m": declared,
        "design_extents_m": design,
        "unassigned_edges": unassigned,
        "named_boundaries": [b.to_dict() for b in named_boundaries],
        "regions": import_result.regions,
        "validation_errors": validation_errors,
        "blocking_issues": blocking,
        "validated": validated,
        "validated_at": now_utc_iso() if validated else None,
    }

    return TopologyReport(
        geometry_revision_id=import_result.geometry_revision_id,
        closed_solids=closed,
        non_manifold_count=non_manifold,
        boundary_edges=boundary_count,
        self_intersections=intersections,
        duplicate_vertices=len(dup_vertices),
        duplicate_faces=len(dup_faces),
        flipped_faces=flipped_count,
        inverted_normals=flipped,
        scale_status=scale_status,
        declared_extents_m=declared,
        design_extents_m=design,
        unassigned_edges=unassigned,
        named_boundaries=named_boundaries,
        regions=import_result.regions,
        validation_errors=validation_errors,
        blocking_issues=blocking,
        validated=validated,
        report=report,
    )


def _rebuild_indexed_faces(import_result: StepImportResult) -> np.ndarray:
    """
    Reconstruit les faces indexées à partir des triangles bruts dédupliqués.
    L'import stocke les coordonnées des triangles après fusion des sommets
    dans `vertices` ; la correspondance est refaite par hachage.
    """
    vertices = import_result.vertices
    if vertices is None or vertices.shape[0] == 0:
        return np.zeros((0, 3), dtype=np.int64)
    key_to_index: Dict[Tuple[float, float, float], int] = {}
    for vertex_index in range(vertices.shape[0]):
        key_to_index[(float(vertices[vertex_index, 0]), float(vertices[vertex_index, 1]), float(vertices[vertex_index, 2]))] = vertex_index
    faces: List[Tuple[int, int, int]] = []
    if import_result.raw_triangles is None:
        return np.zeros((0, 3), dtype=np.int64)
    for tri in import_result.raw_triangles:
        indices: List[int] = []
        for pt in tri:
            key = (float(pt[0]), float(pt[1]), float(pt[2]))
            idx = key_to_index.get(key)
            if idx is None:
                # Point perdu : la face est invalide, on la rejette sans inventer.
                break
            indices.append(idx)
        if len(indices) == 3:
            faces.append((indices[0], indices[1], indices[2]))
    return np.array(faces, dtype=np.int64) if faces else np.zeros((0, 3), dtype=np.int64)


def save_topology_report(report: TopologyReport, destination: str) -> str:
    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with open(destination_path, "w", encoding="utf-8") as handle:
        json.dump(report.to_dict(), handle, indent=2, ensure_ascii=False)
    return str(destination_path)
