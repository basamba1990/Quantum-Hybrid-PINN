"""Import sécurisé de jeux de données CFD VTU + sidecar.

Le module ne fabrique aucun champ physique, aucune unité et aucun résidu.
Il accepte uniquement des artefacts VTU réellement fournis par le client et
persiste le contrat reconstruit à partir des octets et des métadonnées signées.

Sécurité : définir CFD_IMPORT_API_TOKEN côté serveur. La route refuse tout
appel si ce secret n'est pas configuré ou si le Bearer token est incorrect.
"""
from __future__ import annotations

import asyncio
import gzip
import hashlib
import io
import json
import os
import re
import tempfile
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import numpy as np
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from supabase import Client, create_client

from cfd_gate_service import evaluate_cfd_gates

try:
    import meshio
except ImportError as exc:  # pragma: no cover - configuration error
    meshio = None
    _MESHIO_IMPORT_ERROR = exc

router = APIRouter(prefix="/v2/cfd", tags=["cfd-import"])

MAX_UPLOAD_BYTES = int(os.getenv("CFD_IMPORT_MAX_BYTES", str(50 * 1024 * 1024)))
MAX_TOTAL_UPLOAD_BYTES = int(os.getenv("CFD_IMPORT_MAX_TOTAL_BYTES", str(40 * 1024 * 1024)))
MAX_FILES_PER_IMPORT = int(os.getenv("CFD_IMPORT_MAX_FILES", "32"))
_IMPORT_LOCK = asyncio.Lock()
_ALLOWED_VTU = {".vtu"}
_VTK_CELL_TYPES = {
    "vertex": 1,
    "line": 3,
    "triangle": 5,
    "quad": 9,
    "tetra": 10,
    "hexahedron": 12,
    "wedge": 13,
    "pyramid": 14,
}
_SAFE_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}$")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _auth_token(authorization: str | None) -> None:
    expected = os.getenv("CFD_IMPORT_API_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Import CFD désactivé : CFD_IMPORT_API_TOKEN n'est pas configuré côté serveur.",
        )
    supplied = (authorization or "")
    if not supplied.startswith("Bearer ") or supplied[7:].strip() != expected:
        raise HTTPException(status_code=401, detail="Bearer token d'import CFD invalide.")


def require_cfd_import_auth(authorization: str | None = Header(default=None)) -> None:
    _auth_token(authorization)


async def require_import_slot() -> None:
    if _IMPORT_LOCK.locked():
        raise HTTPException(status_code=429, detail="Un import CFD volumineux est déjà en cours; réessayez après sa fin.")
    await _IMPORT_LOCK.acquire()
    try:
        yield
    finally:
        _IMPORT_LOCK.release()


async def _read_limited(upload: UploadFile, label: str) -> bytes:
    total = 0
    chunks: list[bytes] = []
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"{label} dépasse la limite CFD_IMPORT_MAX_BYTES ({MAX_UPLOAD_BYTES} octets).",
            )
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(status_code=400, detail=f"{label} vide.")
    return b"".join(chunks)


def _validate_filename(filename: str | None, extension: set[str], label: str) -> str:
    name = os.path.basename(filename or "")
    if not _SAFE_FILENAME.fullmatch(name):
        raise HTTPException(status_code=400, detail=f"Nom de fichier {label} non sûr ou invalide.")
    if os.path.splitext(name)[1].lower() not in extension:
        raise HTTPException(status_code=415, detail=f"{label} doit avoir l'extension {sorted(extension)}.")
    return name


