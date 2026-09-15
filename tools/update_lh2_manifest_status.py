from pathlib import Path
import json
p = Path(__file__).parents[1] / "pilot_case/PILOT-LH2-001/MANIFEST.json"
data = json.loads(p.read_text())
data["case_status"] = "INCONCLUSIVE_SOLVER_STABILITY"
data["solver"]["selection_status"] = "EXECUTABLE_OPENFOAM_2512_RUNNER_VERIFIED_THERMO_STABILITY_PENDING"
data["solver"]["verified_executable_in_audited_environment"] = True
data["evidence"]["runtime_evidence"] = "evidence/runtime_2026-09-15/manifest.json"
data["gates"].update({"G1": "PASS_RUNNER_AVAILABLE", "G2": "PASS_SOLVER_STARTED", "G3": "INCONCLUSIVE_ENTHALPY_INVERSION", "G4": "NOT_RUN_CONVERGENCE_REQUIRED", "G5": "NOT_RUN_INDEPENDENT_REQUIRED"})
p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
