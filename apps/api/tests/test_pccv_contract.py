from fastapi.testclient import TestClient
from fastapi import FastAPI

from pccv_router import router

app = FastAPI()
app.include_router(router)


VALID_CONTRACT = {
    "contract_version": "pccv-transient-thermo.v1",
    "geometry_uri": "https://example.invalid/pccv.step",
    "geometry_checksum_sha256": "a" * 64,
    "coolant": "water_glycol",
    "density_kg_m3": 1050,
    "dynamic_viscosity_pa_s": 0.003,
    "specific_heat_j_kg_k": 3500,
    "thermal_conductivity_w_m_k": 0.4,
    "rotation": {
        "initial_angle_deg": 0,
        "final_angle_deg": 90,
        "angular_speed_deg_s": 30,
        "direction": "clockwise",
        "duration_s": 3,
    },
    "inlet_conditions": [{
        "port": "stack",
        "mass_flow_kg_s": 1.0,
        "temperature_k": 333,
        "pressure_pa": 180000,
    }],
    "outlet_pressure_pa": 150000,
    "ambient_temperature_k": 298,
    "oracle": {
        "solver": "moving-mesh-cfd",
        "solver_version": "1.0",
        "run_id": "pccv-run-0001",
        "mesh_uri": "https://example.invalid/pccv.mesh",
        "fields_uri": "https://example.invalid/pccv.fields",
        "checksum_sha256": "b" * 64,
    },
}


def test_capabilities_are_explicitly_not_executable():
    client = TestClient(app)
    response = client.get("/v1/scenarios/pccv/capabilities")
    assert response.status_code == 200
    payload = response.json()
    assert payload["scenario_type"] == "PCCV_TRANSIENT_THERMO_V1"
    assert payload["executable"] is False


def test_valid_contract_is_accepted_but_unvalidated():
    client = TestClient(app)
    response = client.post("/v1/scenarios/pccv/validate", json=VALID_CONTRACT)
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "UNVALIDATED_ORACLE_REFERENCE"
    assert payload["executable"] is False


def test_run_never_fabricates_results_without_registered_runner():
    client = TestClient(app)
    response = client.post("/v1/scenarios/pccv/run", json=VALID_CONTRACT)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PCCV_ORACLE_NOT_REGISTERED"


def test_duplicate_ports_are_rejected():
    client = TestClient(app)
    invalid = {**VALID_CONTRACT, "inlet_conditions": [
        VALID_CONTRACT["inlet_conditions"][0],
        {**VALID_CONTRACT["inlet_conditions"][0], "mass_flow_kg_s": 2.0},
    ]}
    response = client.post("/v1/scenarios/pccv/validate", json=invalid)
    assert response.status_code == 422