def _normalise_cells(mesh: Any) -> Tuple[list[float], list[int], list[int], list[int], int]:
    points = np.asarray(mesh.points, dtype=np.float64)
    if points.ndim != 2 or points.shape[1] != 3 or not np.isfinite(points).all():
        raise HTTPException(status_code=422, detail="VTU: coordonnées 3D absentes, non finies ou mal formées.")

    connectivity: list[int] = []
    offsets: list[int] = [0]
    cell_types: list[int] = []
    for block in mesh.cells:
        vtk_type = _VTK_CELL_TYPES.get(block.type)
        if vtk_type is None:
            raise HTTPException(status_code=422, detail=f"VTU: type de cellule non supporté: {block.type}.")
        data = np.asarray(block.data)
        if data.ndim != 2 or data.shape[0] == 0:
            raise HTTPException(status_code=422, detail=f"VTU: connectivité invalide pour {block.type}.")
        for row in data:
            indices = [int(value) for value in row.tolist()]
            if any(value < 0 or value >= len(points) for value in indices):
                raise HTTPException(status_code=422, detail="VTU: connectivité hors limites.")
            connectivity.extend(indices)
            offsets.append(len(connectivity))
            cell_types.append(vtk_type)

    if not cell_types:
        raise HTTPException(status_code=422, detail="VTU: aucune cellule volumique ou surfacique exploitable.")
    return points.reshape(-1).tolist(), connectivity, offsets, cell_types, len(cell_types)


def _component_count(array: np.ndarray) -> int:
    if array.ndim == 1:
        return 1
    if array.ndim == 2:
        return int(array.shape[1])
    raise HTTPException(status_code=422, detail="VTU: champ avec plus de deux dimensions non supporté.")


def _field(name: str, values: Any, association: str, descriptors: Dict[str, Any]) -> Dict[str, Any]:
    array = np.asarray(values)
    if not np.issubdtype(array.dtype, np.number):
        raise HTTPException(status_code=422, detail=f"VTU: champ {name} non numérique.")
    array = np.asarray(array, dtype=np.float64)
    if not np.isfinite(array).all():
        raise HTTPException(status_code=422, detail=f"VTU: champ {name} contient NaN ou infini.")
    descriptor = descriptors.get(name)
    if not isinstance(descriptor, dict):
        raise HTTPException(status_code=422, detail=f"Sidecar: descripteur obligatoire absent pour le champ {name}.")
    unit = descriptor.get("unit")
    quantity = descriptor.get("quantity")
    if not isinstance(unit, str) or not unit.strip() or not isinstance(quantity, str) or not quantity.strip():
        raise HTTPException(status_code=422, detail=f"Sidecar: unité/quantité absente pour le champ {name}.")
    return {
        "name": name,
        "association": association,
        "components": _component_count(array),
        "values": array.reshape(-1).tolist(),
        "unit": unit,
        "quantity": quantity,
    }


def _cell_data(mesh: Any) -> Dict[str, np.ndarray]:
    result: Dict[str, np.ndarray] = {}
    for name, blocks in (getattr(mesh, "cell_data", {}) or {}).items():
        if isinstance(blocks, list):
            arrays = [np.asarray(item) for item in blocks]
            if arrays:
                result[name] = np.concatenate(arrays)
        else:
            result[name] = np.asarray(blocks)
    return result


def _parse_vtu(content: bytes, filename: str, descriptors: Dict[str, Any]) -> Dict[str, Any]:
    if meshio is None:
        raise HTTPException(status_code=503, detail=f"Dépendance meshio absente: {_MESHIO_IMPORT_ERROR}")
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".vtu", delete=False) as temporary:
            temporary.write(content)
            temporary_path = temporary.name
        mesh = meshio.read(temporary_path, file_format="vtu")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"VTU illisible ({filename}): {exc}") from exc
    finally:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except OSError:
                pass
    points, cells, offsets, cell_types, cell_count = _normalise_cells(mesh)
    point_arrays = getattr(mesh, "point_data", {}) or {}
    cell_arrays = _cell_data(mesh)
    fields: list[Dict[str, Any]] = []
    for name, values in point_arrays.items():
        fields.append(_field(str(name), values, "point", descriptors))
    for name, values in cell_arrays.items():
        fields.append(_field(str(name), values, "cell", descriptors))
    if not fields:
        raise HTTPException(status_code=422, detail=f"VTU {filename}: aucun champ numérique trouvé.")
    return {
        "points": points,
        "cells": cells,
        "offsets": offsets,
        "cellTypes": cell_types,
        "fields": fields,
        "pointCount": len(points) // 3,
        "cellCount": cell_count,
    }


