from fastapi import FastAPI
from fastapi.testclient import TestClient

from lh2_tank_router import router

app = FastAPI()
app.include_router(router)


VALID_CONTRACT = {
    "contract_version": "lh2-tank-thermo-multiphase.v1",
    "volume_l": 50,
    "cylindrical_diameter_m": 0.386,
    "cylindrical_height_m": 0.450,
    "upper_dome_height_m": 0.0991,
    "lower_dome_height_m": 0.10145,
    "wall_material": "aluminium_2219",
    "wall_thickness_m": 0.003,
    "insulation_material": "polyurethane_foam",
    "insulation_thickness_m": 0.02,
    "initial_fill_fraction": 0.5,
    "initial_pressure_pa": 101325,
    "initial_temperature_k": 20.268,
    "external_wind_speed_m_s": 2,
    "reference_mesh_cells": 40000,
    "multiphase_model": "vof",
    "interface_model": "csf",
    "phase_change_model": "ranz_marshall",
    "property_source": "nist_tables",
    "oracle": {
        "solver": "FIRE-modified",
        "solver_version": "article-reference",
        "run_id": "lh2-run-0001",
        "mesh_uri": "https://example.invalid/lh2.mesh",
        "fields_uri": "https://example.invalid/lh2.fields",
        "checksum_sha256": "a" * 64,
    },
}


def test_capabilities_expose_the_real_case_without_claiming_execution():
    response = TestClient(app).get("/v1/scenarios/lh2-tank/capabilities")
    assert response.status_code == 200
    payload = response.json()
    assert payload["scenario_type"] == "LH2_TANK_THERMO_MULTIPHASE_V1"
    assert payload["executable"] is False
    assert payload["reference_cases"]["insulation_thickness_m"] == [0.01, 0.02, 0.03]


def test_article_case_contract_is_accepted_as_unvalidated():
    response = TestClient(app).post("/v1/scenarios/lh2-tank/validate", json=VALID_CONTRACT)
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "UNVALIDATED_ORACLE_REFERENCE"
    assert payload["executable"] is False


def test_execution_is_blocked_without_registered_oracle_runner():
    response = TestClient(app).post("/v1/scenarios/lh2-tank/run", json=VALID_CONTRACT)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "LH2_TANK_ORACLE_NOT_REGISTERED"


def test_invalid_insulation_case_is_rejected():
    invalid = {**VALID_CONTRACT, "insulation_thickness_m": 0.015}
    response = TestClient(app).post("/v1/scenarios/lh2-tank/validate", json=invalid)
    assert response.status_code == 422
