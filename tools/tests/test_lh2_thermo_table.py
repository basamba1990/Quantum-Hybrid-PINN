import csv
import math
from pathlib import Path


def test_nist_saturation_table_is_finite_and_monotone():
    path = Path(__file__).parents[2] / "pilot_case/PILOT-LH2-001/cases/CFD-BASELINE/Tsat_parahydrogen_NIST.csv"
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    pressures = [float(row["p"]) for row in rows]
    temperatures = [float(row["Tsat"]) for row in rows]
    assert all(math.isfinite(value) for value in pressures + temperatures)
    assert all(a < b for a, b in zip(pressures, pressures[1:]))
    assert all(a < b for a, b in zip(temperatures, temperatures[1:]))
    assert pressures[0] > 0
    assert 13.8033 < temperatures[0] <= temperatures[-1] <= 32.510


if __name__ == "__main__":
    test_nist_saturation_table_is_finite_and_monotone()
    print("LH2 saturation table test: OK")