def _verify_sidecar(sidecar: Dict[str, Any], files: Dict[str, bytes]) -> None:
    if sidecar.get("contractVersion") != "cfd-volume.v1":
        raise HTTPException(status_code=422, detail="Sidecar: contractVersion doit être cfd-volume.v1.")
    frame_specs = sidecar.get("frames")
    if not isinstance(frame_specs, list) or not frame_specs:
        raise HTTPException(status_code=422, detail="Sidecar: frames[] obligatoire.")
    declared_names: set[str] = set()
    for spec in frame_specs:
        if not isinstance(spec, dict):
            raise HTTPException(status_code=422, detail="Sidecar: entrée de frame invalide.")
        name = _validate_filename(spec.get("file"), _ALLOWED_VTU, "frame VTU")
        declared_names.add(name)
        expected = spec.get("payloadHash")
        actual = _sha256(files.get(name, b""))
        if name not in files:
            raise HTTPException(status_code=422, detail=f"Frame déclarée absente de l'upload: {name}.")
        if not isinstance(expected, str) or expected.lower() != actual:
            raise HTTPException(status_code=422, detail=f"SHA-256 invalide pour {name}: attendu {expected}, calculé {actual}.")
    if declared_names != set(files):
        raise HTTPException(status_code=422, detail="L’upload doit contenir exactement les frames VTU déclarées par le sidecar.")
    provenance = sidecar.get("provenance")
    if not isinstance(provenance, dict) or not isinstance(provenance.get("sourceHash"), str) or not re.fullmatch(r"[0-9a-fA-F]{64}", provenance["sourceHash"]):
        raise HTTPException(status_code=422, detail="Sidecar: provenance.sourceHash SHA-256 obligatoire.")
    for key in ("boundarySets", "residuals", "references", "evidence", "fieldDescriptors"):
        if key not in sidecar:
            raise HTTPException(status_code=422, detail=f"Sidecar: propriété obligatoire absente: {key}.")


def _build_dataset(sidecar: Dict[str, Any], parsed: list[Dict[str, Any]]) -> Dict[str, Any]:
    first = parsed[0]
    for current in parsed[1:]:
        if current["cells"] != first["cells"] or current["offsets"] != first["offsets"] or current["cellTypes"] != first["cellTypes"]:
            raise HTTPException(status_code=422, detail="Toutes les frames doivent partager exactement la même connectivité.")
        if current["pointCount"] != first["pointCount"] or current["cellCount"] != first["cellCount"]:
            raise HTTPException(status_code=422, detail="Toutes les frames doivent partager la même topologie.")
    specs = sorted(sidecar["frames"], key=lambda item: float(item["time"]))
    times = [float(item["time"]) for item in specs]
    if any(not np.isfinite(t) for t in times) or any(b <= a for a, b in zip(times, times[1:])):
        raise HTTPException(status_code=422, detail="Les temps de frames doivent être finis et strictement croissants.")
    by_name = {item["file"]: parsed[index] for index, item in enumerate(sidecar["frames"])}
    frames = []
    for spec in specs:
        item = by_name[spec["file"]]
        frames.append({
            "frameId": str(spec["frameId"]),
            "time": float(spec["time"]),
            "points": item["points"],
            "cells": item["cells"],
            "offsets": item["offsets"],
            "cellTypes": item["cellTypes"],
            "fields": item["fields"],
        })
    dataset = {key: value for key, value in sidecar.items() if key != "frames"}
    dataset.update({
        "contractVersion": "cfd-volume.v1",
        "pointCount": first["pointCount"],
        "cellCount": first["cellCount"],
        "frames": frames,
    })
    return dataset


def _supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise HTTPException(status_code=503, detail="Persistance CFD indisponible : SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY manquants.")
    return create_client(url, key)


