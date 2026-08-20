"""Export GLB — volet 5a.

Produit une scène de surface au format GLB (glTF 2.0 binaire) : la géométrie
de surface issue de l'import STEP (ou du validateur topologique) est exportée
avec ses métadonnées de provenance dans les extensions `extras`. Aucun champ
physique n'est inventé : les seules données exportées sont les sommets, les
faces et les métadonnées de révision immuable.
"""
from __future__ import annotations

import json
import struct
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .revision import ValidationStatus


class GltfExportError(Exception):
    """L'export GLB a échoué de manière bloquante."""


MIME_JSON = "application/json"
MIME_BIN = "application/octet-stream"


def _make_buffer_view(data: bytes, buffer_offset: int) -> Dict[str, Any]:
    return {
        "buffer": 0,
        "byteLength": len(data),
        "byteOffset": buffer_offset,
        "target": 34962,  # ELEMENT_ARRAY_BUFFER (le caller adapte si attribut)
    }


def _add_accessor(
    accessors: List[Dict[str, Any]],
    buffer_view_index: int,
    component_type: int,
    view_byte_offset: int,
    count: int,
    gltf_type: str,
    min_values: List[float],
    max_values: List[float],
    is_indices: bool = False,
) -> int:
    entry: Dict[str, Any] = {
        "bufferView": buffer_view_index,
        "byteOffset": view_byte_offset,
        "componentType": component_type,
        "count": count,
        "type": gltf_type,
    }
    if not is_indices:
        entry["min"] = min_values
        entry["max"] = max_values
    accessors.append(entry)
    return len(accessors) - 1


GLTF_COMPONENT_FLOAT = 5126
GLTF_COMPONENT_UINT16 = 5123
GLTF_COMPONENT_UINT32 = 5125


