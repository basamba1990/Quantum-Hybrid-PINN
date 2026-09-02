#!/usr/bin/env python3
"""Compare deux runs LH2 OpenFOAM sans inventer de données.

Chaque cas est fourni par un log OpenFOAM et, si disponible, le CSV de bilan
produit par les functionObjects. Le script trace les résidus finaux par ordre
d'apparition et le déséquilibre d'énergie calculé par le postprocesseur.
"""
from __future__ import annotations
import argparse, csv, json, math, re
from pathlib import Path
import matplotlib.pyplot as plt

TIME_RE = re.compile(r"^Time\s*=\s*([-+0-9.eE]+)")
RES_RE = re.compile(r"Solving for\s+([^,]+),\s*Initial residual\s*=\s*([-+0-9.eE]+),\s*Final residual\s*=\s*([-+0-9.eE]+)")
BAD_RE = re.compile(r"\b(?:nan|inf|-inf|FPE|Floating point exception)\b", re.I)


def parse_log(path: Path):
    t = None; records = []; bad = []
    for line in path.read_text(errors="replace").splitlines():
        m = TIME_RE.search(line.strip())
        if m: t = float(m.group(1))
        if BAD_RE.search(line): bad.append(t)
        m = RES_RE.search(line)
        if m and t is not None:
            try:
                records.append({"time": t, "field": m.group(1).strip(), "initial": float(m.group(2)), "final": float(m.group(3))})
            except ValueError: bad.append(t)
    return records, bad


def parse_balance(path: Path | None):
    if path is None or not path.exists(): return []
    rows = []
    with path.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                rows.append({k: float(r[k]) for k in ("time", "energy_imbalance")})
            except (KeyError, TypeError, ValueError):
                continue
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-wall-log", type=Path, required=True)
    ap.add_argument("--wall1-log", type=Path, required=True)
    ap.add_argument("--no-wall-balance", type=Path)
    ap.add_argument("--wall1-balance", type=Path)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    cases = {
        "sans_wall_boiling": (args.no_wall_log, args.no_wall_balance),
        "wall1_seule": (args.wall1_log, args.wall1_balance),
    }
    parsed = {}
    for name, (log, balance) in cases.items():
        residuals, bad = parse_log(log)
        parsed[name] = {"log": str(log), "residuals": residuals, "nonfinite_events": len(bad), "balance": parse_balance(balance)}
    fig, axes = plt.subplots(2, 1, figsize=(12, 9), constrained_layout=True)
    for name, data in parsed.items():
        by_field = {}
        for r in data["residuals"]:
            by_field.setdefault(r["field"], []).append(r)
        for field, rows in sorted(by_field.items()):
            axes[0].semilogy(range(1, len(rows)+1), [max(x["final"], 1e-300) for x in rows], marker=".", label=f"{name}: {field}")
        if data["balance"]:
            axes[1].plot([r["time"] for r in data["balance"]], [r["energy_imbalance"] for r in data["balance"]], marker=".", label=name)
    axes[0].set_title("Résidus finaux OpenFOAM — comparaison")
    axes[0].set_xlabel("Occurrence du résidu dans le log")
    axes[0].set_ylabel("Résidu final")
    axes[0].grid(True, which="both", alpha=.25); axes[0].legend(fontsize=8)
    axes[1].axhline(0, color="black", linewidth=.8)
    axes[1].set_title("Déséquilibre énergétique global — comparaison")
    axes[1].set_xlabel("Temps OpenFOAM"); axes[1].set_ylabel("R_E [W selon convention CSV]")
    axes[1].grid(True, alpha=.25); axes[1].legend()
    fig.savefig(args.output_dir / "lh2_comparison_residuals_energy.png", dpi=160)
    summary = {}
    for name, data in parsed.items():
        finals = [r["final"] for r in data["residuals"] if math.isfinite(r["final"])]
        energies = [abs(r["energy_imbalance"]) for r in data["balance"] if math.isfinite(r["energy_imbalance"])]
        summary[name] = {
            "log": data["log"], "residual_count": len(data["residuals"]),
            "nonfinite_events": data["nonfinite_events"],
            "last_final_residual": finals[-1] if finals else None,
            "max_abs_energy_imbalance": max(energies) if energies else None,
            "status": "FAIL_NONFINITE" if data["nonfinite_events"] else "DIAGNOSTIC_ONLY",
        }
    (args.output_dir / "lh2_comparison_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"figure": str(args.output_dir / "lh2_comparison_residuals_energy.png"), "summary": summary}, indent=2, ensure_ascii=False))

if __name__ == "__main__": main()
