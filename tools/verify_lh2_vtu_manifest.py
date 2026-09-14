#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path
import meshio
import numpy as np

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
manifest_path = root / "generation_manifest.json"
if not manifest_path.exists():
    raise SystemExit(f"manifest absent: {manifest_path}")
manifest = json.loads(manifest_path.read_text())
assert manifest["frameCount"] == len(manifest["frames"]), "frameCount incoherent"
files = []
for spec in manifest["frames"]:
    path = root / spec["file"]
    assert path.exists(), f"frame absente: {path.name}"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == spec["payloadHash"], f"hash invalide: {path.name}"
    files.append(path)

reference = meshio.read(files[0])
ref_points = np.asarray(reference.points)
ref_blocks = [np.asarray(block.data) for block in reference.cells if block.type == "tetra"]
assert len(ref_blocks) == 1 and len(ref_blocks[0]) > 0, "référence sans bloc tetra unique"
ref_tetra = ref_blocks[0]
assert len(ref_points) == manifest["pointCount"], "pointCount manifeste incohérent"
assert len(ref_tetra) == manifest["cellCount"], "cellCount manifeste incohérent"
required = {"rho", "velocity", "pressure", "temperature", "alpha_liquid", "enthalpy"}
for path in files:
    mesh = meshio.read(path)
    blocks = [np.asarray(block.data) for block in mesh.cells if block.type == "tetra"]
    assert len(blocks) == 1, f"{path.name}: bloc tetra absent ou multiple"
    assert np.array_equal(mesh.points, ref_points), f"{path.name}: points différents"
    assert np.array_equal(blocks[0], ref_tetra), f"{path.name}: connectivité tetra différente"
    assert required.issubset(mesh.point_data.keys()), f"{path.name}: champs manquants"
    for name in required:
        values = np.asarray(mesh.point_data[name])
        assert np.isfinite(values).all(), f"{path.name}: NaN/inf dans {name}"
    rho = np.asarray(mesh.point_data["rho"])
    alpha = np.asarray(mesh.point_data["alpha_liquid"])
    assert np.all(rho > 0), f"{path.name}: rho non positive"
    assert np.all((alpha >= 0) & (alpha <= 1)), f"{path.name}: alpha hors [0,1]"
    print(f"{path.name}: hash OK, {len(mesh.points)} points, {len(blocks[0])} tetra, topologie OK")
print(json.dumps({"manifest": str(manifest_path), "frames": len(files), "hashes": "OK", "tetraTopology": "OK", "g3Eligible": manifest.get("g3Eligible"), "phaseFieldsDerived": manifest.get("phaseFieldsDerived")}, indent=2))