def _verify_project_owner(project_id: str, owner_id: str) -> None:
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", project_id) or not re.fullmatch(r"[0-9a-fA-F-]{36}", owner_id):
        raise HTTPException(status_code=422, detail="project_id/owner_id doivent être des UUID valides.")
    try:
        response = _supabase().table("projects").select("id,user_id").eq("id", project_id).eq("user_id", owner_id).limit(1).execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vérification du projet échouée: {exc}") from exc
    if not getattr(response, "data", None):
        raise HTTPException(status_code=404, detail="Projet absent ou non accessible par l’utilisateur connecté.")


def _verify_analysis_owner(analysis_id: str | None, project_id: str, owner_id: str) -> None:
    if not analysis_id:
        return
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", analysis_id):
        raise HTTPException(status_code=422, detail="analysis_id doit être un UUID valide.")
    try:
        response = (_supabase().table("analyses").select("id")
                    .eq("id", analysis_id).eq("project_id", project_id)
                    .eq("user_id", owner_id).limit(1).execute())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vérification de l’analyse échouée: {exc}") from exc
    if not getattr(response, "data", None):
        raise HTTPException(status_code=404, detail="Analyse absente ou non accessible par l’utilisateur connecté.")


def _dataset_summary(dataset: Dict[str, Any]) -> Dict[str, Any]:
    """Keep DB metadata small; the exact contract lives as a compressed Storage object."""
    summary = {key: value for key, value in dataset.items() if key != "frames"}
    summary["frames"] = [
        {
            "frameId": frame.get("frameId"),
            "time": frame.get("time"),
            "pointCount": len(frame.get("points", [])) // 3,
            "cellCount": len(frame.get("cellTypes", [])),
            "fieldNames": [field.get("name") for field in frame.get("fields", [])],
        }
        for frame in dataset.get("frames", [])
    ]
    summary["frameCount"] = len(summary["frames"])
    return summary


def _dataset_blob(dataset: Dict[str, Any]) -> bytes:
    raw = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    return gzip.compress(raw, compresslevel=6, mtime=0)


def _storage_bytes(client: Client, bucket: str, path: str, label: str) -> bytes:
    """Download exact bytes, tolerating SDK wrappers and short visibility lag."""
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            content = client.storage.from_(bucket).download(path)
            if not isinstance(content, bytes):
                content = getattr(content, "content", None) or getattr(content, "data", None)
            if isinstance(content, (bytearray, memoryview)):
                content = bytes(content)
            if isinstance(content, bytes) and content:
                return content
            raise RuntimeError(f"Réponse Storage non binaire ou vide pour {label}.")
        except Exception as exc:  # SDK versions expose different storage errors
            last_error = exc
            if attempt < 3:
                time.sleep(0.25 * (2 ** attempt))
    raise RuntimeError(f"Lecture Storage impossible pour {label} après 4 tentatives: {last_error}")


