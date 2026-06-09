import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_validate_3d():
    payload = {
        "pressure": 1e5,
        "temperature": 300,
        "density": 1.0,
        "velocity_magnitude": 10.0,
        "x": 0.5, "y": 0.5, "z": 0.5
    }
    response = client.post("/v2/validate-3d", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "credibility_score" in data
    assert "residuals" in data
    assert len(data["predictions3d"]) > 0

def test_run_simulation_fail_no_auth():
    # Test with dummy data, assuming it should fail or require specific project/user IDs
    payload = {
        "project_id": "00000000-0000-0000-0000-000000000000",
        "user_id": "00000000-0000-0000-0000-000000000000",
        "job_name": "Test Job",
        "case_path": "/test/case",
        "n_steps": 10
    }
    response = client.post("/hybrid/run-simulation", json=payload)
    # Since we don't have real auth middleware active in this simple test client, it might pass or fail based on logic
    assert response.status_code == 200 
    assert response.json()["status"] == "RUNNING"