def export_glb(
    vertices: np.ndarray,
    faces: np.ndarray,
    geometry_revision_id: str,
    source_filename: Optional[str] = None,
    units_label: Optional[str] = None,
    status: str = ValidationStatus.REQUIRED_INPUT.value,
    destination: str = "output.glb",
    normals: Optional[np.ndarray] = None,
    colors: Optional[np.ndarray] = None,
) -> str:
    """Exporte la scène de surface en GLB 2.0 binaire.

    L'export échoue en bloquant si les données de géométrie sont manquantes
    ou incohérentes ; il n'existe aucun fallback simulé.
    """
    if vertices is None or vertices.shape[0] == 0:
        raise GltfExportError("Aucun sommet de surface disponible pour l'export GLB.")
    if faces is None or faces.shape[0] == 0:
        raise GltfExportError("Aucune face de surface disponible pour l'export GLB.")

    vertices = np.asarray(vertices, dtype=np.float32)
    faces = np.asarray(faces, dtype=np.uint32)
    vertex_count = vertices.shape[0]
    if vertex_count > 65535:
        raise GltfExportError(
            f"{vertex_count} sommets dépassent la limite uint16 supportée par ce pipeline "
            f"GLB simplifié. Découpez la surface ou utilisez un export glTF multi-nœuds."
        )

    if normals is not None:
        normals = np.asarray(normals, dtype=np.float32)
        if normals.shape != vertices.shape:
            normals = None
    if colors is not None:
        colors = np.asarray(colors, dtype=np.float32)
        if colors.ndim != 2 or colors.shape[0] != vertex_count or colors.shape[1] not in (3, 4):
            colors = None

    position_min = vertices.min(axis=0).tolist()
    position_max = vertices.max(axis=0).tolist()
    bbox_center = ((np.asarray(position_min) + np.asarray(position_max)) / 2.0).tolist()
    bbox_size = (np.asarray(position_max) - np.asarray(position_min)).tolist()

    # Méta-données de provenance dans `extras` : rien n'est simulé.
    extras: Dict[str, Any] = {
        "quantum_pinn": {
            "geometry_revision_id": geometry_revision_id,
            "source_file": source_filename,
            "units_label": units_label or "REQUIRED_INPUT",
            "status": status,
            "exported_field": "surface_only",
            "note": "Scène de surface CAO ; aucun champ physique simulé n'est inclus.",
        }
    }

    # Layout : positions | normals | colors | indices
    buffers: List[bytes] = []
    buffer_views: List[Dict[str, Any]] = []
    accessors: List[Dict[str, Any]] = []

    def add_buffer(data: bytes, target: Optional[int]) -> Tuple[int, int]:
        offset = sum(len(b) for b in buffers)
        buffers.append(data)
        view_index = len(buffer_views)
        buffer_views.append(
            {
                "buffer": 0,
                "byteLength": len(data),
                "byteOffset": offset,
                **({"target": target} if target is not None else {}),
            }
        )
        return view_index, offset

    # Positions
    position_data = vertices.tobytes()
    pv_idx, _ = add_buffer(position_data, 34963)  # ARRAY_BUFFER
    pos_accessor = _add_accessor(
        accessors, pv_idx, GLTF_COMPONENT_FLOAT, 0, vertex_count, "VEC3",
        position_min, position_max,
    )

    # Normales
    normal_accessor: Optional[int] = None
    if normals is not None:
        normal_data = normals.tobytes()
        nv_idx, _ = add_buffer(normal_data, 34963)
        normal_accessor = _add_accessor(
            accessors, nv_idx, GLTF_COMPONENT_FLOAT, 0, vertex_count, "VEC3",
            [-1.0, -1.0, -1.0], [1.0, 1.0, 1.0],
        )

    # Couleurs
    color_accessor: Optional[int] = None
    if colors is not None:
        color_data = colors.tobytes()
        cv_idx, _ = add_buffer(color_data, 34963)
        gltf_type = "VEC4" if colors.shape[1] == 4 else "VEC3"
        color_accessor = _add_accessor(
            accessors, cv_idx, GLTF_COMPONENT_FLOAT, 0, vertex_count, gltf_type,
            [0.0] * colors.shape[1], [1.0] * colors.shape[1],
        )

    # Indices
    index_data = faces.tobytes()
    iv_idx, _ = add_buffer(index_data, 34962)  # ELEMENT_ARRAY_BUFFER
    index_accessor = _add_accessor(
        accessors, iv_idx, GLTF_COMPONENT_UINT32, 0, faces.shape[0] * 3, "SCALAR",
        [0], [int(vertex_count) - 1], is_indices=True,
    )

    attributes: Dict[str, int] = {"POSITION": pos_accessor}
    if normal_accessor is not None:
        attributes["NORMAL"] = normal_accessor
    if color_accessor is not None:
        attributes["COLOR_0"] = color_accessor

    json_chunk: Dict[str, Any] = {
        "asset": {"version": "2.0", "generator": "Quantum-Hybrid-PINN CAO exporter"},
        "scene": 0,
        "scenes": [{"nodes": [0], "name": "surface_scene"}],
        "nodes": [{"mesh": 0, "name": "surface_mesh"}],
        "meshes": [
            {
                "name": "cao_surface",
                "primitives": [
                    {
                        "attributes": attributes,
                        "indices": index_accessor,
                        "mode": 4,  # TRIANGLES
                    }
                ],
            }
        ],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": sum(len(b) for b in buffers)}],
        "extras": extras,
    }
    if bbox_center and bbox_size:
        json_chunk["extras"]["quantum_pinn"]["bbox_center_m"] = bbox_center
        json_chunk["extras"]["quantum_pinn"]["bbox_size_m"] = bbox_size

    json_bytes = json.dumps(json_chunk, ensure_ascii=False).encode("utf-8")
    json_padded = json_bytes + b" " * (-len(json_bytes) % 4)
    bin_bytes = b"".join(buffers)
    if len(bin_bytes) % 4:
        bin_bytes += b"\x00" * (-len(bin_bytes) % 4)

    total_length = 12 + 8 + len(json_padded) + 8 + len(bin_bytes)

    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with open(destination_path, "wb") as file:
        file.write(b"glTF")
        file.write(struct.pack("<I", 2))
        file.write(struct.pack("<I", total_length))
        file.write(struct.pack("<I", len(json_padded)))
        file.write(b"JSON")
        file.write(json_padded)
        file.write(struct.pack("<I", len(bin_bytes)))
        file.write(b"BIN\x00")
        file.write(bin_bytes)

    return str(destination_path)
