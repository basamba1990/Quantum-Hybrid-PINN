from pathlib import Path
import hashlib
import json
import shutil

root = Path(__file__).parents[1]
out = root / "pilot_case/PILOT-LH2-001/evidence/runtime_2026-09-15"
out.mkdir(parents=True, exist_ok=True)
source = Path("/tmp/lh2-bounded-run")
for name in ("solver.log", "log.blockMesh", "log.reactingTwoPhaseEulerFoam"):
    src = source / name
    if src.exists():
        shutil.copy2(src, out / name)

manifest = {
    "schema": "lh2-runtime-evidence.v1",
    "case": "CFD-BASELINE",
    "solver": "reactingTwoPhaseEulerFoam",
    "openfoam": "2512",
    "coolprop": "7.2.0",
    "thermoLibrary": "liblh2CoolPropThermo.so",
    "status": "INCONCLUSIVE_NOT_CONVERGED",
    "converged": False,
    "nativeFields": ["alpha_liquid", "enthalpy"],
    "phaseFieldsDerived": False,
    "lastObserved": {
        "TfGasAndLiquid": "finite through multiple PIMPLE iterations",
        "iDmdtGasAndLiquid": "finite through multiple PIMPLE iterations",
        "failure": "Maximum number of iterations exceeded in enthalpy-temperature inversion"
    },
    "files": []
}
for path in sorted(out.iterdir()):
    if path.is_file() and path.name != "manifest.json":
        manifest["files"].append({"name": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size})
(out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
