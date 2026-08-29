#!/usr/bin/env python3
"""Convert a SU2 history.csv into strict CFD residual JSONL evidence.

SU2 reports RMS residuals as base-10 logarithms. This adapter converts them to
positive norms and preserves the original history hash. It refuses missing or
ambiguous columns and never invents residuals.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

REQUIRED = {
    "Inner_Iter": "iteration",
    "rms[Rho]": "mass",
    "rms[RhoU]": "momentum_x",
    "rms[RhoV]": "momentum_y",
    "rms[RhoE]": "energy",
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def clean_header(value: str) -> str:
    return value.strip().strip('"')


def parse(path: Path) -> tuple[list[dict[str, float | int]], dict[str, float | int]]:
    with path.open(newline="", encoding="utf-8") as stream:
        reader = csv.reader(stream, skipinitialspace=True)
        try:
            raw_headers = next(reader)
        except StopIteration as exc:
            raise ValueError("SU2 history is empty") from exc
        headers = [clean_header(item) for item in raw_headers]
        positions = {name: headers.index(name) for name in REQUIRED if name in headers}
        missing = sorted(set(REQUIRED) - set(positions))
        if missing:
            raise ValueError(f"SU2 history missing required columns: {', '.join(missing)}")
        records = []
        last_iteration = None
        last_aux: dict[str, float | int] = {}
        for line_number, row in enumerate(reader, start=2):
            if not row or not any(item.strip() for item in row):
                continue
            try:
                iteration = int(float(row[positions["Inner_Iter"]].strip()))
                values = {}
                for source, target in REQUIRED.items():
                    value = float(row[positions[source]].strip())
                    if not math.isfinite(value):
                        raise ValueError(f"non-finite value in {source}")
                    if source.startswith("rms["):
                        value = math.pow(10.0, value)
                    values[target] = value
                for optional in ("CL", "CD"):
                    if optional in headers:
                        value = float(row[headers.index(optional)].strip())
                        if math.isfinite(value):
                            last_aux[optional] = value
            except (ValueError, IndexError) as exc:
                raise ValueError(f"invalid SU2 history line {line_number}: {exc}") from exc
            if last_iteration is not None and iteration <= last_iteration:
                raise ValueError("SU2 iterations are not strictly increasing")
            last_iteration = iteration
            records.append({"iteration": iteration, "mass": values["mass"], "momentum": max(values["momentum_x"], values["momentum_y"]), "energy": values["energy"]})
        if not records:
            raise ValueError("SU2 history contains no iterations")
        return records, last_aux


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--solver-version", required=True)
    parser.add_argument("--calculation-id", required=True)
    args = parser.parse_args()
    if args.history.resolve() == args.output.resolve():
        raise ValueError("history and output must be different files")
    records, final_aero = parse(args.history)
    document = {
        "schema": "su2-residual-source.v1",
        "solver": {"name": "SU2_CFD", "version": args.solver_version},
        "calculation_id": args.calculation_id,
        "source_history": {"path": args.history.name, "sha256": sha256_file(args.history), "bytes": args.history.stat().st_size},
        "residual_scale": "10_power_log10_rms",
        "records": records,
        "final_aerodynamic_coefficients": final_aero,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, separators=(",", ":")) + "\n")
    print(json.dumps({"status": "SU2_HISTORY_CONVERTED", "records": len(records), "final": records[-1], "aerodynamic_coefficients": final_aero, "output": str(args.output)}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, csv.Error) as exc:
        print(f"FAIL: {exc}")
        raise SystemExit(2)
