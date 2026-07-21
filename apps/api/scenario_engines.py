"""
Moteurs de simulation industrielle - Équations physiques réalistes
pour les 8+ scénarios : pipeline H₂/GNL, stockage LH₂, optimisation portuaire,
sécurité pipeline, transport cryogénique, ventilation minière, FPGA Heatsink, Deep Mining Block.
"""

import math
import numpy as np
from typing import Dict, Any, List
from fpga_heatsink_engine import run_fpga_heatsink_scenario, generate_fpga_predictions_3d
from deep_mining_engine import run_deep_mining_scenario, generate_deep_mining_predictions_3d

# ============================================================================
# CONSTANTES PHYSIQUES
# ============================================================================

R_UNIV = 8.314462618  # J/(mol·K)
G = 9.80665           # m/s²

# Hydrogène (H₂)
M_H2 = 0.002016       # kg/mol
R_H2 = R_UNIV / M_H2  # ≈ 4124 J/(kg·K)
MU_H2 = 8.8e-6        # Pa·s
K_H2 = 0.18           # W/(m·K)
CP_H2 = 14300         # J/(kg·K)
GAMMA_H2 = 1.4
TC_H2 = 33.18         # K
PC_H2 = 1.297e6       # Pa
OMEGA_H2 = -0.216

# Méthane (CH₄)
M_CH4 = 0.01604
R_CH4 = R_UNIV / M_CH4
MU_CH4 = 1.1e-5
CP_CH4 = 2210
GAMMA_CH4 = 1.31
TC_CH4 = 190.56
PC_CH4 = 4.599e6
OMEGA_CH4 = 0.011

# Propriétés cryogéniques
LH2_BOIL = 20.3       # K
LH2_LATENT = 445000   # J/kg
LH2_DENSITY_LIQ = 70.8  # kg/m³
GNL_BOIL = 111.7
GNL_LATENT = 510000
GNL_DENSITY_LIQ = 425

# FPGA Heatsink - Air properties
AIR_VISCOSITY = 1.84e-5
AIR_DENSITY = 1.1614
AIR_SPECIFIC_HEAT = 1005
AIR_CONDUCTIVITY = 0.0261
AIR_PRANDTL = 0.71

# ============================================================================
# FONCTIONS AUXILIAIRES
# ============================================================================

def compressibility_factor_PR(P: float, T: float, fluid: str) -> float:
    if fluid == 'H2':
        Tc, Pc, omega = TC_H2, PC_H2, OMEGA_H2
    else:
        Tc, Pc, omega = TC_CH4, PC_CH4, OMEGA_CH4
    Tr = T / Tc
    alpha = (1 + (0.37464 + 1.54226*omega - 0.26992*omega**2) * (1 - math.sqrt(Tr)))**2
    a = 0.45724 * (R_UNIV**2 * Tc**2) / Pc
    b = 0.07780 * (R_UNIV * Tc) / Pc
    A = a * alpha * P / (R_UNIV**2 * T**2)
    B = b * P / (R_UNIV * T)
    Z = 1 + B - A * B / (1 + 2*B - B**2)
    return max(0.5, min(1.5, Z))

def colebrook_white(Re: float, epsilon_D: float) -> float:
    if Re < 2300: return 64 / (Re + 1e-10)
    f = 0.25 / (math.log10(epsilon_D/3.7 + 5.74/Re**0.9))**2
    for _ in range(5):
        f_inv_sqrt = 1 / math.sqrt(f)
        arg = epsilon_D/3.7 + 2.51/(Re * math.sqrt(f))
        if arg <= 0: break
        f = (f_inv_sqrt - (f_inv_sqrt + 2 * math.log10(arg)) / (1 + 2.51 / (Re * math.sqrt(f) * arg * math.log(10))))**-2
    return f

# ============================================================================
# MOTEURS DE SCÉNARIOS
# ============================================================================

