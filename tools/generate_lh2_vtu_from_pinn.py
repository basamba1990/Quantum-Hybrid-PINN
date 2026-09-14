#!/usr/bin/env python3
"""Generate fixed-topology LH2 VTU frames from the PINN batch endpoint.

The script never remeshes and never invents a topology. It reads one canonical
Gmsh mesh, queries the inference service at exactly its points for every time,
and writes the same tetra connectivity with solver fields as point_data.

Strict mode requires rho, alpha_liquid and enthalpy in the service response.
Use --derive-phase-fields only for a structural export; that output is marked
G3-ineligible because derived fields are not solver-produced evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any

import meshio
import numpy as np
import requests

REQUIRED = ("rho", "velocity", "pressure", "temperature", "alpha_liquid", "enthalpy")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def finite_array(name: str, values: Any, n: int) -> np.ndarray:
    arr = np.asarray(values, dtype=np.float64)
    if arr.ndim == 1:
        if arr.shape != (n,):
            raise ValueError(f"{name}: expected {n} scalar values, got {arr.shape}")
    elif arr.ndim == 2:
        if arr.shape[0] != n:
            raise ValueError(f"{name}: expected {n} rows, got {arr.shape}")
    else:
        raise ValueError(f"{name}: expected one- or two-dimensional values")
    if not np.isfinite(arr).all():
        raise ValueError(f"{name}: NaN or infinity found")
    return arr


def get_value(prediction: dict[str, Any], *names: str) -> Any:
    for name in names:
        if name in prediction:
            return prediction[name]
    return None


def scalar_field(predictions: list[dict[str, Any]], name: str, aliases: tuple[str, ...]) -> np.ndarray:
    values = [get_value(p, name, *aliases) for p in predictions]
    if any(v is None for v in values):
        raise ValueError(f"missing solver field {name}; accepted aliases: {aliases}")
    return finite_array(name, values, len(predictions))


def vector_field(predictions: list[dict[str, Any]], name: str) -> np.ndarray:
    vectors = []
    for p in predictions:
        direct = get_value(p, name)
        if direct is not None:
            vectors.append(direct)
        else:
            components = [get_value(p, f"velocity_{axis}", axis) for axis in "uvw"]
            if any(v is None for v in components):
                raise ValueError("missing solver field velocity; expected velocity=[u,v,w] or velocity_u/v/w")
            vectors.append(components)
    return finite_array(name, vectors, len(predictions))


def derive_phase_fields(temperature: np.ndarray, saturation: float, width: float, cp_liquid: float, cp_vapor: float, latent: float, reference: float) -> tuple[np.ndarray, np.ndarray]:
    alpha = 1.0 / (1.0 + np.exp(np.clip((temperature - saturation) / max(width, 1e-9), -700, 700)))
    cp_mix = alpha * cp_liquid + (1.0 - alpha) * cp_vapor
    enthalpy = cp_mix * (temperature - reference) + alpha * latent
    return alpha, enthalpy


def api_predict(base_url: str, times: np.ndarray, points: np.ndarray, batch_size: int, timeout: float) -> list[dict[str, Any]]:
    endpoint = base_url.rstrip("/") + "/v2/predict-batch"
    all_predictions: list[dict[str, Any]] = []
    n = len(points)
    for start in range(0, len(times) * n, batch_size):
        indices = np.arange(start, min(start + batch_size, len(times) * n))
        time_index = indices // n
        point_index = indices % n
        payload = {
            "time": times[time_index].astype(float).tolist(),
            "x": points[point_index, 0].astype(float).tolist(),
            "y": points[point_index, 1].astype(float).tolist(),
            "z": points[point_index, 2].astype(float).tolist(),
        }
        response = requests.post(endpoint, json=payload, timeout=timeout)
        response.raise_for_status()
        body = response.json()
        predictions = body.get("predictions")
        if isinstance(predictions, list):
            if len(predictions) != len(indices):
                raise RuntimeError("predict-batch returned an invalid prediction count")
            all_predictions.extend(predictions)
        else:
            # The V8 production route returns a dict of column arrays rather
            # than {"predictions": [{...}, ...]}. Normalize both contracts.
            columns = {
                key: value for key, value in body.items()
                if isinstance(value, list) and len(value) == len(indices)
            }
            if not columns:
                raise RuntimeError("predict-batch returned neither predictions[] nor column arrays")
            all_predictions.extend(
                {key: value[row] for key, value in columns.items()}
                for row in range(len(indices))
            )
    return all_predictions


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mesh", type=Path, required=True, help="canonical .msh or .vtu mesh")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--api-base-url", default=os.getenv("H2_INFERENCE_API_URL", ""))
    parser.add_argument("--times", type=float, nargs="+", required=True)
    parser.add_argument("--batch-size", type=int, default=2048)
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--mesh-revision", required=True)
    parser.add_argument("--derive-phase-fields", action="store_true")
    parser.add_argument("--saturation-temperature-k", type=float, default=20.3)
    parser.add_argument("--transition-width-k", type=float, default=0.25)
    parser.add_argument("--cp-liquid-j-kg-k", type=float, default=14300.0)
    parser.add_argument("--cp-vapor-j-kg-k", type=float, default=14300.0)
    parser.add_argument("--latent-heat-j-kg", type=float, default=445000.0)
    parser.add_argument("--reference-temperature-k", type=float, default=0.0)
    args = parser.parse_args()

    if not args.api_base_url:
        raise SystemExit("--api-base-url or H2_INFERENCE_API_URL is required")
    times = np.asarray(args.times, dtype=np.float64)
    if len(times) < 2 or not np.isfinite(times).all() or np.any(np.diff(times) <= 0):
        raise SystemExit("times must contain at least two finite strictly increasing values")
    if args.batch_size < 1:
        raise SystemExit("batch-size must be positive")

    source = meshio.read(args.mesh)
    points = np.asarray(source.points, dtype=np.float64)
    tetra_blocks = [np.asarray(block.data, dtype=np.int64) for block in source.cells if block.type == "tetra"]
    if len(tetra_blocks) != 1 or len(tetra_blocks[0]) == 0:
        raise SystemExit("canonical mesh must contain exactly one non-empty tetra block")
    tetra = tetra_blocks[0]
    if points.ndim != 2 or points.shape[1] != 3 or not np.isfinite(points).all():
        raise SystemExit("canonical mesh points must be finite Nx3")
    if tetra.min() < 0 or tetra.max() >= len(points):
        raise SystemExit("canonical tetra connectivity is out of bounds")

    predictions = api_predict(args.api_base_url, times, points, args.batch_size, args.timeout)
    expected = len(times) * len(points)
    if len(predictions) != expected:
        raise SystemExit(f"expected {expected} predictions, received {len(predictions)}")

    args.output.mkdir(parents=True, exist_ok=True)
    frame_specs = []
    phase_derived = False
    for frame_index, time_value in enumerate(times):
        batch = predictions[frame_index * len(points):(frame_index + 1) * len(points)]
        if not all(isinstance(p, dict) for p in batch):
            raise SystemExit(f"frame {frame_index}: prediction must be an object")
        rho = scalar_field(batch, "rho", ("density",))
        velocity = vector_field(batch, "velocity")
        pressure = scalar_field(batch, "pressure", ("p",))
        temperature = scalar_field(batch, "temperature", ("T",))
        alpha_values = [get_value(p, "alpha_liquid", "liquid_fraction", "phase_fraction") for p in batch]
        enthalpy_values = [get_value(p, "enthalpy", "specific_enthalpy") for p in batch]
        if any(v is None for v in alpha_values) or any(v is None for v in enthalpy_values):
            if not args.derive_phase_fields:
                raise SystemExit("solver response lacks alpha_liquid/enthalpy; rerun with a solver that emits them or explicitly use --derive-phase-fields")
            alpha, enthalpy = derive_phase_fields(temperature, args.saturation_temperature_k, args.transition_width_k, args.cp_liquid_j_kg_k, args.cp_vapor_j_kg_k, args.latent_heat_j_kg, args.reference_temperature_k)
            phase_derived = True
        else:
            alpha = finite_array("alpha_liquid", alpha_values, len(points))
            enthalpy = finite_array("enthalpy", enthalpy_values, len(points))
        if np.any(rho <= 0): raise SystemExit(f"frame {frame_index}: rho must be > 0")
        if np.any(alpha < 0) or np.any(alpha > 1): raise SystemExit(f"frame {frame_index}: alpha_liquid must be in [0,1]")
        filename = f"frame_{frame_index:04d}.vtu"
        path = args.output / filename
        meshio.write(path, meshio.Mesh(points=points, cells=[("tetra", tetra)], point_data={"rho": rho, "velocity": velocity, "pressure": pressure, "temperature": temperature, "alpha_liquid": alpha, "enthalpy": enthalpy}), file_format="vtu", binary=True)
        frame_specs.append({"frameId": f"frame_{frame_index:04d}", "time": float(time_value), "file": filename, "payloadHash": sha256(path), "fields": list(REQUIRED)})

    manifest = {"meshRevision": args.mesh_revision, "pointCount": int(len(points)), "cellCount": int(len(tetra)), "frameCount": len(frame_specs), "frames": frame_specs, "topology": {"pointsSha256": hashlib.sha256(points.tobytes()).hexdigest(), "tetraSha256": hashlib.sha256(tetra.tobytes()).hexdigest()}, "phaseFieldsDerived": phase_derived, "g3Eligible": not phase_derived, "inferenceEndpoint": args.api_base_url.rstrip("/") + "/v2/predict-batch"}
    (args.output / "generation_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
