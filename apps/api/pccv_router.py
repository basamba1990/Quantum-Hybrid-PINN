"""Operational PCCV contract intake; no synthetic CFD result is generated."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from pccv_contract import PCCVTransientContract

router = APIRouter(prefix="/v1/scenarios/pccv", tags=["PCCV"])


class PCCVValidationResponse(BaseModel):
    scenario_type: str
    contract_version: str
    status: str
    executable: bool
    validation_errors: list[str]
    required_next_step: str


@router.get("/capabilities")
def capabilities() -> dict:
    return {
        "scenario_type": "PCCV_TRANSIENT_THERMO_V1",
        "contract_version": "pccv-transient-thermo.v1",
        "status": "CONTRACT_READY_ORACLE_REQUIRED",
        "executable": False,
        "required_inputs": [
            "geometry_uri", "geometry_checksum_sha256", "rotation",
            "inlet_conditions", "outlet_pressure_pa", "oracle"
        ],
        "outputs_when_oracle_is_registered": [
            "port_mass_flow", "pressure_loss", "mixed_temperature",
            "velocity_field", "pressure_field", "hydraulic_torque"
        ],
    }


@router.post("/validate", response_model=PCCVValidationResponse)
def validate_contract(contract: PCCVTransientContract) -> PCCVValidationResponse:
    return PCCVValidationResponse(
        scenario_type="PCCV_TRANSIENT_THERMO_V1",
        contract_version=contract.contract_version,
        status="UNVALIDATED_ORACLE_REFERENCE",
        executable=False,
        validation_errors=[],
        required_next_step=(
            "Register and independently execute the referenced CFD moving-mesh run; "
            "the API does not fabricate PCCV fields or observables."
        ),
    )


@router.post("/run", status_code=status.HTTP_409_CONFLICT)
def run_contract(contract: PCCVTransientContract) -> None:
    """Reject execution until a verified CFD runner is configured."""
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "PCCV_ORACLE_NOT_REGISTERED",
            "scenario_type": "PCCV_TRANSIENT_THERMO_V1",
            "message": "PCCV execution is disabled until a verifiable moving-mesh CFD oracle is registered.",
            "contract_version": contract.contract_version,
        },
    )
