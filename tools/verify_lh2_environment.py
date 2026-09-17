#!/usr/bin/env python3
"""Verify the real LH2 runner prerequisites without promoting scientific gates."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "pilot_case/PILOT-LH2-001/evidence/environment_verification.json"


def run(command: list[str], env: dict[str, str] | None = None) -> dict[str, object]:
    completed = subprocess.run(command, text=True, capture_output=True, env=env)
    return {
        "command": command,
        "returncode": completed.returncode,
        "stdout": completed.stdout[-4000:],
        "stderr": completed.stderr[-4000:],
        "pass": completed.returncode == 0,
    }


def sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    env = os.environ.copy()
    env["WM_PROJECT_DIR"] = "/usr/lib/openfoam/openfoam2512"
    env["PATH"] = "/usr/lib/openfoam/openfoam2512/platforms/linux64GccDPInt32Opt/bin:" + env.get("PATH", "")
    env["LD_LIBRARY_PATH"] = "/opt/coolprop/lib:" + env.get("LD_LIBRARY_PATH", "")

    solver = shutil.which("reactingTwoPhaseEulerFoam", path=env["PATH"])
    solver_real = str(Path(solver).resolve()) if solver else None
    results = {
        "schema": "quantum-lh2-environment.v1",
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "openfoam": {
            "package": subprocess.run(["dpkg-query", "-W", "-f=${Version}", "openfoam2512"], text=True, capture_output=True).stdout.strip(),
            "prefix": "/usr/lib/openfoam/openfoam2512",
            "solver": solver_real,
            "solverHelp": run([solver_real, "-help"], env) if solver_real else None,
        },
        "compiler": run(["g++", "--version"], env),
        "dynamicLibraries": run(["ldd", solver_real], env) if solver_real else None,
        "coolProp": {
            "nativeLibrary": "/opt/coolprop/lib/libCoolProp.so.7.2.0",
            "nativeLibrarySha256": sha256(Path("/opt/coolprop/lib/libCoolProp.so.7.2.0")),
            "pythonCheck": run(["python3", "-c", "import CoolProp; print(CoolProp.__version__)"], env),
        },
        "gates": {
            "G3": "INCONCLUSIVE",
            "G4": "INCONCLUSIVE",
            "G5": "INCONCLUSIVE",
            "reason": "Environment availability does not prove CFD convergence, independent evaluation, or held-out PINN metrics.",
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUT), "gates": results["gates"]}, indent=2))
    return 0 if solver_real and results["coolProp"]["nativeLibrarySha256"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
