from pathlib import Path
import json
import subprocess
import sys
import tempfile

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "compare_pinn_cfd.py"


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        points = np.array([[0.0, 0.0, 0.0], [0.1, 0.0, 0.0], [0.0, 0.1, 0.0], [0.0, 0.0, 0.1]])
        cfd = pd.DataFrame({
            "x_m": points[:, 0], "y_m": points[:, 1], "z_m": points[:, 2], "split": "TEST_HOLDOUT",
            "pressure_Pa": [100000.0, 99000.0, 99500.0, 99750.0],
            "temperature_K": [20.0, 20.1, 20.2, 20.3],
            "velocity_magnitude_m_s": [1.0, 1.1, 1.2, 1.3],
            "material_stress_Pa": [1000.0, 1010.0, 1020.0, 1030.0],
        })
        pinn = cfd.copy()
        pinn["pressure_Pa"] += 100.0
        pinn["temperature_K"] += 0.01
        pinn["velocity_magnitude_m_s"] *= 1.01
        pinn["material_stress_Pa"] += 1.0
        cfd.to_csv(work / "cfd.csv", index=False)
        pinn.to_csv(work / "pinn.csv", index=False)
        metadata = {
            "coordinate_system": "Cartesian SI",
            "comparison_split": "TEST_HOLDOUT",
            "units": {"x_m": "m", "y_m": "m", "z_m": "m"},
        }
        (work / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        config = {
            "match_tolerance_m": 1e-9,
            "tolerances": {
                "pressure_Pa": {"relative_l2_max": 0.01, "rmse_max": 200.0},
                "temperature_K": {"relative_l2_max": 0.01, "rmse_max": 0.02},
                "velocity_magnitude_m_s": {"relative_l2_max": 0.02, "rmse_max": 0.02},
                "material_stress_Pa": {"relative_l2_max": 0.01, "rmse_max": 2.0},
            },
        }
        (work / "config.json").write_text(json.dumps(config), encoding="utf-8")
        result = subprocess.run([
            sys.executable, str(SCRIPT), "--cfd", str(work / "cfd.csv"), "--pinn", str(work / "pinn.csv"),
            "--metadata", str(work / "metadata.json"), "--config", str(work / "config.json"),
            "--output-dir", str(work / "out"),
        ], capture_output=True, text=True, check=False)
        if result.returncode != 0:
            raise SystemExit(result.stderr or result.stdout)
        report = json.loads((work / "out" / "comparison_report.json").read_text(encoding="utf-8"))
        assert report["status"] == "READY_FOR_RUN", report["status"]
        assert report["alignment"]["max_distance_m"] == 0.0
        assert report["checks"]["tolerances"]["status"] == "PASS"
        assert "uncertainty" in report["checks"]

        for field in ["pressure_Pa", "temperature_K", "velocity_magnitude_m_s", "material_stress_Pa"]:
            pinn[f"{field}_std"] = 100000.0
        pinn.to_csv(work / "pinn_with_uncertainty.csv", index=False)
        config["uncertainty_columns"] = {field: f"{field}_std" for field in ["pressure_Pa", "temperature_K", "velocity_magnitude_m_s", "material_stress_Pa"]}
        config["uncertainty_coverage_min"] = 0.95
        (work / "config_with_uncertainty.json").write_text(json.dumps(config), encoding="utf-8")
        validated = subprocess.run([
            sys.executable, str(SCRIPT), "--cfd", str(work / "cfd.csv"), "--pinn", str(work / "pinn_with_uncertainty.csv"),
            "--metadata", str(work / "metadata.json"), "--config", str(work / "config_with_uncertainty.json"),
            "--output-dir", str(work / "out_validated"),
        ], capture_output=True, text=True, check=False)
        if validated.returncode != 0:
            raise SystemExit(validated.stderr or validated.stdout)
        validated_report = json.loads((work / "out_validated" / "comparison_report.json").read_text(encoding="utf-8"))
        assert validated_report["status"] == "VALIDATED", validated_report["status"]
        assert validated_report["checks"]["uncertainty"]["status"] == "PASS"
        print("synthetic comparison: PASS; conservative READY_FOR_RUN and explicit VALIDATED paths verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
