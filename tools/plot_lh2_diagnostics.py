#!/usr/bin/env python3
"""Trace les résidus OpenFOAM et marque les événements non finis.

Aucune donnée n'est simulée : seuls les logs fournis sont tracés. Les courbes
sont des diagnostics, pas une preuve de convergence ou d'acceptation physique.
"""
from __future__ import annotations
import argparse
import re
from pathlib import Path
import matplotlib.pyplot as plt

TIME_RE = re.compile(r"^Time\s*=\s*([-+0-9.eE]+)")
RES_RE = re.compile(r"Solving for\s+([^,]+),\s*Initial residual\s*=\s*([-+0-9.eE]+),\s*Final residual\s*=\s*([-+0-9.eE]+)")

def parse(path: Path):
    t = None
    records = []
    nan_times = []
    for line in path.read_text(errors="replace").splitlines():
        m = TIME_RE.search(line.strip())
        if m:
            t = float(m.group(1))
        if re.search(r"\b(?:nan|inf|-inf|FPE|Floating point exception)\b", line, re.I):
            nan_times.append(t if t is not None else float("nan"))
        m = RES_RE.search(line)
        if m and t is not None:
            try:
                initial = float(m.group(2)); final = float(m.group(3))
                if initial >= 0 and final >= 0:
                    records.append((t, m.group(1).strip(), initial, final))
            except ValueError:
                pass
    return records, nan_times

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("logs", nargs="+", type=Path)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(len(args.logs), 1, figsize=(11, max(4, 3.8*len(args.logs))), squeeze=False)
    statuses = []
    for ax, path in zip(axes[:, 0], args.logs):
        records, bad = parse(path)
        by_field = {}
        for time, field, initial, final in records:
            by_field.setdefault(field, ([], [], []))
            by_field[field][0].append(time); by_field[field][1].append(initial); by_field[field][2].append(final)
        for field, (times, initials, finals) in sorted(by_field.items()):
            ax.semilogy(times, finals, marker=".", linewidth=1, label=f"{field} final")
        if bad:
            ax.axvline(bad[0] if bad[0] == bad[0] else 0, color="red", linestyle="--", label="NaN/FPE détecté")
        ax.set_title(path.name)
        ax.set_xlabel("Temps OpenFOAM")
        ax.set_ylabel("Résidu final")
        ax.grid(True, which="both", alpha=0.25)
        ax.legend(fontsize=8, ncol=2)
        statuses.append({"log": str(path), "residual_records": len(records), "nonfinite_events": len(bad), "status": "FAIL_NONFINITE" if bad else "DIAGNOSTIC_ONLY"})
    fig.tight_layout()
    figure = args.output_dir / "lh2_residual_diagnostics.png"
    fig.savefig(figure, dpi=160)
    (args.output_dir / "lh2_residual_diagnostics.json").write_text(__import__("json").dumps(statuses, indent=2) + "\n")
    print(__import__("json").dumps({"figure": str(figure), "runs": statuses}, indent=2))

if __name__ == "__main__":
    main()
