"""Résolution stricte project_id -> géométrie CAO/article.

Le résolveur n'infère jamais une géométrie depuis le nom ou la catégorie du
projet. Une liaison explicite et active doit exister dans
project_geometry_bindings.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException
from supabase import Client, create_client

_UUID = re.compile(r"^[0-9a-fA-F-]{36}$")
_SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")


@dataclass(frozen=True)
class ProjectGeometryBinding:
    project_id: str
    owner_id: str
    article_key: str
    geometry_kind: str
    geometry_path: str
    mesh_revision: str
    geometry_sha256: str
    source_uri: str
    status: str


def _client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise HTTPException(status_code=503, detail="Persistance géométrique indisponible.")
    return create_client(url, key)


def resolve_project_geometry(project_id: str, owner_id: str) -> ProjectGeometryBinding:
    """Retourne la géométrie explicitement liée ou lève une erreur bloquante."""
    if not _UUID.fullmatch(project_id) or not _UUID.fullmatch(owner_id):
        raise HTTPException(status_code=422, detail="project_id/owner_id doivent être des UUID valides.")
    try:
        response = (
            _client().table("project_geometry_bindings")
            .select("project_id,owner_id,article_key,geometry_kind,geometry_path,mesh_revision,geometry_sha256,source_uri,status")
            .eq("project_id", project_id)
            .eq("owner_id", owner_id)
            .eq("status", "ACTIVE")
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lecture du mapping géométrique échouée: {exc}") from exc
    rows = getattr(response, "data", None) or []
    if not rows:
        raise HTTPException(
            status_code=409,
            detail=(
                "Aucune géométrie CAO ACTIVE n'est liée à ce project_id. "
                "Refus de substituer une géométrie de démonstration."
            ),
        )
    row: dict[str, Any] = rows[0]
    for key in ("article_key", "geometry_path", "mesh_revision", "source_uri"):
        if not isinstance(row.get(key), str) or not row[key].strip():
            raise HTTPException(status_code=422, detail=f"Mapping géométrique incomplet: {key}.")
    if not isinstance(row.get("geometry_sha256"), str) or not _SHA256.fullmatch(row["geometry_sha256"]):
        raise HTTPException(status_code=422, detail="Mapping géométrique: geometry_sha256 invalide.")
    return ProjectGeometryBinding(**row)


def geometry_manifest(binding: ProjectGeometryBinding) -> dict[str, str]:
    return {
        "projectId": binding.project_id,
        "articleKey": binding.article_key,
        "geometryKind": binding.geometry_kind,
        "geometryPath": binding.geometry_path,
        "meshRevision": binding.mesh_revision,
        "geometrySha256": binding.geometry_sha256,
        "sourceUri": binding.source_uri,
        "status": binding.status,
    }
