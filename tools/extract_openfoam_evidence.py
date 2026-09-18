#!/usr/bin/env python3
"""Extract auditable residual/balance evidence from a real OpenFOAM run.

The tool is fail-closed: missing quantities remain null and the report stays
INCONCLUSIVE; no zero or synthetic value is invented.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, math, re
from pathlib import Path

NUM=r"(?:[-+0-9.eE]+|nan|inf|-inf)"
TIME_RE=re.compile(rf"^Time\s*=\s*(?P<time>{NUM})")
RES_RE=re.compile(rf"Solving for (?P<field>[^,]+),\s*Initial residual\s*=\s*(?P<initial>{NUM}),\s*Final residual\s*=\s*(?P<final>{NUM})")
CONT_RE=re.compile(rf"continuity errors\s*:\s*sum local\s*=\s*(?P<local>{NUM}),\s*global\s*=\s*(?P<global>{NUM}),\s*cumulative\s*=\s*(?P<cumulative>{NUM})")
BALANCE_COLUMNS=("time","mass_in","mass_out","energy_in","energy_out","mass_storage","energy_storage")

def num(value, label):
    x=float(value)
    if not math.isfinite(x): raise ValueError(f"non-finite {label}: {value}")
    return x

def parse_log(path):
    current=None; residuals=[]; continuity=[]; nonfinite=False
    for n,line in enumerate(path.read_text(errors="replace").splitlines(),1):
        if re.search(r"\b(?:nan|inf|-inf)\b", line, re.I): nonfinite=True
        m=TIME_RE.search(line.strip())
        if m: current=num(m.group("time"), "time")
        m=RES_RE.search(line)
        if m:
            try:
                residuals.append({"line":n,"time":current,"field":m.group("field").strip(),"initial":num(m.group("initial"),"initial residual"),"final":num(m.group("final"),"final residual")})
            except ValueError:
                nonfinite=True
        m=CONT_RE.search(line)
        if m: continuity.append({"line":n,"time":current,"sumLocal":num(m.group("local"),"sum local"),"global":num(m.group("global"),"global"),"cumulative":num(m.group("cumulative"),"cumulative")})
    if not residuals and not nonfinite: raise ValueError(f"no OpenFOAM algebraic residual found in {path}")
    return residuals, continuity, nonfinite

def parse_balance(path):
    with path.open(newline="",encoding="utf-8") as f:
        r=csv.DictReader(f); missing=[c for c in BALANCE_COLUMNS if c not in (r.fieldnames or [])]
        if missing: raise ValueError("missing balance columns: "+", ".join(missing))
        rows=[{c:num(row[c],c) for c in BALANCE_COLUMNS} for row in r]
    rows.sort(key=lambda x:x["time"])
    if len(rows)<2: raise ValueError("at least two balance rows are required")
    for a,b in zip(rows,rows[1:]):
        if b["time"]<=a["time"]: raise ValueError("balance times must be strictly increasing")
    out=[]
    for i,row in enumerate(rows):
        if i==0: out.append({**row,"massStorageRate":None,"energyStorageRate":None,"massImbalance":None,"energyImbalance":None}); continue
        prev=rows[i-1]; dt=row["time"]-prev["time"]
        dm=(row["mass_storage"]-prev["mass_storage"])/dt; de=(row["energy_storage"]-prev["energy_storage"])/dt
        out.append({**row,"massStorageRate":dm,"energyStorageRate":de,"massImbalance":row["mass_in"]-row["mass_out"]-dm,"energyImbalance":row["energy_in"]-row["energy_out"]-de})
    return out

def final_residual(residuals, names):
    values=[x["final"] for x in residuals if any(n in x["field"].lower() for n in names)]
    return max(values) if values else None

def main():
    p=argparse.ArgumentParser(); p.add_argument("--log",required=True,type=Path); p.add_argument("--balance-csv",type=Path); p.add_argument("--output",required=True,type=Path); p.add_argument("--run-log-hash",default=None)
    a=p.parse_args(); residuals,continuity,nonfinite=parse_log(a.log); balances=parse_balance(a.balance_csv) if a.balance_csv else None
    mass=abs(continuity[-1]["global"]) if continuity else None
    momentum=final_residual(residuals,("u","momentum")); energy=final_residual(residuals,("t","temperature","e","enthalpy"))
    log_hash=hashlib.sha256(a.log.read_bytes()).hexdigest()
    report={"schema":"openfoam-residual-balance-report.v1","status":"INCONCLUSIVE","residuals":{"mass":mass,"momentum":momentum,"energy":energy,"norm":"OPENFOAM_FINAL_RESIDUALS","computedBy":"extract_openfoam_evidence.py"},"evidence":{"solverLog":str(a.log),"solverLogHash":a.run_log_hash or log_hash,"residualsParsed":bool(residuals) and not nonfinite,"continuityParsed":bool(continuity),"balanceParsed":balances is not None,"noSyntheticValues":True},"residualHistory":residuals,"continuity":continuity,"balance":balances}
    if balances:
        report["balanceSummary"]={"maxAbsMassImbalance":max(abs(x["massImbalance"]) for x in balances[1:]),"maxAbsEnergyImbalance":max(abs(x["energyImbalance"]) for x in balances[1:])}
    if nonfinite: report["status"]="FAIL_NONFINITE_LOG"
    elif all(report["residuals"][k] is not None for k in ("mass","momentum","energy")) and balances: report["status"]="PARSED_INCONCLUSIVE"
    a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({"status":report["status"],"output":str(a.output),"residuals":report["residuals"]},ensure_ascii=False))
    return 0 if report["status"] in ("PARSED_INCONCLUSIVE","INCONCLUSIVE") else 2
if __name__=="__main__": raise SystemExit(main())
