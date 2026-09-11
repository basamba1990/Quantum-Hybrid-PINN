"""Versioned contract for the real LH2 tank thermo-multiphase case."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class LH2OracleReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    solver: str = Field(min_length=2)
    solver_version: str = Field(min_length=1)
    run_id: str = Field(min_length=8)
    mesh_uri: str = Field(pattern=r"^https?://")
    fields_uri: str = Field(pattern=r"^https?://")
    checksum_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class LH2TankThermoMultiphaseContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: Literal["lh2-tank-thermo-multiphase.v1"] = "lh2-tank-thermo-multiphase.v1"
    volume_l: float = Field(gt=0, le=1000)
    cylindrical_diameter_m: float = Field(gt=0, le=2)
    cylindrical_height_m: float = Field(gt=0, le=3)
    upper_dome_height_m: float = Field(gt=0, le=1)
    lower_dome_height_m: float = Field(gt=0, le=1)
    wall_material: Literal["aluminium_2219"]
    wall_thickness_m: float = Field(gt=0, le=0.1)
    insulation_material: Literal["polyurethane_foam"]
    insulation_thickness_m: Literal[0.01, 0.02, 0.03]
    initial_fill_fraction: float = Field(gt=0, lt=1)
    initial_pressure_pa: float = Field(gt=0, le=2_000_000)
    initial_temperature_k: float = Field(gt=14, lt=40)
    external_wind_speed_m_s: float = Field(ge=0, le=100)
    reference_mesh_cells: int = Field(gt=0, le=10_000_000)
    multiphase_model: Literal["vof"]
    interface_model: Literal["csf"]
    phase_change_model: Literal["ranz_marshall"]
    property_source: Literal["nist_tables"]
    oracle: LH2OracleReference
