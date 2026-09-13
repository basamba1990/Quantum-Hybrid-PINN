#!/usr/bin/env python3
"""Enrichit des VTU LH2 avec alpha_liquid et enthalpy, sans prétendre produire un CFD.

Les champs sont dérivés uniquement si les paramètres et leurs sources sont fournis.
Le sidecar est marqué structural/synthetic tant qu'aucun solveur validé n'a produit ces champs.
"""
from __future__ import annotations
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
import meshio
import numpy as np


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def enrich_frame(path: Path, out: Path, t_sat: float, transition_width: float, cp_liquid: float, cp_vapor: float, latent_heat: float, tref: float) -> dict:
    mesh = meshio.read(path)
    if "temperature" not in mesh.point_data:
        raise ValueError(f"{path.name}: temperature field is required")
    temperature = np.asarray(mesh.point_data["temperature"], dtype=float).reshape(-1)
    if not np.isfinite(temperature).all():
        raise ValueError(f"{path.name}: non-finite temperature")
    width = max(float(transition_width), 1e-9)
    alpha = 1.0 / (1.0 + np.exp((temperature - float(t_sat)) / width))
    cp = alpha * float(cp_liquid) + (1.0 - alpha) * float(cp_vapor)
    enthalpy = cp * (temperature - float(tref)) + alpha * float(latent_heat)
    point_data = dict(mesh.point_data)
    point_data["alpha_liquid"] = alpha.astype(np.float64)
    point_data["enthalpy"] = enthalpy.astype(np.float64)
    out.mkdir(parents=True, exist_ok=True)
    target = out / path.name
    meshio.write(target, meshio.Mesh(mesh.points, mesh.cells, point_data=point_data, cell_data=mesh.cell_data, field_data=mesh.field_data), file_format="vtu")
    return {"file": path.name, "payloadHash": sha256(target), "pointCount": int(len(mesh.points)), "cellCount": int(sum(len(c.data) for c in mesh.cells))}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--saturation-temperature-k", type=float, required=True)
    parser.add_argument("--transition-width-k", type=float, required=True)
    parser.add_argument("--cp-liquid-j-kg-k", type=float, required=True)
    parser.add_argument("--cp-vapor-j-kg-k", type=float, required=True)
    parser.add_argument("--latent-heat-j-kg", type=float, required=True)
    parser.add_argument("--reference-temperature-k", type=float, default=0.0)
    parser.add_argument("--property-source", required=True)
    args = parser.parse_args()
    frames = []
    for path in sorted(args.input.glob("frame_*.vtu")):
        frames.append(enrich_frame(path, args.output, args.saturation_temperature_k, args.transition_width_k, args.cp_liquid_j_kg_k, args.cp_vapor_j_kg_k, args.latent_heat_j_kg, args.reference_temperature_k))
    if len(frames) < 2:
        raise SystemExit("At least two VTU frames are required")
    sidecar_path = args.input / "sidecar.json"
    if not sidecar_path.exists():
        raise SystemExit("sidecar.json is required")
    sidecar = json.loads(sidecar_path.read_text())
    sidecar["derivedFieldProvenance"] = {
        "tool": "enrich_lh2_frames.py",
        "toolVersion": "1.0.0",
        "derivedAt": datetime.now(timezone.utc).isoformat(),
        "propertySource": args.property_source,
        "formula": {
            "alpha_liquid": "1 / (1 + exp((T - saturationTemperatureK) / transitionWidthK))",
            "enthalpy": "cp_mix * (T - referenceTemperatureK) + alpha_liquid * latentHeatJPerKg"
        },
        "parameters": {
            "saturationTemperatureK": args.saturation_temperature_k,
            "transitionWidthK": args.transition_width_k,
            "cpLiquidJPerKgK": args.cp_liquid_j_kg_k,
            "cpVaporJPerKgK": args.cp_vapor_j_kg_k,
            "latentHeatJPerKg": args.latent_heat_j_kg,
            "referenceTemperatureK": args.reference_temperature_k
        },
        "limitations": "Derived fields for visualization/contract testing; not solver output and not independent validation evidence."
    }
    descriptors = sidecar.setdefault("fieldDescriptors", {})
    descriptors["alpha_liquid"] = {"unit": "1", "quantity": "liquid_volume_fraction"}
    descriptors["enthalpy"] = {"unit": "J/kg", "quantity": "specific_enthalpy"}
    sidecar["physicsContract"] = {**sidecar.get("physicsContract", {}), "validated": False, "status": "DERIVED_FIELDS_NOT_CFD_SOLVER_OUTPUT"}
    sidecar["evidence"] = {**sidecar.get("evidence", {}), "fieldsAndUnits": True, "calculatedTransientStates": False}
    sidecar["frames"] = [{**frame, "fields": ["temperature", "pressure", "velocity", "alpha_liquid", "enthalpy"]} for frame in frames]
    (args.output / "sidecar.json").write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"frames": frames, "output": str(args.output), "physicsContractValidated": False}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
