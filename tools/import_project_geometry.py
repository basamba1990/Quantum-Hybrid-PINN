#!/usr/bin/env python3
"""Importe une géométrie CAO/maillage et crée sa liaison project_id -> géométrie.

Usage:
  python3 tools/import_project_geometry.py \
    --project-id <UUID> --owner-id <AUTH_UUID> --article-key <key> \
    --source-uri <URL-ou-URN> --geometry path/to/model.step

Le script n'invente jamais de CAO : il exige un fichier local fourni par
l'utilisateur, calcule son SHA-256, l'envoie dans le bucket privé Supabase et
crée/actualise une liaison ACTIVE. Le fichier STEP est stocké tel quel ; le
STL/VTU peut ensuite être maillé par le solveur CFD choisi.
"""
from __future__ import annotations
import argparse
import hashlib
import mimetypes
import os
import re
import sys
from pathlib import Path
from uuid import UUID

ALLOWED = {".step": "cad", ".stp": "cad", ".stl": "mesh", ".msh": "mesh", ".vtu": "cfd-volume"}
MAX_BYTES = 250 * 1024 * 1024
SHA256 = re.compile(r"^[0-9a-f]{64}$")


def die(message: str) -> None:
    raise SystemExit(f"ERROR: {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--owner-id", required=True)
    parser.add_argument("--article-key", required=True)
    parser.add_argument("--source-uri", required=True)
    parser.add_argument("--geometry", required=True, type=Path)
    parser.add_argument("--mesh-revision", default=None)
    parser.add_argument("--bucket", default=os.getenv("GEOMETRY_ARTIFACT_BUCKET", "geometry-artifacts"))
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        project_id, owner_id = str(UUID(args.project_id)), str(UUID(args.owner_id))
    except ValueError:
        die("project-id et owner-id doivent être des UUID.")
    path = args.geometry.expanduser().resolve()
    if not path.is_file(): die(f"fichier absent: {path}")
    suffix = path.suffix.lower()
    if suffix not in ALLOWED: die(f"extension refusée: {suffix}; extensions: {', '.join(ALLOWED)}")
    size = path.stat().st_size
    if size <= 0 or size > MAX_BYTES: die("taille hors limites (1 octet à 250 MiB).")
    payload = path.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    article_key = re.sub(r"[^A-Za-z0-9_.-]+", "-", args.article_key).strip("-")
    revision = args.mesh_revision or f"{article_key}-{digest[:12]}"
    if len(revision) > 240: die("mesh-revision trop longue.")
    geometry_kind = ALLOWED[suffix]
    storage_path = f"{owner_id}/{project_id}/{article_key}/{revision}/{path.name}"
    result = {
        "project_id": project_id, "owner_id": owner_id, "article_key": article_key,
        "geometry_kind": geometry_kind, "geometry_path": storage_path,
        "mesh_revision": revision, "geometry_sha256": digest,
        "source_uri": args.source_uri, "status": "ACTIVE", "bytes": size,
    }
    if args.dry_run:
        print(result)
        return 0
    try:
        from supabase import create_client
    except ImportError as exc:
        die(f"client Supabase Python absent; installez supabase-py pour un import réel: {exc}")
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key: die("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis côté serveur.")
    client = create_client(url, key)
    project = client.table("projects").select("id,user_id").eq("id", project_id).eq("user_id", owner_id).limit(1).execute()
    if not getattr(project, "data", None): die("project_id absent ou non détenu par owner_id.")
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    client.storage.from_(args.bucket).upload(storage_path, payload, {"content-type": content_type, "upsert": "true"})
    client.table("project_geometry_bindings").upsert(result, on_conflict="project_id").execute()
    print(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
