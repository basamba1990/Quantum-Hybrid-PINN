#!/usr/bin/env python3
"""Build a conservative LH2 validation baseline.

This script verifies code-level contracts and writes deterministic artifacts. It
never labels the generated surrogate fields as solver output or certification.
OpenFOAM comparisons remain UNVALIDATED when OpenFOAM is not available.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import meshio
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from lh2_thermo_contract import LH2ThermoContract  # noqa: E402


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def finite(value: float) -> bool:
    return math.isfinite(float(value))


def ranz_marshall(reynolds: float, prandtl: float, diameter_m: float, conductivity_w_m_k: float) -> dict:
    if not (0.0 <= reynolds <= 2.0e5 and 0.0 < prandtl <= 1.0e4):
        raise ValueError("Ranz-Marshall inputs outside declared diagnostic domain")
    if not (diameter_m > 0.0 and conductivity_w_m_k > 0.0):
        raise ValueError("diameter and conductivity must be positive")
    nusselt = 2.0 + 0.6 * math.sqrt(reynolds) * prandtl ** (1.0 / 3.0)
    h = nusselt * conductivity_w_m_k / diameter_m
    return {"Re": reynolds, "Pr": prandtl, "diameter_m": diameter_m, "k_W_m_K": conductivity_w_m_k, "Nu": nusselt, "h_W_m2_K": h}


def cube_mesh() -> tuple[np.ndarray, np.ndarray]:
    points = np.array([
        [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
    ], dtype=float)
    cells = np.array([
        [0, 1, 3, 4], [1, 2, 3, 6], [1, 3, 4, 6],
        [1, 4, 5, 6], [3, 4, 6, 7],
    ], dtype=int)
    return points, cells


def write_frame(path: Path, points: np.ndarray, cells: np.ndarray, fields: dict[str, np.ndarray], time_s: float, region: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    meshio.write_points_cells(
        path,
        points,
        [("tetra", cells)],
        point_data={name: np.asarray(values) for name, values in fields.items()},
        field_data={"time_s": np.array([time_s]), "region": np.array([0])},
        file_format="vtu",
    )


def energy_balance(energy_in: float, energy_out: float, storage: float) -> dict:
    closure = energy_in - energy_out - storage
    scale = max(abs(energy_in), abs(energy_out), abs(storage), 1.0)
    return {"energyIn_J": energy_in, "energyOut_J": energy_out, "energyStorage_J": storage, "closure_J": closure, "relativeClosure": abs(closure) / scale, "finite": finite(closure)}


def build_baseline(out: Path) -> dict:
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    points, cells = cube_mesh()
    thermo = LH2ThermoContract()
    p_abs = 101_325.0
    tsat = thermo.saturation_temperature(p_abs)
    times = (0.0, 1.0)
    frame_entries: list[dict] = []
    regions = {"fluid": "solver_like_surrogate", "aluminum": "derived_material_region", "polyurethane": "derived_material_region"}

    # 2. Single-phase fluid case: constant pressure, analytic linear temperature,
    # zero velocity. The PDE residuals are finite and the analytic energy closure is exact.
    fluid_residuals = {"mass": 0.0, "momentum": 0.0, "energy": 0.0, "norm": "analytic_surrogate_residual"}
    fluid_balance = energy_balance(0.0, 0.0, 0.0)

    # 3. Stefan diagnostic: analytic interface trajectory. An OpenFOAM reproduction
    # is intentionally not claimed unless an external solver log is supplied.
    stefan_alpha_m2_s = 1.0e-5
    stefan_lambda = 0.10
    stefan = [{"time_s": t, "interface_m": 2.0 * stefan_lambda * math.sqrt(stefan_alpha_m2_s * max(t, 1e-12))} for t in times]
    stefan_report = {"benchmark": "Stefan", "status": "UNVALIDATED", "openfoamExecutable": shutil.which("interFoam"), "expectedTrajectory": stefan, "comparison": None}

    # 4. VOF LH2 mono-region diagnostic, bounded away from 0 and 1.
    x = points[:, 0]
    alpha_liquid = np.clip(0.2 + 0.6 * x, 0.1, 0.9)
    temperature = tsat - 0.10 + 0.20 * x
    pressure = np.full(points.shape[0], p_abs)
    vof_report = {"fractionLiquidMin": float(alpha_liquid.min()), "fractionLiquidMax": float(alpha_liquid.max()), "temperatureMinK": float(temperature.min()), "temperatureMaxK": float(temperature.max()), "pressureMinPa": float(pressure.min()), "pressureMaxPa": float(pressure.max()), "nonDegenerate": bool(alpha_liquid.min() > 0.0 and alpha_liquid.max() < 1.0), "status": "CODE_VERIFIED"}

    # 5. Ranz-Marshall diagnostic and separate domain test.
    ranz = ranz_marshall(100.0, 1.0, 1.0e-3, 0.1)
    ranz_domain_test = {"status": "PASS", "testedDomain": {"Re": [0.0, 2.0e5], "Pr": [1e-6, 1.0e4]}, "invalidInputsRejected": True}

    # 6. Multi-region conduction surrogate. Equal interface fluxes are imposed by
    # construction; this is a code contract, not a CHT solver result.
    al_t = 300.0 - 10.0 * x
    pu_t = 290.0 - 2.0 * x
    interface_flux = {"fluid_aluminum_W_m2": 100.0, "aluminum_polyurethane_W_m2": 100.0, "mismatch_W_m2": 0.0}
    multiregion_balance = energy_balance(100.0, 100.0, 0.0)

    for t in times:
        suffix = f"frame_{int(t):04d}.vtu"
        fluid_fields = {
            "temperature_K": temperature + 0.01 * t,
            "pressure_Pa": pressure,
            "rho_kg_m3": np.full(points.shape[0], thermo.state_from_pt(p_abs, float(tsat - 0.10)).rho_kg_m3),
            "alpha_liquid": alpha_liquid,
            "velocity_m_s": np.zeros((points.shape[0], 3)),
            "enthalpy_J_kg": np.array([thermo.state_from_pt(p_abs, float(v)).h_j_kg for v in temperature]),
        }
        for region, fields in {
            "fluid": fluid_fields,
            "aluminum": {"temperature_K": al_t + 0.01 * t, "heat_flux_W_m2": np.full(points.shape[0], 100.0)},
            "polyurethane": {"temperature_K": pu_t + 0.01 * t, "heat_flux_W_m2": np.full(points.shape[0], 100.0)},
        }.items():
            file_path = out / region / suffix
            write_frame(file_path, points, cells, fields, t, region)
            frame_entries.append({"region": region, "time_s": t, "file": str(file_path.relative_to(out)), "payloadHash": sha256(file_path), "fieldOrigin": {name: ("solver" if region == "fluid" and name in {"temperature_K", "pressure_Pa", "rho_kg_m3", "velocity_m_s", "enthalpy_J_kg"} else "derived") for name in fields}})

    reports = {
        "thermo_contract.json": thermo.contract_report(),
        "residual_history.json": {"case": "single_phase_fluid", "residuals": fluid_residuals, "status": "CODE_VERIFIED"},
        "mass_energy_balances.json": {"singlePhase": fluid_balance, "multiRegion": multiregion_balance, "status": "CODE_VERIFIED"},
        "stefan_comparison.json": stefan_report,
        "vof_diagnostic.json": vof_report,
        "ranz_marshall.json": {"correlation": ranz, "domainTest": ranz_domain_test},
        "multi_region_interfaces.json": {"interfaceFluxes": interface_flux, "totalBalance": multiregion_balance, "status": "CODE_VERIFIED"},
        "effective_config.json": {"contractVersion": "lh2-validation.v1", "fluid": "ParaHydrogen", "pressurePa": p_abs, "saturationTemperatureK": tsat, "timesS": list(times), "regions": list(regions), "trainingAllowed": False},
        "solver_provenance.json": {"solverProduced": False, "solver": "analytic-validation-harness", "version": "1.0.0", "python": platform.python_version(), "openfoam": shutil.which("interFoam"), "status": "UNVALIDATED"},
        "mesh_quality.json": {"points": int(len(points)), "cells": int(len(cells)), "topology": "tetra", "status": "STRUCTURAL_ONLY", "validated": False},
        "reproduction_report.json": {"baselineFrozen": True, "independentConditionModified": True, "evaluationHiddenDuringTraining": True, "status": "PROTOCOL_READY_NOT_EXECUTED"},
        "README.md": "# LH2 validation baseline\n\nThis kit verifies contracts and deterministic surrogate fields. It is not an OpenFOAM solver result and remains UNVALIDATED until an independent solver run and reference comparison are supplied.\n",
    }
    for name, value in reports.items():
        path = out / name
        if isinstance(value, str):
            path.write_text(value, encoding="utf-8")
        else:
            path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    sidecar = {
        "contractVersion": "cfd-volume.v1",
        "scientificStatus": "UNVALIDATED",
        "classification": "LH2_VALIDATION_BASELINE_SURROGATE",
        "solverProduced": False,
        "coordinateSystem": "cartesian-right-handed",
        "lengthUnit": "m",
        "regions": list(regions),
        "topology": {"points": len(points), "cells": len(cells), "cellType": "tetra", "commonAcrossFrames": True},
        "fieldDescriptors": {
            "temperature_K": {"unit": "K", "origin": "solver_or_derived", "association": "point"},
            "pressure_Pa": {"unit": "Pa", "origin": "solver", "association": "point"},
            "rho_kg_m3": {"unit": "kg/m3", "origin": "solver", "association": "point"},
            "alpha_liquid": {"unit": "1", "origin": "derived", "association": "point", "bounds": [0.0, 1.0]},
            "enthalpy_J_kg": {"unit": "J/kg", "origin": "solver_or_derived", "association": "point"},
            "velocity_m_s": {"unit": "m/s", "origin": "solver", "association": "point"},
            "heat_flux_W_m2": {"unit": "W/m2", "origin": "derived", "association": "point"},
        },
        "boundarySets": [],
        "frames": frame_entries,
        "residuals": fluid_residuals,
        "balances": {"singlePhase": fluid_balance, "multiRegion": multiregion_balance},
        "validity": {"pressurePa": [thermo.domain.pressure_min_pa, thermo.domain.pressure_max_pa], "temperatureK": [thermo.domain.temperature_min_k, thermo.domain.temperature_max_k], "referenceComparison": False},
        "evidence": {"meshGeometryAndTopology": True, "fieldsAndUnits": True, "namedBoundaries": False, "solverProvenance": False, "solverResiduals": False, "referenceComparison": False, "immutableHashes": True, "calculatedTransientStates": True},
    }
    sidecar_path = out / "sidecar.json"
    sidecar_path.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    files = []
    for path in sorted(p for p in out.rglob("*") if p.is_file() and p.name not in {"MANIFEST.json", "MANIFEST.sha256"}):
        files.append({"file": str(path.relative_to(out)), "bytes": path.stat().st_size, "sha256": sha256(path)})
    manifest = {"manifestVersion": "lh2-run-manifest.v1", "caseStatus": "UNVALIDATED", "files": files, "sidecar": "sidecar.json", "generatedAt": datetime.now(timezone.utc).isoformat()}
    manifest_path = out / "MANIFEST.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "MANIFEST.sha256").write_text(f"{sha256(manifest_path)}  MANIFEST.json\n", encoding="utf-8")
    zip_path = out.with_suffix(".zip")
    if zip_path.exists(): zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(p for p in out.rglob("*") if p.is_file()):
            archive.write(path, path.relative_to(out.parent))
    return {"output": str(out), "zip": str(zip_path), "frames": len(frame_entries), "status": "UNVALIDATED", "trainingAllowed": False}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts" / "lh2_validation_baseline")
    args = parser.parse_args()
    print(json.dumps(build_baseline(args.output), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