def _load_dataset(row: Dict[str, Any]) -> Dict[str, Any]:
    """Load the exact contract from Storage, with legacy DB JSON fallback."""
    manifest = row.get("artifact_manifest") or {}
    path = manifest.get("datasetPath")
    if not path:
        return row.get("dataset") or {}
    bucket = str(manifest.get("bucket") or os.getenv("CFD_ARTIFACT_BUCKET", "cfd-artifacts")).strip()
    try:
        blob = _storage_bytes(_supabase(), bucket, path, "dataset contract")
        if manifest.get("datasetEncoding") == "gzip+json":
            blob = gzip.decompress(blob)
        dataset = json.loads(blob.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lecture du contrat CFD depuis Storage échouée: {exc}") from exc
    if not isinstance(dataset, dict):
        raise HTTPException(status_code=502, detail="Contrat CFD Storage invalide: objet JSON attendu.")
    return dataset


def _persist_dataset(dataset: Dict[str, Any], files: Dict[str, bytes], sidecar_bytes: bytes, case_id: str, project_id: str, owner_id: str, analysis_id: str | None = None) -> str:
    # The application creates the analysis first. Keep a UUID fallback for
    # legacy import callers, but never replace an explicitly supplied ID.
    analysis_id = analysis_id or str(uuid.uuid4())
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", analysis_id):
        raise HTTPException(status_code=422, detail="analysis_id doit être un UUID valide.")
    dataset_id = str(uuid.uuid4())
    status = "UNVALIDATED"
    classification = str(dataset.get("classification", ""))
    evidence = dataset.get("evidence", {})
    if classification.startswith("SYNTHETIC") or not all(evidence.values() if isinstance(evidence, dict) else []):
        status = "STRUCTURAL_TEST_UNVALIDATED" if classification.startswith("SYNTHETIC") else "UNVALIDATED"
    first_frame = dataset.get("frames", [{}])[0]
    mesh_hash = _sha256(json.dumps({
        "points": first_frame.get("points", []),
        "cells": first_frame.get("cells", []),
        "offsets": first_frame.get("offsets", []),
        "cellTypes": first_frame.get("cellTypes", []),
    }, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    frame_hashes = {name: _sha256(payload) for name, payload in sorted(files.items())}
    artifact_manifest = {
        "sidecarSha256": _sha256(sidecar_bytes),
        "frames": [{"file": name, "sha256": digest, "bytes": len(files[name])} for name, digest in frame_hashes.items()],
    }
    dataset_blob = _dataset_blob(dataset)
    if len(dataset_blob) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Contrat CFD compressé trop volumineux ({len(dataset_blob)} octets; limite {MAX_UPLOAD_BYTES}).")
    client = _supabase()
    bucket = os.getenv("CFD_ARTIFACT_BUCKET", "cfd-artifacts").strip()
    if not bucket:
        raise HTTPException(status_code=503, detail="CFD_ARTIFACT_BUCKET vide; persistance désactivée.")
    storage_prefix = f"{owner_id}/{case_id}/{dataset['meshRevision']}/{analysis_id}"
    uploaded_paths: list[str] = []
    try:
        sidecar_path = f"{storage_prefix}/sidecar.json"
        client.storage.from_(bucket).upload(sidecar_path, sidecar_bytes, {"content-type": "application/json", "upsert": "false"})
        uploaded_paths.append(sidecar_path)
        for name, payload in sorted(files.items()):
            artifact_path = f"{storage_prefix}/{name}"
            client.storage.from_(bucket).upload(artifact_path, payload, {"content-type": "application/xml", "upsert": "false"})
            uploaded_paths.append(artifact_path)
        dataset_path = f"{storage_prefix}/dataset.json.gz"
        client.storage.from_(bucket).upload(dataset_path, dataset_blob, {"content-type": "application/json", "upsert": "false"})
        uploaded_paths.append(dataset_path)
        artifact_manifest["bucket"] = bucket
        artifact_manifest["storagePrefix"] = storage_prefix
        artifact_manifest["paths"] = uploaded_paths
        artifact_manifest["datasetPath"] = dataset_path
        artifact_manifest["datasetEncoding"] = "gzip+json"
        artifact_manifest["datasetBytes"] = len(dataset_blob)
    except Exception as exc:
        if uploaded_paths:
            try:
                client.storage.from_(bucket).remove(uploaded_paths)
            except Exception:
                pass
        raise HTTPException(status_code=502, detail=f"Stockage des artefacts CFD échoué; base non modifiée: {exc}") from exc
    row = {
        "id": dataset_id,
        "analysis_id": analysis_id,
        "project_id": project_id,
        "case_id": case_id,
        "owner_id": owner_id,
        "mesh_hash": mesh_hash,
        "contract_hash": _sha256(sidecar_bytes),
        "frame_hashes": frame_hashes,
        "status": status,
        "mesh_revision": dataset["meshRevision"],
        "dataset": _dataset_summary(dataset),
        "artifact_manifest": artifact_manifest,
        "created_at": _utc_now(),
    }
    try:
        response = client.table("cfd_datasets").insert(row).execute()
    except Exception as exc:
        try:
            client.storage.from_(bucket).remove(uploaded_paths)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"Persistance cfd_datasets échouée; artefacts nettoyés: {exc}") from exc
    if not getattr(response, "data", None):
        raise HTTPException(status_code=502, detail="Supabase n’a pas confirmé l’insertion de cfd_datasets.")
    return analysis_id


@router.post("/import", status_code=201)
async def import_cfd_dataset(
    vtu_files: List[UploadFile] = File(..., description="Un ou plusieurs fichiers .vtu"),
    sidecar: UploadFile = File(..., description="Sidecar JSON du contrat cfd-volume.v1"),
    case_id: str = Form(..., min_length=1, max_length=160),
    project_id: str = Form(..., min_length=1, max_length=160),
    owner_id: str = Form(..., min_length=1, max_length=160),
    analysis_id: str | None = Form(default=None, min_length=36, max_length=36),
    _auth: None = Depends(require_cfd_import_auth),
    _slot: None = Depends(require_import_slot),
) -> Dict[str, Any]:
    if not vtu_files or len(vtu_files) > MAX_FILES_PER_IMPORT:
        raise HTTPException(status_code=400, detail=f"Nombre de VTU invalide; maximum {MAX_FILES_PER_IMPORT}.")
    sidecar_name = _validate_filename(sidecar.filename, {".json"}, "sidecar")
    sidecar_bytes = await _read_limited(sidecar, "Sidecar")
    total_upload_bytes = len(sidecar_bytes)
    if total_upload_bytes > MAX_TOTAL_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Import CFD trop volumineux; limite totale {MAX_TOTAL_UPLOAD_BYTES} octets.")
    try:
        metadata = json.loads(sidecar_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail=f"Sidecar JSON invalide: {exc}") from exc
    if not isinstance(metadata, dict):
        raise HTTPException(status_code=422, detail="Sidecar JSON: objet attendu.")
    uploaded: Dict[str, bytes] = {}
    for upload in vtu_files:
        name = _validate_filename(upload.filename, _ALLOWED_VTU, "frame VTU")
        if name in uploaded:
            raise HTTPException(status_code=409, detail=f"Frame dupliquée: {name}.")
        uploaded[name] = await _read_limited(upload, f"VTU {name}")
        total_upload_bytes += len(uploaded[name])
        if total_upload_bytes > MAX_TOTAL_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"Import CFD trop volumineux; limite totale {MAX_TOTAL_UPLOAD_BYTES} octets.")
    _verify_sidecar(metadata, uploaded)
    descriptors = metadata.get("fieldDescriptors", {})
    parsed = [_parse_vtu(uploaded[name], name, descriptors) for name in [spec["file"] for spec in metadata["frames"]]]
    dataset = _build_dataset(metadata, parsed)
    _verify_project_owner(project_id, owner_id)
    _verify_analysis_owner(analysis_id, project_id, owner_id)
    analysis_id = _persist_dataset(dataset, uploaded, sidecar_bytes, case_id, project_id, owner_id, analysis_id)
    return {
        "analysisId": analysis_id,
        "datasetId": analysis_id,
        "contractVersion": dataset["contractVersion"],
        "meshRevision": dataset["meshRevision"],
        "pointCount": dataset["pointCount"],
        "cellCount": dataset["cellCount"],
        "frameCount": len(dataset["frames"]),
        "status": "STRUCTURAL_TEST_UNVALIDATED" if str(metadata.get("classification", "")).startswith("SYNTHETIC") else "UNVALIDATED",
        "projectId": project_id,
        "sidecar": sidecar_name,
        "artifactHashes": {
            "sidecar": _sha256(sidecar_bytes),
            "frames": {name: _sha256(payload) for name, payload in sorted(uploaded.items())},
        },
    }


@router.post("/import-from-storage", status_code=201)
async def import_cfd_dataset_from_storage(
    payload: Dict[str, Any],
    _auth: None = Depends(require_cfd_import_auth),
    _slot: None = Depends(require_import_slot),
) -> Dict[str, Any]:
    """Import verified VTU files that were uploaded directly to private Storage.

    This path keeps large multipart bodies out of Vercel. The browser receives
    short-lived signed upload URLs from the Next.js server, uploads each object
    directly to Supabase Storage, and this endpoint downloads the exact bytes
    server-side before applying the same hash, topology, field and provenance
    checks as the multipart endpoint.
    """
    bucket = str(payload.get("bucket", "")).strip()
    expected_bucket = os.getenv("CFD_ARTIFACT_BUCKET", "cfd-artifacts").strip()
    if not bucket or bucket != expected_bucket:
        raise HTTPException(status_code=400, detail="Bucket CFD invalide.")
    case_id = str(payload.get("case_id", "")).strip()
    project_id = str(payload.get("project_id", "")).strip()
    owner_id = str(payload.get("owner_id", "")).strip()
    analysis_id = str(payload.get("analysis_id", "")).strip() or None
    session_id = str(payload.get("session_id", "")).strip()
    if not case_id or len(case_id) > 160 or "/" in case_id or "\\" in case_id:
        raise HTTPException(status_code=422, detail="case_id invalide pour le stockage.")
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", session_id):
        raise HTTPException(status_code=422, detail="session_id doit être un UUID valide.")
    _verify_project_owner(project_id, owner_id)

    raw_files = payload.get("files")
    raw_sidecar = payload.get("sidecar")
    if not isinstance(raw_files, list) or not raw_files or not isinstance(raw_sidecar, dict):
        raise HTTPException(status_code=400, detail="files[] et sidecar sont obligatoires.")
    if len(raw_files) > MAX_FILES_PER_IMPORT:
        raise HTTPException(status_code=400, detail=f"Nombre de VTU invalide; maximum {MAX_FILES_PER_IMPORT}.")

    def storage_spec(value: Any, extension: str) -> tuple[str, str]:
        if not isinstance(value, dict):
            raise HTTPException(status_code=422, detail="Descripteur de stockage invalide.")
        name = _validate_filename(value.get("name"), {extension}, "fichier Storage")
        path = value.get("path")
        if not isinstance(path, str) or not path:
            raise HTTPException(status_code=422, detail=f"Chemin Storage absent pour {name}.")
        prefix = f"{owner_id}/{case_id}/{session_id}/"
        if path != f"{prefix}{name}":
            raise HTTPException(status_code=422, detail=f"Chemin Storage hors session pour {name}.")
        return name, path

    frame_specs = [storage_spec(value, ".vtu") for value in raw_files]
    sidecar_name, sidecar_path = storage_spec(raw_sidecar, ".json")
    if len({name for name, _ in frame_specs}) != len(frame_specs):
        raise HTTPException(status_code=409, detail="Frame dupliquée dans la session Storage.")

    client = _supabase()
    try:
        sidecar_bytes = _storage_bytes(client, bucket, sidecar_path, "sidecar")
        total_upload_bytes = len(sidecar_bytes)
        if total_upload_bytes > MAX_TOTAL_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"Import CFD trop volumineux; limite totale {MAX_TOTAL_UPLOAD_BYTES} octets.")
        uploaded: Dict[str, bytes] = {}
        for name, path in frame_specs:
            content = _storage_bytes(client, bucket, path, name)
            if len(content) > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"VTU {name} dépasse la limite CFD_IMPORT_MAX_BYTES ({MAX_UPLOAD_BYTES} octets).")
            uploaded[name] = content
            total_upload_bytes += len(content)
            if total_upload_bytes > MAX_TOTAL_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"Import CFD trop volumineux; limite totale {MAX_TOTAL_UPLOAD_BYTES} octets.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Téléchargement des artefacts Storage échoué: {exc}") from exc

    if len(sidecar_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Sidecar dépasse la limite CFD_IMPORT_MAX_BYTES ({MAX_UPLOAD_BYTES} octets).")
    try:
        metadata = json.loads(sidecar_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail=f"Sidecar JSON invalide: {exc}") from exc
    if not isinstance(metadata, dict):
        raise HTTPException(status_code=422, detail="Sidecar JSON: objet attendu.")
    _verify_sidecar(metadata, uploaded)
    descriptors = metadata.get("fieldDescriptors", {})
    parsed = [_parse_vtu(uploaded[name], name, descriptors) for name in [spec["file"] for spec in metadata["frames"]]]
    dataset = _build_dataset(metadata, parsed)
    _verify_analysis_owner(analysis_id, project_id, owner_id)
    session_paths = [sidecar_path, *[path for _, path in frame_specs]]
    try:
        analysis_id = _persist_dataset(dataset, uploaded, sidecar_bytes, case_id, project_id, owner_id, analysis_id)
    finally:
        try:
            client.storage.from_(bucket).remove(session_paths)
        except Exception:
            pass
    return {
        "analysisId": analysis_id,
        "datasetId": analysis_id,
        "contractVersion": dataset["contractVersion"],
        "meshRevision": dataset["meshRevision"],
        "pointCount": dataset["pointCount"],
        "cellCount": dataset["cellCount"],
        "frameCount": len(dataset["frames"]),
        "status": "STRUCTURAL_TEST_UNVALIDATED" if str(metadata.get("classification", "")).startswith("SYNTHETIC") else "UNVALIDATED",
        "projectId": project_id,
        "sidecar": sidecar_name,
        "artifactHashes": {
            "sidecar": _sha256(sidecar_bytes),
            "frames": {name: _sha256(content) for name, content in sorted(uploaded.items())},
        },
    }


@router.get("/project/{project_id}/latest")
def get_latest_cfd_dataset_for_project(
    project_id: str,
    owner_id: str = Query(..., min_length=36, max_length=36),
    _auth: None = Depends(require_cfd_import_auth),
) -> Dict[str, Any]:
    """Return the newest persisted CFD dataset for an owned project."""
    _verify_project_owner(project_id, owner_id)
    try:
        response = (
            _supabase()
            .table("cfd_datasets")
            .select("analysis_id,project_id,case_id,owner_id,status,dataset,artifact_manifest,created_at")
            .eq("project_id", project_id)
            .eq("owner_id", owner_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lecture du dernier dataset CFD échouée: {exc}") from exc
    if not response.data:
        return {"status": "NO_ANALYSIS", "analysis": None, "dataset": None}
    row = response.data[0]
    return {
        "status": "OK",
        "analysis": {"id": row["analysis_id"], "projectId": row["project_id"], "caseId": row["case_id"], "ownerId": row["owner_id"], "createdAt": row.get("created_at")},
        "analysisId": row["analysis_id"],
        "projectId": row["project_id"],
        "status": row["status"],
        "dataset": _load_dataset(row),
        "artifactManifest": row["artifact_manifest"],
        "createdAt": row.get("created_at"),
    }


@router.get("/{analysis_id}/gates")
def get_cfd_gates(analysis_id: str, _auth: None = Depends(require_cfd_import_auth)) -> Dict[str, Any]:
    """Expose the server-authoritative G0-G5 matrix for one persisted CFD dataset."""
    try:
        response = _supabase().table("cfd_datasets").select("analysis_id,status,dataset,artifact_manifest").eq("analysis_id", analysis_id).limit(1).execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lecture cfd_datasets échouée: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=404, detail="Dataset CFD absent.")
    row = response.data[0]
    full_dataset = _load_dataset(row)
    artifact_manifest = row.get("artifact_manifest") or {}
    report = evaluate_cfd_gates(full_dataset, artifact_manifest)
    report.update({
        "analysisId": analysis_id,
        "persistedStatus": row.get("status"),
        "evaluationSource": "persisted_storage_contract" if artifact_manifest.get("datasetPath") else "persisted_dataset_column",
        "datasetPath": artifact_manifest.get("datasetPath"),
        "summaryUsedForGateEvaluation": not bool(artifact_manifest.get("datasetPath")),
    })
    return report


@router.get("/{analysis_id}")
def get_cfd_dataset(analysis_id: str, _auth: None = Depends(require_cfd_import_auth)) -> Dict[str, Any]:
    try:
        response = _supabase().table("cfd_datasets").select("*").eq("analysis_id", analysis_id).limit(1).execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lecture cfd_datasets échouée: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=404, detail="Dataset CFD absent.")
    row = response.data[0]
    return {"analysisId": analysis_id, "status": row["status"], "dataset": _load_dataset(row), "artifactManifest": row["artifact_manifest"]}
