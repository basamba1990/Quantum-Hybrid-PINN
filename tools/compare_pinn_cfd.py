#!/usr/bin/env python3
"""Compare PINN fields against an independent CFD reference.

The script is intentionally conservative: it never declares VALIDATED unless
explicit acceptance tolerances and all required checks are explicitly passed.
Input tables use SI-labelled column names from the LH2 validation protocol.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    from scipy.spatial import cKDTree
except ImportError:  # pragma: no cover
    cKDTree = None

COORDS = ("x_m", "y_m", "z_m")
DEFAULT_FIELDS = (
    "pressure_Pa",
    "temperature_K",
    "velocity_magnitude_m_s",
    "material_stress_Pa",
)


@dataclass(frozen=True)
class MatchResult:
    cfd: pd.DataFrame
    pinn: pd.DataFrame
    distances_m: np.ndarray


def read_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    if path.suffix.lower() in {".json"}:
        return pd.read_json(path)
    return pd.read_csv(path)


def load_json(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def fail(message: str) -> None:
    raise ValueError(message)


def require_columns(frame: pd.DataFrame, names: list[str], label: str) -> None:
    missing = [name for name in names if name not in frame.columns]
    if missing:
        fail(f"{label}: colonnes manquantes: {', '.join(missing)}")


def validate_metadata(metadata: dict[str, Any], cfd: pd.DataFrame, pinn: pd.DataFrame) -> None:
    if metadata.get("coordinate_system") != "Cartesian SI":
        fail("coordinate_system doit être exactement 'Cartesian SI'.")
    units = metadata.get("units", {})
    for name in COORDS:
        if units.get(name) != "m":
            fail(f"Unité absente ou non-SI pour {name}: attendu m.")
    if metadata.get("comparison_split") != "TEST_HOLDOUT":
        fail("La comparaison finale doit utiliser comparison_split=TEST_HOLDOUT.")
    for label, frame in (("CFD", cfd), ("PINN", pinn)):
        if "split" not in frame.columns:
            fail(f"{label}: la colonne split est obligatoire.")
        splits = set(frame["split"].dropna().astype(str).unique())
        if splits != {"TEST_HOLDOUT"}:
            fail(f"{label}: le fichier doit contenir uniquement TEST_HOLDOUT, obtenu {sorted(splits)}.")


def validate_finite(frame: pd.DataFrame, columns: list[str], label: str) -> None:
    for column in columns:
        if not np.isfinite(pd.to_numeric(frame[column], errors="coerce")).all():
            fail(f"{label}: valeurs non finies dans {column}.")


def align_nearest(cfd: pd.DataFrame, pinn: pd.DataFrame, tolerance_m: float) -> MatchResult:
    cfd_points = cfd.loc[:, COORDS].to_numpy(dtype=float)
    pinn_points = pinn.loc[:, COORDS].to_numpy(dtype=float)
    if len(cfd_points) == 0 or len(pinn_points) == 0:
        fail("Aucun point CFD ou PINN à aligner.")
    if cKDTree is not None:
        tree = cKDTree(cfd_points)
        distances, indices = tree.query(pinn_points, k=1)
    else:
        # Fallback NumPy par blocs : évite de construire une matrice N×M complète.
        distances = np.empty(len(pinn_points), dtype=float)
        indices = np.empty(len(pinn_points), dtype=int)
        for start in range(0, len(pinn_points), 4096):
            stop = min(start + 4096, len(pinn_points))
            delta = pinn_points[start:stop, None, :] - cfd_points[None, :, :]
            squared = np.einsum("ijk,ijk->ij", delta, delta)
            nearest = np.argmin(squared, axis=1)
            indices[start:stop] = nearest
            distances[start:stop] = np.sqrt(squared[np.arange(stop - start), nearest])
    if float(np.max(distances)) > tolerance_m:
        fail(
            "Alignement spatial refusé: distance maximale "
            f"{float(np.max(distances)):.6g} m > tolérance {tolerance_m:.6g} m."
        )
    matched_cfd = cfd.iloc[indices].reset_index(drop=True)
    matched_pinn = pinn.reset_index(drop=True)
    return MatchResult(matched_cfd, matched_pinn, distances)


def metric_values(reference: np.ndarray, prediction: np.ndarray) -> dict[str, float]:
    error = prediction - reference
    denominator = max(float(np.linalg.norm(reference)), np.finfo(float).eps)
    return {
        "n": int(reference.size),
        "mae": float(np.mean(np.abs(error))),
        "rmse": float(np.sqrt(np.mean(error**2))),
        "relative_l2": float(np.linalg.norm(error) / denominator),
        "bias": float(np.mean(error)),
        "reference_min": float(np.min(reference)),
        "reference_max": float(np.max(reference)),
        "prediction_min": float(np.min(prediction)),
        "prediction_max": float(np.max(prediction)),
    }


def metrics_by_region(match: MatchResult, field: str, config: dict[str, Any]) -> dict[str, Any]:
    reference = pd.to_numeric(match.cfd[field], errors="coerce").to_numpy(float)
    prediction = pd.to_numeric(match.pinn[field], errors="coerce").to_numpy(float)
    result: dict[str, Any] = {"global": metric_values(reference, prediction)}
    leak = config.get("leak_region")
    if leak:
        position = np.asarray(leak.get("position_m", []), dtype=float)
        radius = float(leak.get("radius_m", 0.0))
        if position.shape != (3,) or radius <= 0:
            fail("leak_region doit fournir position_m=[x,y,z] et radius_m>0.")
        points = match.pinn.loc[:, COORDS].to_numpy(float)
        mask = np.linalg.norm(points - position, axis=1) <= radius
        if not bool(np.any(mask)):
            fail("La région de fuite ne contient aucun point PINN.")
        result["leak_region"] = {"radius_m": radius, "n": int(mask.sum()), **metric_values(reference[mask], prediction[mask])}
    return result


def optional_integrated_checks(match: MatchResult, config: dict[str, Any]) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    requested = config.get("integrated_quantities", {})
    for name, specification in requested.items():
        cfd_column = specification.get("cfd_column", name)
        pinn_column = specification.get("pinn_column", name)
        if cfd_column not in match.cfd or pinn_column not in match.pinn:
            checks[name] = {"status": "N/D", "reason": "column_missing"}
            continue
        cfd_value = float(pd.to_numeric(match.cfd[cfd_column], errors="coerce").mean())
        pinn_value = float(pd.to_numeric(match.pinn[pinn_column], errors="coerce").mean())
        checks[name] = {"status": "COMPUTED", "cfd_mean": cfd_value, "pinn_mean": pinn_value, **metric_values(np.array([cfd_value]), np.array([pinn_value]))}
    return checks


def evaluate_uncertainty(match: MatchResult, fields: list[str], config: dict[str, Any]) -> dict[str, Any]:
    mapping = config.get("uncertainty_columns", {})
    coverage_min = config.get("uncertainty_coverage_min")
    if not mapping or coverage_min is None:
        return {"status": "NOT_ASSESSED", "reason": "Uncertainty columns and uncertainty_coverage_min are required."}
    z_score = float(config.get("uncertainty_z_score", 1.96))
    per_field: dict[str, Any] = {}
    for field in fields:
        std_column = mapping.get(field)
        if not std_column or std_column not in match.pinn.columns:
            per_field[field] = {"status": "NOT_ASSESSED", "reason": "uncertainty column missing"}
            continue
        reference = pd.to_numeric(match.cfd[field], errors="coerce").to_numpy(float)
        prediction = pd.to_numeric(match.pinn[field], errors="coerce").to_numpy(float)
        std = pd.to_numeric(match.pinn[std_column], errors="coerce").to_numpy(float)
        if not np.isfinite(std).all() or np.any(std < 0):
            fail(f"PINN: incertitude invalide dans {std_column}.")
        covered = np.abs(reference - prediction) <= z_score * std
        coverage = float(np.mean(covered))
        per_field[field] = {"status": "PASS" if coverage >= float(coverage_min) else "FAIL", "coverage": coverage, "coverage_min": float(coverage_min), "z_score": z_score, "n": int(len(covered))}
    assessed = [item for item in per_field.values() if item["status"] in {"PASS", "FAIL"}]
    if not assessed:
        return {"status": "NOT_ASSESSED", "fields": per_field}
    return {"status": "PASS" if all(item["status"] == "PASS" for item in assessed) else "FAIL", "fields": per_field}


def evaluate_tolerances(metrics: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    tolerances = config.get("tolerances", {})
    if not tolerances:
        return {"status": "NOT_ASSESSED", "reason": "No acceptance tolerances supplied."}
    field_results: dict[str, Any] = {}
    for field, field_metrics in metrics.items():
        limit = tolerances.get(field)
        if not limit:
            field_results[field] = {"status": "NOT_ASSESSED", "reason": "No tolerance for field."}
            continue
        checks = {
            "relative_l2": field_metrics["global"]["relative_l2"] <= float(limit["relative_l2_max"]),
            "rmse": field_metrics["global"]["rmse"] <= float(limit["rmse_max"]),
        }
        field_results[field] = {"status": "PASS" if all(checks.values()) else "FAIL", "checks": checks, "limits": limit}
    assessed = [item for item in field_results.values() if item["status"] in {"PASS", "FAIL"}]
    if not assessed:
        return {"status": "NOT_ASSESSED", "fields": field_results}
    return {"status": "PASS" if all(item["status"] == "PASS" for item in assessed) else "FAIL", "fields": field_results}


def build_report(payload: dict[str, Any]) -> str:
    lines = [
        "# Rapport de comparaison CFD–PINN",
        "",
        f"- Statut: **{payload['status']}**",
        f"- Jeu comparé: `{payload['comparison_split']}`",
        f"- Points CFD: {payload['n_cfd']}",
        f"- Points PINN: {payload['n_pinn']}",
        f"- Distance maximale d’alignement: {payload['alignment']['max_distance_m']:.6g} m",
        "",
        "## Métriques par champ",
        "",
        "| Champ | Région | N | MAE | RMSE | Relative L2 | Biais |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for field, regions in payload["metrics"].items():
        for region, values in regions.items():
            if not isinstance(values, dict) or "mae" not in values:
                continue
            lines.append(f"| `{field}` | `{region}` | {values['n']} | {values['mae']:.6g} | {values['rmse']:.6g} | {values['relative_l2']:.6g} | {values['bias']:.6g} |")
    lines += ["", "## Contrôles", "", "```json", json.dumps(payload["checks"], indent=2, ensure_ascii=False), "```", "", "## Limites", "", "Ce rapport ne constitue pas une certification industrielle. Une validation exige des tolérances approuvées, une référence CFD indépendante, des bilans physiques et une quantification d’incertitude."]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cfd", required=True, type=Path)
    parser.add_argument("--pinn", required=True, type=Path)
    parser.add_argument("--metadata", required=True, type=Path)
    parser.add_argument("--config", type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--match-tolerance-m", type=float, default=None)
    parser.add_argument("--fields", nargs="+", default=list(DEFAULT_FIELDS))
    args = parser.parse_args()

    metadata = load_json(args.metadata)
    config = load_json(args.config)
    tolerance_m = args.match_tolerance_m if args.match_tolerance_m is not None else float(config.get("match_tolerance_m", 1e-4))
    if tolerance_m <= 0:
        fail("match-tolerance-m doit être strictement positif.")

    cfd = read_table(args.cfd)
    pinn = read_table(args.pinn)
    require_columns(cfd, [*COORDS, "split"], "CFD")
    require_columns(pinn, [*COORDS, "split"], "PINN")
    validate_metadata(metadata, cfd, pinn)
    fields = [field for field in args.fields if field in cfd.columns and field in pinn.columns]
    if not fields:
        fail("Aucun champ commun CFD/PINN à comparer.")
    validate_finite(cfd, list(COORDS), "CFD")
    validate_finite(pinn, list(COORDS), "PINN")
    for field in fields:
        validate_finite(cfd, [field], "CFD")
        validate_finite(pinn, [field], "PINN")

    match = align_nearest(cfd, pinn, tolerance_m)
    metrics = {field: metrics_by_region(match, field, config) for field in fields}
    integrated = optional_integrated_checks(match, config)
    tolerance_results = evaluate_tolerances(metrics, config)
    uncertainty_results = evaluate_uncertainty(match, fields, config)
    checks = {
        "spatial_alignment": "PASS",
        "test_holdout_only": "PASS",
        "fields_compared": fields,
        "integrated_quantities": integrated,
        "tolerances": tolerance_results,
        "reference_comparison": tolerance_results["status"],
        "uncertainty": uncertainty_results,
    }
    status = "VALIDATION_FAILED" if tolerance_results["status"] == "FAIL" or uncertainty_results["status"] == "FAIL" else "READY_FOR_RUN"
    if tolerance_results["status"] == "PASS" and uncertainty_results["status"] == "PASS":
        status = "VALIDATED"

    payload = {
        "status": status,
        "comparison_split": "TEST_HOLDOUT",
        "n_cfd": int(len(cfd)),
        "n_pinn": int(len(pinn)),
        "fields": fields,
        "alignment": {"method": "nearest_neighbor", "tolerance_m": tolerance_m, "max_distance_m": float(np.max(match.distances_m)), "mean_distance_m": float(np.mean(match.distances_m))},
        "metrics": metrics,
        "checks": checks,
        "integrated_quantities": integrated,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "comparison_report.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output_dir / "comparison_report.md").write_text(build_report(payload), encoding="utf-8")
    print(json.dumps({"status": status, "output_dir": str(args.output_dir), "fields": fields}, ensure_ascii=False))
    return 0 if status in {"READY_FOR_RUN", "VALIDATED"} else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, KeyError) as exc:
        print(f"ERREUR: {exc}", file=sys.stderr)
        raise SystemExit(2)
