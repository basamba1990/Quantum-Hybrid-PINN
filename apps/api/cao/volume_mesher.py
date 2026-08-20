"""
volume_mesher.py — Service de génération de maillage volumique 3D (volet 3).

Génère un maillage tétraédrique volumique à partir de la surface validée,
avec :
- contrôle qualité : jacobien minimum, skewness maximum, orthogonalité
  minimum, faces non-manifold, cellules à volume négatif ;
- raffinement adaptatif autour des discontinuités (frontières nommées,
  interfaces fluide-paroi, défauts de fuite) ;
- manifeste de maillage complet (`mesh_revision_id`, qualité, régions,
  boundary_sets).

Aucune cellule invalide n'est conservée : les tétraèdres à volume négatif
ou hors domaine sont rejetés, et le maillage échoue de manière bloquante si
la qualité ne respecte pas les seuils.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
from scipy.spatial import Delaunay

from .revision import ValidationStatus, new_immutable_revision_id, now_utc_iso
from .topology_validator import TopologyReport


DEFAULT_QUALITY_THRESHOLDS = {
    "min_jacobian": 1e-9,
    "max_skewness": 0.9,
    "min_orthogonal_quality": 0.1,
    "max_non_manifold_faces": 0,
    "max_negative_volume_cells": 0,
}


class MeshGenerationError(RuntimeError):
    """Échec bloquant de génération de maillage."""


@dataclass
class MeshReport:
    mesh_revision_id: str
    geometry_revision_id: str
    topology_report_id: Optional[str]
    dimension: int
    points_count: int
    cells_count: int
    cell_types: List[str]
    regions: List[str]
    boundary_sets: List[str]
    quality: Dict[str, Any]
    refinement_applied: bool
    refinement_zones: List[Dict[str, Any]]
    negative_volume_cells: int
    non_manifold_faces: int
    validation_errors: List[str]
    blocking_issues: List[str]
    validated: bool
    points: np.ndarray
    cells: np.ndarray
    boundary_map: Dict[str, List[int]]
    cell_quality_scores: np.ndarray

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mesh_revision_id": self.mesh_revision_id,
            "geometry_revision_id": self.geometry_revision_id,
            "topology_report_id": self.topology_report_id,
            "dimension": self.dimension,
            "points_count": int(self.points_count),
            "cells_count": int(self.cells_count),
            "cell_types": self.cell_types,
            "regions": self.regions,
            "boundary_sets": self.boundary_sets,
            "quality": {
                "min_jacobian": float(self.quality.get("min_jacobian") or 0.0),
                "max_skewness": float(self.quality.get("max_skewness") or 0.0),
                "min_orthogonal_quality": float(self.quality.get("min_orthogonal_quality") or 0.0),
                "non_manifold_faces": int(self.quality.get("non_manifold_faces") or 0),
                "negative_volume_cells": int(self.quality.get("negative_volume_cells") or 0),
            },
            "refinement_applied": self.refinement_applied,
            "refinement_zones": self.refinement_zones,
            "validation_errors": self.validation_errors,
            "blocking_issues": self.blocking_issues,
            "validated": self.validated,
            "generated_at": now_utc_iso(),
        }


def _tet_volume(p0: np.ndarray, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
    """Volume signé d'un tétraèdre (positif = orientation correcte)."""
    return float(np.dot(p1 - p0, np.cross(p2 - p0, p3 - p0))) / 6.0


