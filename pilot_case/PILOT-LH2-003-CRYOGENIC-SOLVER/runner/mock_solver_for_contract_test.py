#!/usr/bin/env python3
"""Test du contrat uniquement : copie des VTU existants, aucun calcul physique."""
from pathlib import Path
import shutil
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: mock_solver_for_contract_test.py CASE_DIR OUTPUT_DIR")
source = Path(__file__).resolve().parents[3] / "artifacts" / "synthetic_lh2_vtu"
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for path in source.glob("*.vtu"):
    shutil.copyfile(path, out / path.name)
print("CONTRACT TEST ONLY: no CFD calculation executed")