def run_pipeline_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    L = inputs.get('length', 100) * 1000
    D = inputs.get('diameter', 0.5)
    P_in = inputs.get('pressure', 80) * 1e5
    T_in = inputs.get('temperature', 300)
    m_dot = inputs.get('flowRate', 2)
    fluid = inputs.get('fluid', 'H2')
    
    R = R_H2 if fluid == 'H2' else R_CH4
    mu = MU_H2 if fluid == 'H2' else MU_CH4
    Cp = CP_H2 if fluid == 'H2' else CP_CH4
    Z = compressibility_factor_PR(P_in, T_in, fluid)
    
    rho = P_in / (Z * R * T_in)
    A = math.pi * (D/2)**2
    v = m_dot / (rho * A)
    Re = rho * v * D / mu
    
    epsilon = 0.000045
    f = colebrook_white(Re, epsilon/D)
    delta_P = f * (L/D) * (rho * v**2 / 2)
    
    # Échange thermique sol
    T_soil = inputs.get('soil_temperature', 273)
    T_out = T_soil + (T_in - T_soil) * math.exp(-0.001 * L / (rho * Cp * v * D))
    
    risk_factor = max(0, min(1, (Re - 1e6) / 1e7))
    
    return {
        "pressureDrop": round(delta_P / 1e5, 2),
        "outletTemperature": round(T_out, 1),
        "reynoldsNumber": round(Re, 0),
        "velocity": round(v, 2),
        "riskFactor": round(risk_factor * 100, 1),
        "compressibilityFactor": round(Z, 4),
        "massFlowRate": round(m_dot, 2),
        "fluidType": fluid
    }

def run_lh2_storage_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    T_env = inputs.get('environmental_temp', 293)
    T_storage = inputs.get('storage_temp', 20.28)
    volume = inputs.get('volume', 1000)
    insulation = inputs.get('insulation_thickness', 0.3)
    cargo = inputs.get('cargo_type', 'LH2')
    
    k_ins = 0.02  # W/(m·K) for cryogenic insulation
    surface_area = 4 * math.pi * ((3 * volume / (4 * math.pi)) ** (2/3))
    Q = k_ins * surface_area * (T_env - T_storage) / insulation
    
    latent = LH2_LATENT if cargo == 'LH2' else GNL_LATENT
    m_evap = (Q * 24 * 3600) / latent
    
    return {
        "thermalLoss": round(Q, 0),
        "evaporationLoss": round(m_evap, 1),
        "containerSafety": round(max(0, 100 - (m_evap/100)*20), 1),
        "storageTemperature": round(T_storage, 1),
        "pressureBuildup": round(Q * 0.01, 2)
    }

def run_port_energy_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    energy_demand = inputs.get('energy_demand', 500)
    h2_supply = inputs.get('h2_supply', 200)
    renewable = inputs.get('renewable_share', 0.4)
    
    grid_deficit = max(0, energy_demand - h2_supply - energy_demand * renewable)
    carbon_savings = (h2_supply / energy_demand) * 0.8 * 100
    
    return {
        "energyBalance": round(energy_demand - h2_supply, 0),
        "gridDeficit": round(grid_deficit, 0),
        "carbonSavings": round(carbon_savings, 1),
        "efficiencyScore": round(min(100, (h2_supply/energy_demand)*100 + renewable*30), 1)
    }

def run_pipeline_safety_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    length = inputs.get('length', 100) * 1000
    sensors = inputs.get('sensors_count', 50)
    pressure = inputs.get('pressure', 80) * 1e5
    temperature = inputs.get('temperature', 300)
    
    detection_time = 5 + (length / 10000) * 2
    false_positive_rate = max(0.01, 0.05 - sensors * 0.0005)
    leak_probability = 0.001 * (pressure / 1e6) * (1 + temperature / 1000)
    
    return {
        "detectionTime": round(detection_time, 1),
        "falsePositiveRate": round(false_positive_rate * 100, 2),
        "leakProbability": round(leak_probability * 100, 3),
        "safetyIndex": round(max(0, 100 - leak_probability * 1000 - false_positive_rate * 100), 1)
    }

def run_cryogenic_transport_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    distance = inputs.get('distance', 1000)
    cargo = inputs.get('cargo_type', 'LH2')
    t_h = inputs.get('transport_hours', 24)
    Q = inputs.get('heat_leak_rate', 5)
    
    latent = LH2_LATENT if cargo == 'LH2' else GNL_LATENT
    m_evap = (Q * t_h * 3600) / latent
    
    return {
        "thermalLoss": round(Q, 0),
        "evaporationLoss": round(m_evap, 1),
        "containerSafety": round(max(0, 100 - (m_evap/100)*20), 1)
    }