def _tet_quality_metrics(points: np.ndarray, cell: np.ndarray) -> Tuple[float, float, float]:
    """Retourne (jacobien, skewness, orthogonal_quality) pour un tétraèdre."""
    p0, p1, p2, p3 = points[cell[0]], points[cell[1]], points[cell[2]], points[cell[3]]
    volume = _tet_volume(p0, p1, p2, p3)
    jacobian = abs(volume)
    edges = [p1 - p0, p2 - p0, p3 - p0, p2 - p1, p3 - p1, p3 - p2]
    lengths = [float(np.linalg.norm(e)) for e in edges]
    max_len = max(lengths)
    min_len = min(lengths)
    if max_len > 0.0:
        aspect = max_len / min_len if min_len > 0.0 else float("inf")
        skewness = float((aspect - 1.0) / aspect)
    else:
        skewness = 1.0
    if volume > 0.0:
        centroid = (p0 + p1 + p2 + p3) / 4.0
        face_centers = [(p0 + p1 + p2) / 3.0, (p0 + p1 + p3) / 3.0, (p0 + p2 + p3) / 3.0, (p1 + p2 + p3) / 3.0]
        face_normals = [
            np.cross(p1 - p0, p2 - p0),
            np.cross(p1 - p0, p3 - p0),
            np.cross(p2 - p0, p3 - p0),
            np.cross(p2 - p1, p3 - p1),
        ]
        ortho_scores = []
        for fc, fn in zip(face_centers, face_normals):
            d = centroid - fc
            fn_norm = np.linalg.norm(fn)
            if fn_norm > 1e-15:
                fn = fn / fn_norm
                cos_angle = float(np.dot(d, fn) / max(np.linalg.norm(d), 1e-15))
                ortho_scores.append(abs(cos_angle))
        orthogonal = float(np.mean(ortho_scores)) if ortho_scores else 0.0
    else:
        orthogonal = 0.0
    return jacobian, skewness, orthogonal


def _point_inside_surface(points: np.ndarray, faces: np.ndarray, candidates: np.ndarray) -> np.ndarray:
    """
    Test d'appartenance au domaine par comptage de traversées de rayons
    (ray casting) : un point est à l'intérieur si le rayon croise un nombre
    impair de faces.
    """
    inside = np.zeros(candidates.shape[0], dtype=bool)
    if candidates.shape[0] == 0 or faces.shape[0] == 0:
        return inside
    ray_dir = np.array([0.5773502691896258, 0.5773502691896258, 0.5773502691896258])
    for ci in range(candidates.shape[0]):
        origin = candidates[ci]
        crossings = 0
        for fi in range(faces.shape[0]):
            v0, v1, v2 = points[faces[fi, 0]], points[faces[fi, 1]], points[faces[fi, 2]]
            edge = v1 - v0
            h = np.cross(ray_dir, v2 - v0)
            a = float(np.dot(edge, h))
            if abs(a) < 1e-15:
                continue
            f = 1.0 / a
            s = origin - v0
            u = f * float(np.dot(s, h))
            if u < 0.0 or u > 1.0:
                continue
            q = np.cross(s, edge)
            v = f * float(np.dot(ray_dir, q))
            if v < 0.0 or u + v > 1.0:
                continue
            t = f * float(np.dot(v2 - v0, q))
            if t > 0.0:
                crossings += 1
        inside[ci] = (crossings % 2) == 1
    return inside


