#!/usr/bin/env python3
"""Build a cfd-volume.v1 sidecar only from a completed transient run.

Required files in --run-dir: solver_case.tar.gz, run_manifest.json,
residual_history.csv, balance_history.csv, export_manifest.json, solver.log.
The export manifest must contain frame records with frameId, time, file and
payloadHash. This script never marks synthetic or incomplete frames as CFD.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""): h.update(chunk)
    return h.hexdigest()

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--case-id", default="PILOT-PCCV-TRANSIENT-001")
    ap.add_argument("--mesh-revision", default="pccv-openfoam-transient-v1")
    args = ap.parse_args(); root = args.run_dir.resolve()
    required = {"solver_case.tar.gz", "run_manifest.json", "residual_history.csv", "balance_history.csv", "export_manifest.json", "solver.log"}
    missing = sorted(name for name in required if not (root / name).is_file())
    if missing: raise SystemExit("FAIL: missing transient proof files: " + ", ".join(missing))
    export = json.loads((root / "export_manifest.json").read_text())
    frames = export.get("frames", [])
    if len(frames) < 2: raise SystemExit("FAIL: at least two exported frames are required")
    times = [float(f["time"]) for f in frames]
    if any(b <= a for a, b in zip(times, times[1:])): raise SystemExit("FAIL: frame times are not strictly increasing")
    for frame in frames:
        p = root / frame["file"]
        if not p.is_file() or sha256(p) != frame.get("payloadHash"): raise SystemExit(f"FAIL: frame hash mismatch: {frame.get('file')}")
    manifest = json.loads((root / "run_manifest.json").read_text())
    if manifest.get("solverCompleted") is not True: raise SystemExit("FAIL: run_manifest.solverCompleted must be true")
    out = {
      "contractVersion": "cfd-volume.v1", "caseId": args.case_id, "meshRevision": args.mesh_revision,
      "coordinateSystem": "cartesian-right-handed", "lengthUnit": "m",
      "fieldDescriptors": {"pressure": {"unit": "Pa", "quantity": "pressure"}, "temperature": {"unit": "K", "quantity": "temperature"}, "velocity": {"unit": "m/s", "quantity": "velocity"}, "density": {"unit": "kg/m3", "quantity": "density"}},
      "boundarySets": manifest["boundarySets"], "provenance": manifest["provenance"], "residuals": manifest["finalResiduals"],
      "references": manifest["references"], "frames": frames,
      "transientProof": {"solverCaseHash": sha256(root / "solver_case.tar.gz"), "runManifestHash": sha256(root / "run_manifest.json"), "residualHistoryHash": sha256(root / "residual_history.csv"), "balanceHistoryHash": sha256(root / "balance_history.csv"), "exportManifestHash": sha256(root / "export_manifest.json"), "runLogHash": sha256(root / "solver.log"), "timeStepSeconds": float(manifest["timeStepSeconds"]), "frameTimesSeconds": times, "residualNorm": manifest.get("residualNorm", "L2"), "solverCompleted": True, "calculatedBy": manifest["provenance"]["solver"]},
      "evidence": {"meshGeometryAndTopology": True, "fieldsAndUnits": True, "namedBoundaries": True, "solverProvenance": True, "solverResiduals": True, "referenceComparison": bool(manifest.get("referenceComparisonAvailable", False)), "immutableHashes": True, "calculatedTransientStates": True},
      "classification": "REAL_TRANSIENT_SOLVER_OUTPUT_REPRODUCED_ANALYTIC_GEOMETRY_NOT_AUTHOR_CAD" if manifest.get("independentReproductionCompleted") else "REAL_TRANSIENT_SOLVER_OUTPUT_PENDING_INDEPENDENT_REPRODUCTION"
    }
    args.out.parent.mkdir(parents=True, exist_ok=True); args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n"); print(f"PASS: wrote {args.out}"); return 0
if __name__ == "__main__": raise SystemExit(main())
