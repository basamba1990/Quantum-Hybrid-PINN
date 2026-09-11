"""Strict, versioned contract for the five-way coolant valve case."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PortCondition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    port: Literal["stack", "cod_heater", "ion_filter", "radiator", "pump"]
    mass_flow_kg_s: float = Field(gt=0)
    temperature_k: float = Field(gt=200, lt=450)
    pressure_pa: float = Field(gt=0)


class RotationProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    initial_angle_deg: float = Field(ge=0, le=360)
    final_angle_deg: float = Field(ge=0, le=360)
    angular_speed_deg_s: float = Field(gt=0, le=10000)
    direction: Literal["clockwise", "counterclockwise"]
    duration_s: float = Field(gt=0, le=3600)


class CFDOracleReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    solver: str = Field(min_length=2)
    solver_version: str = Field(min_length=1)
    run_id: str = Field(min_length=8)
    mesh_uri: str = Field(pattern=r"^https?://")
    fields_uri: str = Field(pattern=r"^https?://")
    checksum_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class PCCVTransientContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: Literal["pccv-transient-thermo.v1"] = "pccv-transient-thermo.v1"
    geometry_uri: str = Field(pattern=r"^https?://")
    geometry_checksum_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    coolant: Literal["water_glycol"]
    density_kg_m3: float = Field(gt=900, lt=1300)
    dynamic_viscosity_pa_s: float = Field(gt=0, lt=0.1)
    specific_heat_j_kg_k: float = Field(gt=1000, lt=10000)
    thermal_conductivity_w_m_k: float = Field(gt=0, lt=10)
    rotation: RotationProfile
    inlet_conditions: list[PortCondition] = Field(min_length=1, max_length=5)
    outlet_pressure_pa: float = Field(gt=0)
    ambient_temperature_k: float = Field(gt=200, lt=450)
    oracle: CFDOracleReference

    @field_validator("inlet_conditions")
    @classmethod
    def unique_ports(cls, values: list[PortCondition]) -> list[PortCondition]:
        ports = [item.port for item in values]
        if len(set(ports)) != len(ports):
            raise ValueError("inlet_conditions contains duplicate ports")
        return values
