#!/usr/bin/env python3
"""Persistent LH2 CFD worker.

The worker is intentionally conservative: it executes only a case mounted under
CASE_ROOT, writes immutable-looking evidence files under ARTIFACT_ROOT, and
never upgrades a scientific status to VALIDATED. The API/gate service remains
server-authoritative for G0-G6.
"""
from __future__ import annotations
import hashlib, json, os, re, shutil, subprocess, time
from datetime import datetime, timezone
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CASE_ROOT = Path(os.environ.get("CASE_ROOT", "/cases"))
ARTIFACT_ROOT = Path(os.environ.get("ARTIFACT_ROOT", "/artifacts"))
PORT = int(os.environ.get("PORT", "8080"))
SOLVER = os.environ.get("OPENFOAM_SOLVER", "reactingTwoPhaseEulerFoam")
TIMEOUT = int(os.environ.get("CFD_TIMEOUT_SECONDS", "3600"))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def nonfinite_markers(log: Path) -> list[str]:
    """Return solver failure markers found in a completed log.

    A zero exit code is not sufficient evidence of a valid CFD trajectory:
    OpenFOAM can flush a partial time directory after a floating-point failure.
    Keep the check conservative and report the exact markers in the manifest.
    """
    text = log.read_text(encoding="utf-8", errors="replace")
    lowered = text.lower()
    markers = []
    if re.search(r"(?<![a-z])(?:[-+]?nan(?:\([^)]*\))?|[-+]?inf(?:inity)?)(?![a-z])", lowered):
        markers.append("nonfinite_numeric_token")
    if "floating point exception" in lowered:
        markers.append("floating point exception")
    return markers


def run_job(payload: dict) -> dict:
    pilot = str(payload.get("pilotId", "PILOT-LH2-001"))
    case_name = str(payload.get("case", "CFD-BASELINE"))
    if case_name not in {"CFD-BASELINE", "CFD-INDEPENDENT"}:
        raise ValueError("case must be CFD-BASELINE or CFD-INDEPENDENT")
    source = (CASE_ROOT / pilot / "cases" / case_name).resolve()
    if CASE_ROOT.resolve() not in source.parents or not source.is_dir():
        raise ValueError("case path is outside CASE_ROOT or does not exist")
    job_id = f"{pilot}-{case_name}-{int(time.time())}"
    out = ARTIFACT_ROOT / pilot / case_name / job_id
    out.mkdir(parents=True, exist_ok=False)
    log = out / "solver.log"
    started = now()
    env = os.environ.copy()
    env["FOAM_SIGFPE"] = "true"
    env["FOAM_SETNAN"] = "true"
    command = ["bash", "-lc", f"source /opt/openfoam*/etc/bashrc 2>/dev/null || true; cd '{source}'; ./Allrun"]
    status = "FAILED"
    return_code = None
    failure_markers: list[str] = []
    try:
        with log.open("w", encoding="utf-8") as stream:
            proc = subprocess.run(command, stdout=stream, stderr=subprocess.STDOUT, env=env, timeout=TIMEOUT, check=False)
        return_code = proc.returncode
        status = "COMPLETED" if return_code == 0 else "FAILED"
        failure_markers = nonfinite_markers(log)
        if failure_markers:
            status = "FAILED_NONFINITE"
    except subprocess.TimeoutExpired:
        status = "TIMEOUT"
    files = []
    for p in sorted(out.rglob("*")):
        if p.is_file():
            files.append({"path": str(p.relative_to(out)), "sha256": sha256(p), "bytes": p.stat().st_size})
    manifest = {
        "schema": "lh2-cfd-worker-manifest.v1",
        "jobId": job_id, "pilotId": pilot, "case": case_name,
        "solver": SOLVER, "startedAt": started, "finishedAt": now(),
        "returnCode": return_code, "executionStatus": status,
        "failureMarkers": failure_markers,
        "scientificStatus": "INCONCLUSIVE",
        "validationAllowed": False,
        "command": command, "files": files,
        "notes": ["Worker execution is not equivalent to G0-G6 validation.", "NaN or non-converged output remains blocking."]
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, obj: dict):
        data = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        if self.path == "/health": self._send(200, {"status": "ok", "worker": "lh2-cfd-worker", "solver": SOLVER}); return
        self._send(404, {"error": "not_found"})
    def do_POST(self):
        if self.path != "/jobs": self._send(404, {"error": "not_found"}); return
        try:
            n = int(self.headers.get("Content-Length", "0")); payload = json.loads(self.rfile.read(n))
            self._send(202, run_job(payload))
        except Exception as exc:
            self._send(400, {"error": type(exc).__name__, "message": str(exc), "scientificStatus": "INCONCLUSIVE"})


if __name__ == "__main__":
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
