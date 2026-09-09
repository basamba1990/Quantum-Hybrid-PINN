from __future__ import annotations
import hashlib, json, os, shutil, subprocess, sys
from pathlib import Path

REPO = Path('/tmp/Quantum-Hybrid-PINN')
CASE = REPO / 'pilot_case/PILOT-VINUESA-NACA4412-001'
OUT = CASE / 'reproduction_2_simulation'
SOURCE_FILES = [
    'case_manifest.json',
    'acceptance_criteria_freeze.json',
    'artifacts/input_raw/artifact_record.json',
    'artifacts/input_raw/raw_artifacts.sha256',
    'artifacts/input_raw/split_manifest.json',
    'artifacts/derived/naca4412_cfd_preview.json',
]

def sha(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest()

def copy_tree(target: Path) -> None:
    if target.exists(): shutil.rmtree(target)
    target.mkdir(parents=True)
    for rel in SOURCE_FILES:
        src=CASE/rel; dst=target/rel; dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src,dst)
    # Simulate a clean dependency/runtime descriptor without claiming a model run.
    runtime={
      'mode':'clean-reproduction-simulation',
      'scientific_run_executed':False,
      'model_training_executed':False,
      'baseline_executed':False,
      'hybrid_quantum_executed':False,
      'python':'3.11-compatible',
      'source_commit':subprocess.check_output(['git','-C',str(REPO),'rev-parse','HEAD'],text=True).strip(),
      'seed':'NOT_APPROVED_NOT_USED',
      'network':'not_required',
      'raw_dataset_present':False,
      'purpose':'replay provenance, schema, hash and split checks only',
    }
    (target/'runtime_descriptor.json').write_text(json.dumps(runtime,indent=2,sort_keys=True)+'\n')

def check(target: Path) -> dict:
    manifest=json.loads((target/'case_manifest.json').read_text())
    record=json.loads((target/'artifacts/input_raw/artifact_record.json').read_text())
    split=json.loads((target/'artifacts/input_raw/split_manifest.json').read_text())
    preview=json.loads((target/'artifacts/derived/naca4412_cfd_preview.json').read_text())
    checks={
      'case_id': manifest['case_id']=='PILOT-VINUESA-NACA4412-001',
      'artifact_hash_manifest_record': manifest['geometry']['artifact_sha256']==record['sha256'],
      'raw_hash_record': (target/'artifacts/input_raw/raw_artifacts.sha256').read_text().strip()==f"{record['sha256']}  top2n_HighRes.npz",
      'split_hash': manifest['split']['split_sha256']==hashlib.sha256((json.dumps(split,indent=2,sort_keys=True)+'\n').encode()).hexdigest(),
      'preview_source_hash': preview['provenance']['sourceHash']==record['sha256'],
      'preview_not_validated': preview['evidence']['solverResiduals'] is False and preview['evidence']['referenceComparison'] is False,
      'reproduction_not_claimed': json.loads((target/'runtime_descriptor.json').read_text())['scientific_run_executed'] is False,
    }
    return checks

if __name__=='__main__':
    if OUT.exists(): shutil.rmtree(OUT)
    a=OUT/'env_a'; b=OUT/'env_b'
    copy_tree(a); copy_tree(b)
    ca=check(a); cb=check(b)
    concordant=ca==cb and all(ca.values())
    report={
      'schema':'quantum-pilot-g5-reproduction-simulation.v1',
      'case_id':'PILOT-VINUESA-NACA4412-001',
      'status':'SIMULATED_PRECHECK_ONLY',
      'scientific_reproduction_status':'NOT_COMPLETED',
      'decision':'INCONCLUSIVE',
      'environment_a':str(a.relative_to(REPO)),
      'environment_b':str(b.relative_to(REPO)),
      'checks_a':ca,
      'checks_b':cb,
      'concordant_prechecks':concordant,
      'limitations':[
        'No PINN training or inference was executed.',
        'No classical baseline or hybrid/quantum run was executed.',
        'No physical residuals were calculated.',
        'Acceptance thresholds are still pending approval.',
        'Written data authorization is still pending.',
        'This simulation cannot satisfy G5 or mark reproduction_2 as COMPLETED.'
      ],
    }
    (OUT/'simulation_report.json').write_text(json.dumps(report,indent=2,sort_keys=True)+'\n')
    print(json.dumps(report,indent=2,sort_keys=True))
    raise SystemExit(0 if concordant else 2)
