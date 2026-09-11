"""LH2 tank contract intake; execution remains blocked without a registered CFD oracle."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from lh2_tank_contract import LH2TankThermoMultiphaseContract

router = APIRouter(prefix="/v1/scenarios/lh2-tank", tags=["LH2 tank"])


class LH2ValidationResponse(BaseModel):
    scenario_type: str
    contract_version: str
    status: str
    executable: bool
    validation_errors: list[str]
    required_next_step: str


@router.get("/capabilities")
def capabilities() -> dict:
    return {
        "scenario_type": "LH2_TANK_THERMO_MULTIPHASE_V1",
        "contract_version": "lh2-tank-thermo-multiphase.v1",
        "status": "CONTRACT_READY_ORACLE_REQUIRED",
        "executable": False,
        "reference_cases": {
            "volume_l": 50,
            "insulation_thickness_m": [0.01, 0.02, 0.03],
            "initial_fill_fraction": 0.5,
            "initial_temperature_k": 20.268,
            "reference_mesh_cells_approx": 40000,
        },
        "predicted_fields": ["u", "p", "T", "alpha_liquid", "alpha_vapor"],
        "industrial_observables": [
            "ullage_pressure", "tank_temperature", "thermal_stratification",
            "remaining_liquid_mass", "boiloff_rate", "wall_heat_flux",
            "pressurization_rate", "insulation_sensitivity",
        ],
    }


@router.post("/validate", response_model=LH2ValidationResponse)
def validate_contract(contract: LH2TankThermoMultiphaseContract) -> LH2ValidationResponse:
    return LH2ValidationResponse(
        scenario_type="LH2_TANK_THERMO_MULTIPHASE_V1",
        contract_version=contract.contract_version,
        status="UNVALIDATED_ORACLE_REFERENCE",
        executable=False,
        validation_errors=[],
        required_next_step=(
            "Register and independently execute the VOF/CSF phase-change CFD reference "
            "for the selected insulation thickness; no synthetic field is generated."
        ),
    )


@router.post("/run", status_code=status.HTTP_409_CONFLICT)
def run_contract(contract: LH2TankThermoMultiphaseContract) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "LH2_TANK_ORACLE_NOT_REGISTERED",
            "scenario_type": "LH2_TANK_THERMO_MULTIPHASE_V1",
            "message": "LH2 tank execution is disabled until a verifiable multiphase CFD oracle is registered.",
            "contract_version": contract.contract_version,
        },
    )
