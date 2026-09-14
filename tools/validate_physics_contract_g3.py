#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, math, sys
from pathlib import Path

REQUIRED_FIELDS = {
    "rho": (("kg/m3",), "density"),
    "velocity": (("m/s",), "velocity"),
    "pressure": (("Pa", "MPa", "bar"), "pressure"),
    "temperature": (("K",), "temperature"),
    "alpha_liquid": (("1",), "liquid_volume_fraction"),
    "enthalpy": (("J/kg",), "specific_enthalpy"),
}

def validate(sidecar: dict) -> list[str]:
    errors=[]
    fields=sidecar.get("fieldDescriptors", {})
    for name,(units,quantity) in REQUIRED_FIELDS.items():
        descriptor=fields.get(name)
        if not isinstance(descriptor, dict): errors.append(f"missing field descriptor: {name}"); continue
        if descriptor.get("unit") not in units: errors.append(f"{name}: expected unit in {', '.join(units)}")
        if descriptor.get("quantity") != quantity: errors.append(f"{name}: expected quantity {quantity}")
    provenance=sidecar.get("provenance", {})
    for key in ("solver","solverVersion","calculationId","sourceHash"):
        if not isinstance(provenance.get(key), str) or not provenance[key].strip(): errors.append(f"missing provenance: {key}")
    contract=sidecar.get("physicsContract")
    if not isinstance(contract, dict): errors.append("physicsContract object is missing")
    elif contract.get("validated") is not True: errors.append("physicsContract.validated is not true")
    for key in ("governingEquations","phaseModel","materialProperties","initialConditionsPersisted","boundaryConditionsPersisted"):
        if key not in (contract or {}): errors.append(f"physicsContract missing: {key}")
    frames=sidecar.get("frames")
    if not isinstance(frames,list) or len(frames)<2: errors.append("at least two persisted frames are required")
    for index, frame in enumerate(frames if isinstance(frames, list) else []):
        if not isinstance(frame, dict):
            errors.append(f"frame {index}: descriptor must be an object"); continue
        if not isinstance(frame.get("file"), str) or not frame["file"].strip():
            errors.append(f"frame {index}: persisted file is missing")
        if not isinstance(frame.get("payloadHash"), str) or len(frame["payloadHash"]) != 64:
            errors.append(f"frame {index}: SHA-256 payloadHash is missing")
        listed = set(frame.get("fields", [])) if isinstance(frame.get("fields"), list) else set()
        missing = set(REQUIRED_FIELDS).difference(listed)
        if missing: errors.append(f"frame {index}: missing declared fields {sorted(missing)}")
    evidence = sidecar.get("executionEvidence", {})
    if evidence.get("solverOutput") is not True: errors.append("executionEvidence.solverOutput is not true")
    if not isinstance(evidence.get("runLogHash"), str) or len(evidence["runLogHash"]) != 64:
        errors.append("executionEvidence.runLogHash is missing")
    return errors

def main() -> int:
    p=argparse.ArgumentParser(); p.add_argument("sidecar",type=Path); p.add_argument("--report",type=Path)
    a=p.parse_args(); data=json.loads(a.sidecar.read_text()); errors=validate(data)
    result={"gate":"G3","state":"PASS" if not errors else "BLOCKED","errors":errors}
    print(json.dumps(result,indent=2,ensure_ascii=False))
    if a.report: a.report.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    return 0 if not errors else 2
if __name__ == "__main__": raise SystemExit(main())
