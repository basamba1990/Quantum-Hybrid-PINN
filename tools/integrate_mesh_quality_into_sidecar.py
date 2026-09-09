#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "artifacts" / "synthetic_lh2_vtu"
SIDECAR = ROOT / "sidecar_topology_complete_model.json"
REPORT = ROOT / "mesh_quality_report.json"

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> None:
    sidecar = json.loads(SIDECAR.read_text(encoding="utf-8"))
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    report_hash = sha256(REPORT)
    mesh_hash = sha256(ROOT / "frame_0000.vtu")
    if report["meshSha256"] != mesh_hash:
        raise SystemExit("mesh quality report does not match frame_0000.vtu")
    quality = dict(report)
    quality["reportSha256"] = report_hash
    quality.pop("sourceFile", None)
    sidecar["meshQuality"] = quality
    refs = [item for item in sidecar.get("references", []) if item.get("id") != "mesh-quality-report-v1"]
    refs.append({
        "id": "mesh-quality-report-v1",
        "title": "Synthetic volumetric mesh-quality report",
        "uri": "https://example.invalid/quantum-hybrid-pinn/synthetic-mesh-quality-report-v1",
        "variables": ["mesh_quality", "cell_volume", "jacobian", "skewness"],
        "comparisonHash": report_hash,
    })
    sidecar["references"] = refs
    sidecar["meshQuality"]["meshSha256"] = mesh_hash
    sidecar["topologyEvidence"]["meshSha256"] = mesh_hash
    sidecar["provenance"]["sourceHash"] = mesh_hash
    SIDECAR.write_text(json.dumps(sidecar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"meshSha256": mesh_hash, "reportSha256": report_hash, "validated": quality["validated"], "minCellVolumeM3": quality["minCellVolumeM3"], "minJacobian": quality["minJacobian"], "maxSkewness": quality["maxSkewness"]}, indent=2))

if __name__ == "__main__":
    main()
