#!/usr/bin/env python3
"""Orchestrateur fail-closed pour un solveur CFD externe et QuantumPINN."""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, subprocess, sys, time
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parents[1]
INGEST = HERE / "benchmark" / "scripts" / "ingest_solver_vtu.py"
VERIFY = HERE / "benchmark" / "scripts" / "verify_sidecar.py"
PREFLIGHT = HERE / "runner" / "preflight_manifest.py"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def load_config(path: Path) -> dict[str, Any]:
    cfg = json.loads(path.read_text(encoding="utf-8"))
    required = ("case_id", "project_id", "owner_id", "solver_command", "solver_output_dir", "sidecar_template")
    missing = [key for key in required if not cfg.get(key)]
    if missing:
        raise SystemExit(f"configuration incomplète: {', '.join(missing)}")
    if cfg.get("validation_allowed", False):
        raise SystemExit("refus fail-closed: validation_allowed doit rester false")
    if cfg.get("mode", "production") == "production" and not cfg.get("manifest_path"):
        raise SystemExit("production: manifest_path obligatoire pour le préflight")
    if not isinstance(cfg["solver_command"], list) or not all(isinstance(x, str) for x in cfg["solver_command"]):
        raise SystemExit("solver_command doit être une liste d'arguments, sans shell implicite")
    return cfg


def expand_command(command: list[str], case_dir: Path, output_dir: Path) -> list[str]:
    values = {"{CASE_DIR}": str(case_dir), "{OUTPUT_DIR}": str(output_dir)}
    return [next((value for key, value in values.items() if token == key), token) for token in command]


def run_solver(cfg: dict[str, Any], work: Path) -> Path:
    case_dir = Path(cfg.get("case_dir", work / "case")).resolve()
    output_dir = Path(cfg["solver_output_dir"]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    command = expand_command(cfg["solver_command"], case_dir, output_dir)
    timeout = int(cfg.get("timeout_seconds", 86400))
    started = time.time()
    print("RUN:", " ".join(command), flush=True)
    with (work / "solver.stdout.log").open("w", encoding="utf-8") as stdout, (work / "solver.stderr.log").open("w", encoding="utf-8") as stderr:
        result = subprocess.run(command, cwd=case_dir, stdout=stdout, stderr=stderr, timeout=timeout, check=False)
    if result.returncode != 0:
        raise SystemExit(f"solveur échoué avec code {result.returncode}; voir {work}/solver.stderr.log")
    vtu = sorted(output_dir.glob("*.vtu"))
    if not vtu:
        raise SystemExit("solveur terminé sans produire de VTU")
    for path in vtu:
        if path.stat().st_mtime < started:
            raise SystemExit(f"sortie VTU antérieure au run: {path}")
    print(f"solver outputs: {len(vtu)} VTU")
    return output_dir


def import_quantumpinn(cfg: dict[str, Any], artifact_dir: Path) -> None:
    url = os.getenv("QUANTUMPINN_IMPORT_URL", cfg.get("import_url", "")).strip()
    token = os.getenv("CFD_IMPORT_API_TOKEN", "").strip()
    if not url:
        print("IMPORT: skipped (QUANTUMPINN_IMPORT_URL/import_url absent)")
        return
    if not token:
        raise SystemExit("import demandé mais CFD_IMPORT_API_TOKEN absent")
    try:
        import requests
    except ImportError as exc:
        raise SystemExit("installer requests pour l'import API") from exc
    files = []
    handles = []
    try:
        for path in sorted(artifact_dir.glob("*.vtu")):
            handle = path.open("rb")
            handles.append(handle)
            files.append(("vtu_files", (path.name, handle, "application/xml")))
        sidecar = artifact_dir / "sidecar.json"
        handle = sidecar.open("rb")
        handles.append(handle)
        files.append(("sidecar", (sidecar.name, handle, "application/json")))
        data = {"case_id": cfg["case_id"], "project_id": cfg["project_id"], "owner_id": cfg["owner_id"]}
        response = requests.post(url, headers={"Authorization": f"Bearer {token}"}, data=data, files=files, timeout=int(cfg.get("import_timeout_seconds", 300)))
        print(f"IMPORT HTTP {response.status_code}: {response.text}")
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") not in ("UNVALIDATED", "STRUCTURAL_TEST_UNVALIDATED"):
            raise SystemExit(f"statut d'import inattendu: {payload.get('status')}")
    finally:
        for handle in handles:
            handle.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("config", type=Path)
    parser.add_argument("--run-dir", type=Path, default=None)
    args = parser.parse_args()
    cfg = load_config(args.config.resolve())
    run_id = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    work = (args.run_dir or Path("runs") / f"{cfg['case_id']}-{run_id}").resolve()
    work.mkdir(parents=True, exist_ok=True)
    (work / "config.snapshot.json").write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
    output = run_solver(cfg, work)
    artifact_dir = work / "artifacts"
    template = Path(cfg["sidecar_template"]).resolve()
    manifest = Path(cfg.get("manifest_path", "")).resolve() if cfg.get("manifest_path") else None
    if cfg.get("mode", "production") == "production":
        if manifest is None or not manifest.is_file():
            raise SystemExit("production: manifest_path introuvable")
        subprocess.run([sys.executable, str(PREFLIGHT), str(args.config.resolve()), str(manifest)], check=True)
    command = [sys.executable, str(INGEST), str(output), str(artifact_dir), str(template)]
    subprocess.run(command, check=True)
    subprocess.run([sys.executable, str(VERIFY), str(artifact_dir)], check=True)
    print("artifact sha256:")
    for path in sorted(artifact_dir.glob("*.vtu")) + [artifact_dir / "sidecar.json"]:
        print(path.name, sha256(path))
    import_quantumpinn(cfg, artifact_dir)
    print(f"RUN COMPLETE: {work}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
