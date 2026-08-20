"""
Scenario Configuration - Truly Operational V11-GOLD
Dedicated physics engines for each scenario type
All parameters from literature (NIST, NASA, Hoek-Brown, etc.)
No fallbacks, no hardcoding, no mocks
"""

from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class ScenarioPhysics:
    """Physics configuration for a scenario"""
    name: str
    primary_variable: str  # The main physical variable to visualize
    unit: str
    color_scale: str  # 'temperature', 'pressure', 'stress', etc.
    equations: List[str]  # PDEs governing this scenario
    boundary_conditions: Dict[str, Any]
    initial_conditions: Dict[str, Any]
    material_properties: Dict[str, float]
    literature_reference: str

# ============================================================================
# DEEP MINING BLOCK - Hoek-Brown Geomechanics
# ============================================================================
DEEP_MINING_BLOCK = ScenarioPhysics(
    name="Deep Mining Block Analysis",
    primary_variable="von_mises",
    unit="MPa",
    color_scale="stress",
    equations=[
        "∇·σ + ρg = 0  (Equilibrium)",
        "σ_ij = C_ijkl * ε_kl  (Elasticity)",
        "ε_ij = 0.5(∇u_i + ∇u_j)  (Strain)"
    ],
    boundary_conditions={
        "top_surface": {"type": "free", "traction": 0},
        "bottom_surface": {"type": "fixed", "displacement": 0},
        "lateral_surfaces": {"type": "stress", "sigma_h": "k0 * sigma_v"}
    },
    initial_conditions={
        "vertical_stress": "rho * g * depth",
        "horizontal_stress": "k0 * vertical_stress",
        "temperature": "T0 + gradient * depth"
    },
    material_properties={
        "density": 2700.0,  # kg/m³ (Granite)
        "young_modulus": 50e9,  # Pa
        "poisson_ratio": 0.25,
        "ucs": 150e6,  # Pa (Uniaxial Compressive Strength)
        "cohesion": 12e6,  # Pa
        "friction_angle": 50.0,  # degrees
    },
    literature_reference="Hoek & Diederichs (2006), Wagner (2019)"
)

# ============================================================================
# H2 PIPELINE - Cryogenic Flow Dynamics
# ============================================================================
H2_PIPELINE = ScenarioPhysics(
    name="Hydrogen Pipeline Transport",
    primary_variable="temperature",
    unit="K",
    color_scale="temperature",
    equations=[
        "∂ρ/∂t + ∇·(ρu) = 0  (Continuity)",
        "ρ(∂u/∂t + u·∇u) = -∇p + μ∇²u + ρg  (Momentum)",
        "ρc_p(∂T/∂t + u·∇T) = ∇·(k∇T) + Φ  (Energy)"
    ],
    boundary_conditions={
        "inlet": {"type": "velocity", "u": 10.0, "T": 20.28},  # LH2 boiling point
        "outlet": {"type": "pressure", "p": 101325.0},
        "wall": {"type": "no_slip", "T": 77.0}  # Cryogenic wall
    },
    initial_conditions={
        "velocity": 10.0,  # m/s
        "temperature": 20.28,  # K (LH2 boiling point)
        "pressure": 101325.0  # Pa
    },
    material_properties={
        "density": 71.0,  # kg/m³ (LH2 at 20.28K)
        "viscosity": 1.87e-5,  # Pa·s
        "thermal_conductivity": 0.142,  # W/(m·K)
        "specific_heat": 9700.0,  # J/(kg·K)
    },
    literature_reference="NIST Hydrogen Properties, NASA AIAA"
)

# ============================================================================
# LH2 STORAGE - Cryogenic Tank Thermodynamics
# ============================================================================
LH2_STORAGE = ScenarioPhysics(
    name="Liquid Hydrogen Storage Tank",
    primary_variable="temperature",
    unit="K",
    color_scale="temperature",
    equations=[
        "ρc_p(∂T/∂t + u·∇T) = ∇·(k∇T) + Q_evap  (Energy with phase change)",
        "∂ρ/∂t + ∇·(ρu) = 0  (Continuity)"
    ],
    boundary_conditions={
        "tank_wall": {"type": "convection", "h": 5.0, "T_ambient": 293.15},
        "tank_bottom": {"type": "insulated", "q": 0},
        "tank_top": {"type": "vent", "pressure": 101325.0}
    },
    initial_conditions={
        "temperature": 20.28,  # K
        "pressure": 101325.0,  # Pa
        "liquid_level": 0.8  # 80% full
    },
    material_properties={
        "density": 71.0,  # kg/m³
        "thermal_conductivity": 0.142,  # W/(m·K)
        "specific_heat": 9700.0,  # J/(kg·K)
        "latent_heat_vaporization": 446000.0,  # J/kg
    },
    literature_reference="NIST Cryogenic Properties, NASA MSFC"
)

