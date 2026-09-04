#!/usr/bin/env python3
"""Run a real SU2 case and emit immutable evidence metadata.

This script never fabricates a mesh, field, residual, convergence result or
scientific validation status. The case is mounted read-only; artifacts are
written to a separate output directory.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

CASE_ROOT = Path(os.environ.get("CASE_ROOT", "/case")).resolve()
ARTIFACT_ROOT = Path(os.environ.get("ARTIFACT_ROOT", "/artifacts")).resolve()
CONFIG_NAME = os.environ.get("SU2_CONFIG", "case.cfg")
TIMEOUT = int(os.environ.get("SU2_TIMEOUT_SECONDS", "3600"))

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def safe_relative(path: Path, root: Path) -> str:
    return str(path.resolve().relative_to(root.resolve()))

def find_output_mesh(root: Path, before: dict[str, int]) -> Path:
    candidates = []
    for pattern in ("*.vtu", "*.vtk", "*.cgns"):
        candidates.extend(root.glob(pattern))
    candidates = [
        p for p in candidates
        if p.is_file() and (str(p.relative_to(root)) not in before or p.stat().st_mtime_ns > before[str(p.relative_to(root))])
    ]
    if not candidates:
        raise RuntimeError("SU2 n'a produit aucun fichier de maillage/sortie exploitable.")
    return max(candidates, key=lambda p: p.stat().st_mtime_ns)

def parse_residuals(log: str) -> list[dict[str, float]]:
    rows = []
    for line in log.splitlines():
        numbers = re.findall(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[Ee][-+]?\d+)?", line)
        if len(numbers) >= 2 and ("RMS" in line.upper() or "RESIDUAL" in line.upper()):
            try:
                rows.append({"iteration": float(numbers[0]), "values": [float(x) for x in numbers[1:]]})
            except ValueError:
                continue
    return rows

def convert_to_vtu(source: Path, destination: Path) -> None:
    if source.suffix.lower() == ".vtu":
        shutil.copy2(source, destination)
        return
    try:
        import meshio
    except ImportError as exc:
        raise RuntimeError("meshio est requis pour convertir la sortie SU2 en VTU.") from exc
    mesh = meshio.read(source)
    meshio.write(destination, mesh, file_format="vtu")

def main() -> int:
    started = utc_now()
    config = CASE_ROOT / CONFIG_NAME
    if not config.is_file():
        raise RuntimeError(f"Configuration SU2 absente: {config}")
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    work_root = Path("/tmp/su2-case")
    if work_root.exists():
        shutil.rmtree(work_root)
    shutil.copytree(CASE_ROOT, work_root)
    before = {
        str(path.relative_to(work_root)): path.stat().st_mtime_ns
        for path in work_root.rglob("*") if path.is_file()
    }
    log_path = ARTIFACT_ROOT / "su2.log"
    command = ["SU2_CFD", CONFIG_NAME]
    env = os.environ.copy()
    env["SU2_RUN"] = str(work_root)
    completed = None
    error = None
    try:
        with log_path.open("w", encoding="utf-8") as log:
            completed = subprocess.run(command, cwd=work_root, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=TIMEOUT, check=False)
    except Exception as exc:
        error = str(exc)
    residuals = parse_residuals(log_path.read_text(encoding="utf-8", errors="replace")) if log_path.exists() else []
    output_vtu = ARTIFACT_ROOT / "su2_solution.vtu"
    output_source = None
    if completed is not None and completed.returncode == 0:
        output_source = find_output_mesh(work_root, before)
        convert_to_vtu(output_source, output_vtu)
    files = []
    for path in sorted(ARTIFACT_ROOT.rglob("*")):
        if path.is_file() and path.name != "sidecar.json":
            files.append({"path": safe_relative(path, ARTIFACT_ROOT), "sha256": sha256(path), "bytes": path.stat().st_size})
    manifest = {
        "schema": "lh2-su2-worker-manifest.v1",
        "solver": "SU2_CFD",
        "solverVersion": os.environ.get("SU2_VERSION", "UNSPECIFIED"),
        "config": CONFIG_NAME,
        "startedAt": started,
        "finishedAt": utc_now(),
        "returnCode": completed.returncode if completed is not None else None,
        "executionStatus": "COMPLETED" if completed is not None and completed.returncode == 0 else "FAILED",
        "convergence": {"residualRows": residuals, "evidencePresent": bool(residuals)},
        "outputSource": safe_relative(output_source, work_root) if output_source else None,
        "files": files,
        "scientificStatus": "UNVALIDATED",
        "validationAllowed": False,
        "error": error,
        "notes": ["A real solver output is required; no synthetic fallback exists.", "G0-G6 and independent validation remain outstanding."],
    }
    (ARTIFACT_ROOT / "sidecar.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0 if manifest["executionStatus"] == "COMPLETED" and residuals and output_vtu.exists() else 2

if __name__ == "__main__":
    raise SystemExit(main())
