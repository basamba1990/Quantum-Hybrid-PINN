#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', type=Path, required=True)
    ap.add_argument('--run-dir', type=Path, required=True)
    args = ap.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    run = args.run_dir
    required = ['solver_stdout.log', 'history.csv', 'flow.vtu', 'surface_flow.csv', 'naca0012_euler.cfg', 'solver_residuals.jsonl', 'residual_evidence.json']
    missing = [name for name in required if not (run / name).is_file()]
    if missing:
        raise SystemExit('missing run artifact(s): ' + ', '.join(missing))
    stdout = (run / 'solver_stdout.log').read_text(encoding='utf-8', errors='strict')
    if 'All convergence criteria satisfied.' not in stdout:
        raise SystemExit('CFD convergence marker not found')
    if 'Maximum number of iterations reached' in stdout:
        raise SystemExit('run contains a maximum-iteration failure marker')
    manifest['run_id'] = 'RUN-002'
    manifest['status'] = 'CFD_REFERENCE_RUN_CONVERGED_NOT_PHYSICALLY_ACCEPTED'
    manifest['protocol']['execution_scope'] = 'INDEPENDENT_CFD_RUN_CONVERGED_NOT_PINN_VALIDATED'
    manifest['gates'] = {
        'G0': 'NOT_REACHED',
        'G1': 'STRUCTURAL_TEST_UNVALIDATED',
        'G2': 'CFD_RESIDUAL_CONVERGED',
        'G3': 'REFERENCE_RUN_RECORDED',
        'G4': 'RESIDUALS_RECORDED_CONVERGED_NOT_PHYSICALLY_ACCEPTED',
        'G5': 'NOT_REACHED'
    }
    manifest['decision'] = {
        'status': 'INCONCLUSIVE',
        'blocking_gate': 'G0',
        'basis': 'solver_converged_numerically_but_no_pinn_comparison_and_physical_acceptance_is_pending'
    }
    manifest['publication']['allowed_claim'] = 'PUBLIC_PROVENANCE_AND_CONVERGED_NUMERICAL_CFD_RUN_RECORDED_NOT_VALIDATED'
    manifest['residuals']['sourceLogSha256'] = sha256(run / 'solver_residuals.jsonl')
    manifest['residuals']['evidenceSha256'] = sha256(run / 'residual_evidence.json')
    manifest['residuals']['computedAt'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    tmp = args.manifest.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    tmp.replace(args.manifest)
    print(json.dumps({'status': manifest['status'], 'decision': manifest['decision'], 'sourceLogSha256': manifest['residuals']['sourceLogSha256'], 'evidenceSha256': manifest['residuals']['evidenceSha256']}))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