def run_mining_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    mine_type = inputs.get('mineType', 'Cobalt')
    depth = inputs.get('depth', 500)
    Q_v = inputs.get('ventilationRate', 100)
    
    factors = {'Cuivre': 0.3, 'Cobalt': 0.4, 'Lithium': 0.2, 'Uranium': 0.8}
    risk = factors.get(mine_type, 0.3)
    
    T_air = 25 + (depth * 0.03) * 0.4
    aq = max(0, min(100, 100 - (0.2 / (Q_v + 1e-5)) * 100))
    
    return {
        "airQuality": round(aq, 1),
        "thermalComfort": round(T_air, 1),
        "gasSafety": round(min(100, (100 - risk*100) * (Q_v/50)**0.5), 1),
        "fluidCirculation": round(Q_v * 3600, 0)
    }

def run_rock_stress_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    depth = inputs.get('depth', 1000)
    rock_type = inputs.get('rockType', 'generic_rock')
    pressure = 0.025 * depth
    stress_max = pressure * 1.5
    damage = min(1.0, (stress_max / 50.0) ** 2)
    return {
        "lithostaticPressure": round(pressure, 2),
        "maxStress": round(stress_max, 2),
        "damageIndex": round(damage, 3),
        "stabilityScore": round(max(0, 100 - damage * 100), 1)
    }

def run_compression_station_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    P_in = inputs.get('pressure_in', 10) * 1e5
    P_out = inputs.get('pressure_out', 60) * 1e5
    T_in = inputs.get('temperature_in', 290)
    T_out = inputs.get('temperature_out', 380)
    m_dot = inputs.get('flowRate', 5)
    power_rated = inputs.get('power', 2.5) * 1e6
    eff_poly_rated = inputs.get('efficiency', 0.85)
    
    r_c = P_out / P_in
    gamma = 1.4
    k = (gamma - 1) / gamma
    T_out_isentropic = T_in * (r_c ** k)
    
    W_real = CP_H2 * (T_out - T_in) * m_dot
    W_isentropic = CP_H2 * (T_out_isentropic - T_in) * m_dot
    eff_isen_calc = W_isentropic / W_real if W_real > 0 else 0
    
    power_diff = abs(W_real - power_rated) / power_rated if power_rated > 0 else 0
    thermal_coherence = 1.0 if T_out > T_in else 0.0
    eff_coherence = 1.0 if 0.4 < eff_isen_calc < 0.98 else 0.5
    
    overall_score = 100 * thermal_coherence * eff_coherence * (1 - min(0.5, power_diff))
    
    return {
        "compressionRatio": round(r_c, 2),
        "isentropicEfficiency": round(eff_isen_calc * 100, 1),
        "powerActual": round(W_real / 1e6, 2),
        "thermalDelta": round(T_out - T_in, 1),
        "coherenceScore": round(overall_score, 1),
        "status": "ANOMALIE" if overall_score < 60 else "NORMAL"
    }

# ============================================================================
# REGISTRY DES MOTEURS
# ============================================================================

SCENARIO_ENGINES = {
    "H2_PIPELINE": run_pipeline_scenario,
    "LH2_STORAGE": run_lh2_storage_scenario,
    "PORT_ENERGY_OPTIMIZATION": run_port_energy_scenario,
    "PIPELINE_SAFETY": run_pipeline_safety_scenario,
    "CRYOGENIC_TRANSPORT": run_cryogenic_transport_scenario,
    "MINING_INDUSTRIAL_SIM": run_mining_scenario,
    "ROCK_ELAST_STRESS": run_rock_stress_scenario,
    "H2_COMPRESSION_STATION": run_compression_station_scenario,
    "FPGA_HEATSINK": run_fpga_heatsink_scenario,
    "DEEP_MINING_BLOCK": run_deep_mining_scenario,
}

# ============================================================================
# GÉNÉRATEURS 3D PAR SCÉNARIO
# ============================================================================

SCENARIO_3D_GENERATORS = {
    "FPGA_HEATSINK": generate_fpga_predictions_3d,
    "DEEP_MINING_BLOCK": generate_deep_mining_predictions_3d,
}
