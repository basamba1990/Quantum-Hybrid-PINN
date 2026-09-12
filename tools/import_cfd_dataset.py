#!/usr/bin/env python3
"""Import exact d'un sidecar CFD et de ses frames VTU dans une analyse.

Le script appelle l'endpoint sécurisé POST /v2/cfd/import. Il ne contacte
jamais Supabase directement et n'expose donc pas SUPABASE_SERVICE_ROLE_KEY.

Exemple:
  export CFD_IMPORT_API_TOKEN='secret interservices'
  python3 tools/import_cfd_dataset.py \
    --api-base https://quantum-pinn-api-qef2.onrender.com \
    --project-id 00000000-0000-0000-0000-000000000000 \
    --owner-id 00000000-0000-0000-0000-000000000000 \
    --analysis-id 00000000-0000-0000-0000-000000000000 \
    --case-id LH2_VOF_REAL_RUN_001 \
    --sidecar /data/run/sidecar.json \
    /data/run/frame_0000.vtu /data/run/frame_0001.vtu

Le script vérifie avant l'envoi:
- les chemins et noms de fichiers sûrs;
- la correspondance exacte sidecar.frames[].file / fichiers VTU;
- les SHA-256 exacts des octets VTU;
- la présence d'un sourceHash hexadécimal réel;
- l'ordre strictement croissant des temps;
- l'existence des clés contractuelles requises.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}$")
UUID = re.compile(r"^[0-9a-fA-F-]{36}$")
SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")
REQUIRED_SIDECAR_KEYS = {"contractVersion", "meshRevision", "fieldDescriptors", "boundarySets", "provenance", "residuals", "references", "evidence", "frames"}


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Sidecar JSON illisible: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError("Le sidecar doit être un objet JSON.")
    return value


def safe_name(path: Path, label: str) -> str:
    name = path.name
    if not SAFE_NAME.fullmatch(name):
        raise ValueError(f"Nom {label} invalide ou dangereux: {name!r}")
    return name


def validate_sidecar(sidecar: dict[str, Any], files: dict[str, bytes]) -> None:
    missing = REQUIRED_SIDECAR_KEYS - set(sidecar)
    if missing:
        raise ValueError(f"Clés sidecar manquantes: {', '.join(sorted(missing))}")
    if sidecar.get("contractVersion") != "cfd-volume.v1":
        raise ValueError("contractVersion doit être cfd-volume.v1")
    frames = sidecar["frames"]
    if not isinstance(frames, list) or not frames:
        raise ValueError("frames[] doit être une liste non vide")
    declared: set[str] = set()
    times: list[float] = []
    for index, frame in enumerate(frames):
        if not isinstance(frame, dict):
            raise ValueError(f"frames[{index}] doit être un objet")
        filename = frame.get("file")
        if not isinstance(filename, str) or not SAFE_NAME.fullmatch(filename) or not filename.lower().endswith(".vtu"):
            raise ValueError(f"frames[{index}].file doit être un nom .vtu sûr")
        if filename in declared:
            raise ValueError(f"Frame dupliquée dans le sidecar: {filename}")
        declared.add(filename)
        expected = frame.get("payloadHash")
        if not isinstance(expected, str) or not SHA256.fullmatch(expected):
            raise ValueError(f"SHA-256 invalide dans frames[{index}]: {filename}")
        if filename not in files:
            raise ValueError(f"Frame déclarée mais non fournie: {filename}")
        actual = sha256_bytes(files[filename])
        if actual.lower() != expected.lower():
            raise ValueError(f"SHA-256 incorrect pour {filename}: sidecar={expected}, calculé={actual}")
        try:
            time_value = float(frame["time"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"Temps invalide dans frames[{index}]") from exc
        times.append(time_value)
    if declared != set(files):
        extra = sorted(set(files) - declared)
        raise ValueError(f"Fichiers VTU non déclarés dans le sidecar: {', '.join(extra)}")
    if any(later <= earlier for earlier, later in zip(times, times[1:])):
        raise ValueError("Les temps des frames doivent être strictement croissants")
    provenance = sidecar.get("provenance")
    if not isinstance(provenance, dict) or not SHA256.fullmatch(str(provenance.get("sourceHash", ""))):
        raise ValueError("provenance.sourceHash doit être un SHA-256 hexadécimal réel")
    if set(str(provenance["sourceHash"])) == {"0"}:
        raise ValueError("provenance.sourceHash est encore un placeholder nul")
    if not isinstance(sidecar.get("fieldDescriptors"), dict) or not sidecar["fieldDescriptors"]:
        raise ValueError("fieldDescriptors doit être non vide")
    if not isinstance(sidecar.get("boundarySets"), list) or not sidecar["boundarySets"]:
        raise ValueError("boundarySets doit être non vide")


def multipart(fields: dict[str, str], files: list[tuple[str, str, bytes, str]]) -> tuple[bytes, str]:
    boundary = "----cfd-import-" + secrets.token_hex(16)
    chunks: list[bytes] = []
    marker = boundary.encode()
    for name, value in fields.items():
        chunks.extend([b"--" + marker + b"\r\n", f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(), value.encode(), b"\r\n"])
    for field_name, filename, content, content_type in files:
        chunks.extend([
            b"--" + marker + b"\r\n",
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode(),
            f"Content-Type: {content_type}\r\n\r\n".encode(),
            content,
            b"\r\n",
        ])
    chunks.extend([b"--" + marker + b"--\r\n"])
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("vtu", nargs="+", type=Path, help="Frames VTU à importer")
    parser.add_argument("--api-base", required=True, help="Base URL du backend Render")
    parser.add_argument("--project-id", required=True, help="UUID du projet")
    parser.add_argument("--owner-id", required=True, help="UUID de l'utilisateur propriétaire")
    parser.add_argument("--analysis-id", required=True, help="UUID de l'analyse existante")
    parser.add_argument("--case-id", required=True, help="Identifiant stable du cas CFD")
    parser.add_argument("--sidecar", required=True, type=Path, help="sidecar.json correspondant exactement aux VTU")
    parser.add_argument("--token-env", default="CFD_IMPORT_API_TOKEN", help="Nom de la variable contenant le token Bearer")
    parser.add_argument("--dry-run", action="store_true", help="Valider sans envoyer de données")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    for label, value in (("project-id", args.project_id), ("owner-id", args.owner_id), ("analysis-id", args.analysis_id)):
        if not UUID.fullmatch(value):
            raise ValueError(f"{label} doit être un UUID")
    if not args.case_id.strip() or len(args.case_id) > 160:
        raise ValueError("case-id vide ou trop long")
    if args.sidecar.name != "sidecar.json":
        print(f"AVERTISSEMENT: le fichier sidecar s'appelle {args.sidecar.name!r}; le backend accepte néanmoins un .json.", file=sys.stderr)
    sidecar = read_json(args.sidecar)
    files: dict[str, bytes] = {}
    for path in args.vtu:
        name = safe_name(path, "VTU")
        if path.suffix.lower() != ".vtu":
            raise ValueError(f"Fichier non VTU: {path}")
        if name in files:
            raise ValueError(f"VTU dupliqué: {name}")
        files[name] = path.read_bytes()
    validate_sidecar(sidecar, files)
    print(f"VALIDATION OK: {len(files)} frame(s), sidecar cfd-volume.v1, hashes concordants")
    if args.dry_run:
        print("DRY RUN: aucun octet envoyé")
        return 0
    token = os.environ.get(args.token_env, "").strip()
    if not token:
        raise ValueError(f"Variable de token absente: {args.token_env}")
    fields = {
        "case_id": args.case_id,
        "project_id": args.project_id,
        "owner_id": args.owner_id,
        "analysis_id": args.analysis_id,
    }
    uploads: list[tuple[str, str, bytes, str]] = [("vtu_files", name, files[name], "application/octet-stream") for name in sorted(files)]
    uploads.append(("sidecar", args.sidecar.name, args.sidecar.read_bytes(), "application/json"))
    body, content_type = multipart(fields, uploads)
    url = args.api_base.rstrip("/") + "/v2/cfd/import"
    request = urllib.request.Request(url, data=body, method="POST", headers={"Authorization": f"Bearer {token}", "Content-Type": content_type, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = response.read().decode("utf-8", errors="replace")
            print(f"IMPORT HTTP {response.status}")
            print(result)
            return 0 if 200 <= response.status < 300 else 1
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"IMPORT HTTP {exc.code}: {detail}", file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f"IMPORT NETWORK ERROR: {exc.reason}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
