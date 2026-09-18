from __future__ import annotations
import json, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'extract_openfoam_evidence.py'

def test_extract_realistic_log_and_balance(tmp_path):
    log=tmp_path/'pimpleFoam.log'; log.write_text('''Time = 0.1\nSolving for Ux, Initial residual = 1e-2, Final residual = 1e-5, No Iterations 3\nSolving for T, Initial residual = 2e-2, Final residual = 2e-5, No Iterations 4\ntime step continuity errors : sum local = 3e-7, global = -2e-8, cumulative = -2e-8\nTime = 0.2\nSolving for Ux, Initial residual = 1e-3, Final residual = 1e-6, No Iterations 2\nSolving for T, Initial residual = 2e-3, Final residual = 2e-6, No Iterations 2\ntime step continuity errors : sum local = 2e-7, global = 1e-8, cumulative = -1e-8\n''')
    balance=tmp_path/'balance.csv'; balance.write_text('time,mass_in,mass_out,energy_in,energy_out,mass_storage,energy_storage\n0.1,1,1,10,10,2,100\n0.2,1,1,10,10,2,100\n')
    out=tmp_path/'report.json'
    r=subprocess.run([sys.executable,str(SCRIPT),'--log',str(log),'--balance-csv',str(balance),'--output',str(out)],capture_output=True,text=True)
    assert r.returncode==0, r.stdout+r.stderr
    data=json.loads(out.read_text())
    assert data['residuals']=={'mass':1e-08,'momentum':1e-05,'energy':2e-05,'norm':'OPENFOAM_FINAL_RESIDUALS','computedBy':'extract_openfoam_evidence.py'}
    assert data['evidence']['balanceParsed'] is True
    assert data['evidence']['noSyntheticValues'] is True

def test_missing_energy_remains_inconclusive(tmp_path):
    log=tmp_path/'pimpleFoam.log'; log.write_text('Time = 0.1\nSolving for Ux, Initial residual = 1e-2, Final residual = 1e-5, No Iterations 3\n')
    out=tmp_path/'report.json'
    r=subprocess.run([sys.executable,str(SCRIPT),'--log',str(log),'--output',str(out)],capture_output=True,text=True)
    assert r.returncode==0
    data=json.loads(out.read_text())
    assert data['residuals']['energy'] is None
    assert data['status']=='INCONCLUSIVE'

def test_nonfinite_log_fails_status(tmp_path):
    log=tmp_path/'pimpleFoam.log'; log.write_text('Time = 0.1\nSolving for Ux, Initial residual = nan, Final residual = 1e-5, No Iterations 3\n')
    out=tmp_path/'report.json'
    r=subprocess.run([sys.executable,str(SCRIPT),'--log',str(log),'--output',str(out)],capture_output=True,text=True)
    assert r.returncode==2
    assert json.loads(out.read_text())['status']=='FAIL_NONFINITE_LOG'