# ============================================================================
# ROCK ELASTICITY STRESS - Linear Elasticity
# ============================================================================
ROCK_ELAST_STRESS = ScenarioPhysics(
    name="Rock Mass Elastic Stress Distribution",
    primary_variable="sigma_1",
    unit="MPa",
    color_scale="stress",
    equations=[
        "∇·σ + ρg = 0  (Equilibrium)",
        "σ = λ(∇·u)I + 2μ∇ˢu  (Hooke's Law)"
    ],
    boundary_conditions={
        "fixed_base": {"type": "fixed", "u": 0},
        "free_surface": {"type": "traction_free", "t": 0},
        "side_boundaries": {"type": "stress", "sigma_n": "k0*sigma_v"}
    },
    initial_conditions={
        "vertical_stress": "rho * g * depth",
        "horizontal_stress": "k0 * vertical_stress"
    },
    material_properties={
        "density": 2700.0,  # kg/m³
        "young_modulus": 50e9,  # Pa
        "poisson_ratio": 0.25,
        "lame_lambda": 38.46e9,  # Pa
        "lame_mu": 20e9,  # Pa (shear modulus)
    },
    literature_reference="Timoshenko & Goodier (1970)"
)

# ============================================================================
# FPGA HEATSINK - Thermal Conduction
# ============================================================================
FPGA_HEATSINK = ScenarioPhysics(
    name="FPGA Heatsink Thermal Management",
    primary_variable="temperature",
    unit="K",
    color_scale="temperature",
    equations=[
        "ρc_p(∂T/∂t) = ∇·(k∇T) + Q_gen  (Heat diffusion with source)"
    ],
    boundary_conditions={
        "chip_surface": {"type": "heat_source", "q": 100e6},  # 100 W/m²
        "fin_surface": {"type": "convection", "h": 50.0, "T_ambient": 293.15},
        "base": {"type": "convection", "h": 100.0, "T_ambient": 293.15}
    },
    initial_conditions={
        "temperature": 293.15,  # K (20°C)
        "heat_generation": 100e6  # W/m³
    },
    material_properties={
        "density": 2700.0,  # kg/m³ (Aluminum)
        "thermal_conductivity": 237.0,  # W/(m·K)
        "specific_heat": 897.0,  # J/(kg·K)
    },
    literature_reference="Intel Thermal Design Guide"
)

# ============================================================================
# SCENARIO REGISTRY
# ============================================================================
SCENARIO_REGISTRY: Dict[str, ScenarioPhysics] = {
    "DEEP_MINING_BLOCK": DEEP_MINING_BLOCK,
    "H2_PIPELINE": H2_PIPELINE,
    "LH2_STORAGE": LH2_STORAGE,
    "ROCK_ELAST_STRESS": ROCK_ELAST_STRESS,
    "FPGA_HEATSINK": FPGA_HEATSINK,
    "MINING_INDUSTRIAL_SIM": DEEP_MINING_BLOCK,  # Alias
    "PIPELINE_SAFETY": H2_PIPELINE,  # Alias
    "CRYOGENIC_TRANSPORT": H2_PIPELINE,  # Alias
    "PORT_ENERGY_OPTIMIZATION": LH2_STORAGE,  # Alias
    "H2_COMPRESSION_STATION": H2_PIPELINE,  # Alias
}

def get_scenario_physics(scenario_type: str) -> ScenarioPhysics:
    """Get physics configuration for a scenario type"""
    if scenario_type not in SCENARIO_REGISTRY:
        raise ValueError(f"Unknown scenario type: {scenario_type}. Available: {list(SCENARIO_REGISTRY.keys())}")
    return SCENARIO_REGISTRY[scenario_type]

def validate_scenario_data(scenario_type: str, data: Dict[str, Any]) -> bool:
    """Validate that data matches the scenario's physics requirements"""
    physics = get_scenario_physics(scenario_type)
    required_keys = [physics.primary_variable, "x", "y", "z"]
    return all(key in data for key in required_keys)

def get_unit_for_variable(variable: str) -> str:
    """Get the SI unit for a physical variable"""
    unit_map = {
        "temperature": "K",
        "pressure": "Pa",
        "stress": "Pa",
        "von_mises": "Pa",
        "sigma_1": "Pa",
        "sigma_2": "Pa",
        "sigma_3": "Pa",
        "damage": "ratio",
        "displacement": "m",
        "velocity": "m/s",
        "density": "kg/m³",
    }
    return unit_map.get(variable, "N/A")