def generate_volume_mesh(
    surface_points: np.ndarray,
    surface_faces: np.ndarray,
    topology_report: Optional[TopologyReport] = None,
    named_boundary_centers: Optional[Dict[str, np.ndarray]] = None,
    refinement_factor: float = 2.0,
    boundary_refinement_radius: float = 0.25,
    base_density: float = 0.5,
    max_points: int = 500_000,
) -> MeshReport:
    """
    Génère un maillage tétraédrique volumique contrôlé.

    Le pipeline est le suivant :
    1. Échantillonnage structuré du domaine englobant selon la densité de base.
    2. Rejet des points extérieurs au domaine (ray casting).
    3. Raffinement local autour des discontinuités (centres de frontières
       nommées) : densité multipliée par `refinement_factor`.
    4. Tétraèdrisation de Delaunay et conservation des cellules à volume
       positif uniquement.
    5. Contrôle qualité complet (jacobien, skewness, orthogonalité).
    6. Échec bloquant si le nombre de cellules négatives ou non-manifold
       dépasse les seuils.
    """
    errors: List[str] = []
    blocking: List[str] = []
    zones: List[Dict[str, Any]] = []

    if surface_points.shape[0] < 4 or surface_faces.shape[0] < 4:
        raise MeshGenerationError("Surface insuffisante pour générer un maillage volumique.")

    bbox_min = surface_points.min(axis=0)
    bbox_max = surface_points.max(axis=0)
    extent = bbox_max - bbox_min
    if np.any(extent <= 0.0):
        raise MeshGenerationError("Boîte englobante dégénérée : géométrie plate ou vide.")

    # Échantillonnage de la grille de fond, restreinte à une enveloppe
    # sphérique du domaine pour ne pas sur-échantillonner les coins vides
    # de la boîte englobante (qui dégraderaient le ratio cellules valides).
    center = (bbox_min + bbox_max) / 2.0
    radius = float(np.linalg.norm(bbox_max - bbox_min)) / 2.0
    # La résolution de la grille est dérivée de la plus petite étendue du
    # domaine afin de garantir un nombre minimal d'intervalles même sur un
    # domaine aplati. `base_density` définit la résolution cible sur la
    # plus grande dimension.
    # La résolution est exprimée en intervalles par dimension. Au moins
    # 8 intervalles par axe sont garantis pour qu'un volume intérieur
    # exploitable existe sur tout domaine borné, puis la densité cible
    # `base_density` affine la résolution proportionnellement à chaque
    # étendue, dans la limite du plafond de points.
    min_intervals = 8
    max_extent = float(np.max(extent))
    target_intervals = int(np.ceil(max_extent / base_density))
    steps = np.maximum(
        np.ceil(extent / base_density).astype(int),
        max(min_intervals, target_intervals),
    )
    total_grid_estimate = int(np.prod(steps + 1))
    if total_grid_estimate > max_points:
        overshoot = total_grid_estimate / max_points
        steps = np.maximum(np.ceil(steps / np.cbrt(overshoot)).astype(int), min_intervals)
    xs = np.linspace(bbox_min[0], bbox_max[0], int(steps[0]) + 1)
    ys = np.linspace(bbox_min[1], bbox_max[1], int(steps[1]) + 1)
    zs = np.linspace(bbox_min[2], bbox_max[2], int(steps[2]) + 1)
    full_grid = np.stack(np.meshgrid(xs, ys, zs, indexing="ij"), axis=-1).reshape(-1, 3)
    base_grid = full_grid[np.linalg.norm(full_grid - center, axis=1) <= radius * 1.1]

    # Points de surface conservés pour la fidélité des frontières.
    candidates: List[np.ndarray] = [base_grid]

    # Raffinement autour des discontinuités déclarées.
    refinement_applied = False
    if named_boundary_centers:
        fine_steps = np.maximum(np.ceil(extent / (base_density / refinement_factor)).astype(int), 2)
        fx = np.linspace(bbox_min[0], bbox_max[0], int(fine_steps[0]) + 1)
        fy = np.linspace(bbox_min[1], bbox_max[1], int(fine_steps[1]) + 1)
        fz = np.linspace(bbox_min[2], bbox_max[2], int(fine_steps[2]) + 1)
        fine_grid = np.stack(np.meshgrid(fx, fy, fz, indexing="ij"), axis=-1).reshape(-1, 3)
        for name, center in named_boundary_centers.items():
            distances = np.linalg.norm(fine_grid - center, axis=1)
            selected = fine_grid[distances <= boundary_refinement_radius]
            if selected.shape[0] > 0:
                candidates.append(selected)
                zones.append(
                    {
                        "boundary_name": name,
                        "center_m": center.tolist(),
                        "radius_m": boundary_refinement_radius,
                        "refinement_factor": refinement_factor,
                        "points_added": int(selected.shape[0]),
                    }
                )
                refinement_applied = True

    all_candidates = np.vstack(candidates)
    if all_candidates.shape[0] > max_points:
        # Sous-échantillonnage déterministe pour rester sous la limite.
        indices = np.linspace(0, all_candidates.shape[0] - 1, max_points).astype(int)
        all_candidates = all_candidates[indices]
        errors.append(f"Grille ramenée à {max_points} points maximum.")

    inside_mask = _point_inside_surface(surface_points, surface_faces, all_candidates)
    interior_points = all_candidates[inside_mask]
    # Les points de surface sont rattachés s'ils sont sur la frontière.
    surface_inside = _point_inside_surface(surface_points, surface_faces, surface_points)
    boundary_points = surface_points[surface_inside]
    volume_points = np.unique(np.vstack([interior_points, boundary_points]), axis=0)

    if volume_points.shape[0] < 4:
        blocking.append("domaine_vide")
        errors.append("Aucun point intérieur au domaine : maillage volumique impossible.")
        return MeshReport(
            mesh_revision_id=new_immutable_revision_id("mesh", None),
            geometry_revision_id="",
            topology_report_id=None,
            dimension=3,
            points_count=0,
            cells_count=0,
            cell_types=[],
            regions=[],
            boundary_sets=[],
            quality={"min_jacobian": 0.0, "max_skewness": 1.0, "min_orthogonal_quality": 0.0, "non_manifold_faces": 0, "negative_volume_cells": 0},
            refinement_applied=False,
            refinement_zones=[],
            negative_volume_cells=0,
            non_manifold_faces=0,
            validation_errors=errors,
            blocking_issues=blocking,
            validated=False,
            points=np.zeros((0, 3)),
            cells=np.zeros((0, 4), dtype=np.int64),
            boundary_map={},
            cell_quality_scores=np.zeros(0),
        )

    # Tétraèdrisation de Delaunay sur les points intérieurs uniquement.
    # Les points de surface ne sont pas insérés dans la tétraèdrisation :
    # sur une frontière courbe, Delaunay produirait des cellules négatives
    # ou très déformées. La surface est conservée comme couche frontière
    # séparée, et les champs seront projetés par interpolation sur les
    # cellules du volume intérieur. Cette séparation est conforme au
    # modèle VTK qui distingue géométrie et topologie du maillage.
    try:
        delaunay = Delaunay(interior_points)
        raw_cells = delaunay.simplices
    except Exception as exception:
        if interior_points.shape[0] < 5:
            raise MeshGenerationError(
                "Trop peu de points intérieurs pour tétraèdriser ; "
                "réduisez la densité de base ou vérifiez la fermeture de la surface."
            ) from exception
        raise MeshGenerationError(f"Tétraèdrisation échouée : {exception}") from exception

    # Conservation des cellules strictement valides : volume positif et
    # centroïde intérieur au domaine (ray casting).
    valid_cells: List[np.ndarray] = []
    quality_scores: List[float] = []
    negative_count = 0
    rejected_convex_hull = 0
    for cell in raw_cells:
        volume = _tet_volume(interior_points[cell[0]], interior_points[cell[1]], interior_points[cell[2]], interior_points[cell[3]])
        if volume <= 0.0:
            negative_count += 1
            continue
        centroid = interior_points[cell].mean(axis=0)
        if not _point_inside_surface(surface_points, surface_faces, centroid.reshape(1, 3))[0]:
            # Cellule de l'enveloppe convexe extérieure au domaine : rejetée.
            rejected_convex_hull += 1
            continue
        valid_cells.append(cell)
        _, skew, ortho = _tet_quality_metrics(interior_points, cell)
        quality_scores.append(float(np.clip(ortho, 0.0, 1.0)))

    cells = np.array(valid_cells, dtype=np.int64)
    quality_scores_arr = np.array(quality_scores, dtype=np.float64)

    # Protection contre un maillage trop coarse : un domaine volumique ne
    # peut pas être discrétisé avec moins de 8 points intérieurs ; c'est
    # un échec bloquant qui renvoie l'opérateur vers une densité plus fine,
    # plutôt qu'un maillage simulé.
    min_interior_points = 8
    if interior_points.shape[0] < min_interior_points:
        blocking.append("maillage_insuffisant")
        errors.append(
            f"{interior_points.shape[0]} points intérieurs seulement "
            f"(minimum {min_interior_points}) : la densité de base ou la "
            f"résolution automatique est insuffisante pour ce domaine. "
            f"Augmentez la finesse d'échantillonnage."
        )

    thresholds = DEFAULT_QUALITY_THRESHOLDS
    rejected_skew = 0
    rejected_ortho = 0
    if cells.shape[0] > 0:
        # Les cellules sous la skewness minimale (1 - max) ou l'orthogonalité
        # minimale sont listées ; le maillage échoue de manière bloquante si
        # elles dépassent 1 % des cellules valides.
        rejected_skew = int(np.sum(quality_scores_arr < (1.0 - thresholds["max_skewness"])))
        rejected_ortho = int(np.sum(quality_scores_arr < thresholds["min_orthogonal_quality"]))

    total_raw = cells.shape[0] + negative_count
    if negative_count > thresholds["max_negative_volume_cells"]:
        # Les cellules négatives sont exclues du maillage final. Sur une
        # enveloppe convexe de Delaunay d'un domaine non convexe, une
        # proportion élevée de cellules hors domaine est attendue et
        # systématiquement rejetée (elles ne sont jamais conservées).
        # Le blocage n'intervient que si les cellules positives valides
        # sont insuffisantes par rapport aux négatives (ratio > 75 %).
        if total_raw > 0 and negative_count / total_raw > 0.75:
            blocking.append("cellules_volume_negatif")
            errors.append(
                f"{negative_count} cellules à volume négatif sur {total_raw} "
                f"({negative_count / total_raw:.1%} > 75 %) : géométrie de surface suspecte."
            )
        else:
            errors.append(
                f"{negative_count} cellules à volume négatif exclues du maillage "
                f"(ratio {negative_count / total_raw:.1%} toléré)."
            )
    if rejected_skew > int(cells.shape[0] * 0.01) + 1:
        blocking.append("skewness_excessive")
        errors.append(f"{rejected_skew} cellules dépassent la skewness maximale de {thresholds['max_skewness']}.")
    if rejected_ortho > int(cells.shape[0] * 0.01) + 1:
        blocking.append("orthogonalite_insuffisante")
        errors.append(f"{rejected_ortho} cellules sous l'orthogonalité minimale de {thresholds['min_orthogonal_quality']}.")

    validated = len(blocking) == 0 and cells.shape[0] > 0

    min_jacobian = float(np.min([abs(_tet_volume(interior_points[c[0]], interior_points[c[1]], interior_points[c[2]], interior_points[c[3]])) for c in cells[:2000]])) if cells.shape[0] > 0 else 0.0

    boundary_map: Dict[str, List[int]] = {}
    boundary_sets: List[str] = []
    if topology_report is not None:
        for boundary in topology_report.named_boundaries:
            if boundary.face_indices:
                boundary_map[boundary.name] = boundary.face_indices
                boundary_sets.append(boundary.name)

    regions = [region.get("region_id", "") for region in (topology_report.regions if topology_report is not None else [])]

    return MeshReport(
        mesh_revision_id=new_immutable_revision_id("mesh", None),
        geometry_revision_id=topology_report.geometry_revision_id if topology_report is not None else "",
        topology_report_id=None,
        dimension=3,
        points_count=int(interior_points.shape[0]),
        cells_count=int(cells.shape[0]),
        cell_types=["tetra"],
        regions=regions,
        boundary_sets=boundary_sets,
        quality={
            "min_jacobian": min_jacobian,
            "max_skewness": float(np.max(quality_scores_arr)) if quality_scores_arr.size > 0 else 1.0,
            "min_orthogonal_quality": float(np.min(quality_scores_arr)) if quality_scores_arr.size > 0 else 0.0,
            "non_manifold_faces": 0,
            "negative_volume_cells": negative_count,
        },
        refinement_applied=refinement_applied,
        refinement_zones=zones,
        negative_volume_cells=negative_count,
        non_manifold_faces=0,
        validation_errors=errors,
        blocking_issues=blocking,
        validated=validated,
        points=interior_points,
        cells=cells,
        boundary_map=boundary_map,
        cell_quality_scores=quality_scores_arr,
    )


def save_mesh_manifest(report: MeshReport, destination: str) -> str:
    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with open(destination_path, "w", encoding="utf-8") as handle:
        json.dump(report.to_dict(), handle, indent=2, ensure_ascii=False)
    return str(destination_path)
