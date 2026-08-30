from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
RUNNER = ROOT / 'run_pinn_compare_cfd.py'
CONTRACT = ROOT / 'pinn_cfd_contract.naca0012.json'


def test_missing_checkpoint_fails_closed(tmp_path):
    out = tmp_path / 'comparison.json'
    proc = subprocess.run([
        sys.executable, str(RUNNER),
        '--checkpoint', str(tmp_path / 'missing.pt'),
        '--flow-csv', str(ROOT / 'runs/CFD-REFERENCE-002/restart_flow.csv'),
        '--contract', str(CONTRACT),
        '--time', '0.0',
        '--seed', '20260829',
        '--output', str(out),
    ], text=True, capture_output=True)
    assert proc.returncode != 0
    assert not out.exists()
    assert 'CFD reference input is missing' in proc.stdout


def test_contract_is_explicit():
    contract = json.loads(CONTRACT.read_text())
    assert contract['model_output_names'] == ['rho', 'u', 'v', 'w', 'T']
    assert contract['comparison_fields'] == ['u', 'v']
    assert contract['acceptance_status'] == 'PENDING_APPROVED_METRICS'
