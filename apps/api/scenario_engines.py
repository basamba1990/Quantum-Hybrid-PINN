"""
Moteurs de simulation industrielle - Équations physiques réalistes
Optimisés pour la précision industrielle mondiale.
"""

import math
import numpy as np
from typing import Dict, Any

# ============================================================================
# CONSTANTES PHYSIQUES (VALEURS OFFICIELLES NIST/NASA)
# ============================================================================

R_UNIV = 8.314462618  # J/(mol·K)
G = 9.80665           # m/s²

# Hydrogène (H2)
M_H2 = 0.00201588     # kg/mol
R_H2 = R_UNIV / M_H2  # 4124.49 J/(kg·K)
MU_H2_BASE = 8.76e-6  # Pa·s à 293K
K_H2 = 0.1815         # W/(m·K)
CP_H2 = 14304         # J/(kg·K)

# ============================================================================
# FONCTIONS PHYSIQUES AVANCÉES
# ============================================================================

def get_viscosity_h2(T: float) -> float:
    """Sutherland's law pour la viscosité de l'hydrogène."""
    T0 = 293.15
    mu0 = 8.76e-6
    S = 72.0
    return mu0 * ((T/T0)**1.5) * (T0 + S) / (T + S)

def colebrook_white(Re: float, epsilon_D: float) -> float:
    """Calcul itératif précis du facteur de friction de Darcy-Weisbach."""
    if Re < 2300: return 64 / (Re + 1e-10)
    # Approximation initiale (Haaland)
    f = (1.8 * math.log10((epsilon_D/3.7)**1.11 + 6.9/Re))**-2
    # Raffinement Newton-Raphson
    for _ in range(3):
        f_sqrt = math.sqrt(f)
        arg = (epsilon_D/3.7) + 2.51/(Re * f_sqrt)
        if arg <= 0: break
        f = (f_sqrt - (f_sqrt + 2.0 * math.log10(arg)) / (1.0 + 2.51 / (Re * f_sqrt * arg * math.log(10))))**-2
    return f

# ============================================================================
# MOTEURS DE SCÉNARIOS (VERSION INDUSTRIELLE)
# ============================================================================

def run_pipeline_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Simulation de pipeline avec chute de pression Darcy-Weisbach et thermique réelle."""
    L = inputs.get('length', 100) * 1000.0
    D = inputs.get('diameter', 0.5)
    P_in = inputs.get('pressure', 80) * 1e5
    T_in = inputs.get('temperature', 300)
    m_dot = inputs.get('flowRate', 10.0) # kg/s
    
    # Propriétés locales
    mu = get_viscosity_h2(T_in)
    rho = P_in / (R_H2 * T_in) # Gaz parfait pour l'estimation initiale
    A = math.pi * (D/2)**2
    v = m_dot / (rho * A)
    Re = rho * v * D / mu
    
    # Friction (Acier industriel : 45 micromètres)
    epsilon = 4.5e-5
    f = colebrook_white(Re, epsilon/D)
    
    # Chute de pression (Pa)
    delta_P = f * (L/D) * (rho * v**2 / 2.0)
    
    # Thermique (Coefficient global de transfert U = 5 W/m²K pour sol enterré)
    U = 5.0
    area = math.pi * D * L
    T_ground = 288.15 # 15°C
    # NTU (Number of Transfer Units)
    ntu = (U * area) / (m_dot * CP_H2)
    T_out = T_ground + (T_in - T_ground) * math.exp(-ntu)
    
    # Score de sécurité basé sur la contrainte de paroi (Hoop Stress)
    # Sigma = P * D / (2 * t)
    thickness = 0.015 # 15mm
    hoop_stress = (P_in * D) / (2 * thickness)
    yield_strength = 450e6 # X65 Steel
    safety_factor = yield_strength / hoop_stress
    safety_score = min(100, safety_factor * 20)

    return {
        "pressureDrop": round(delta_P / 1e5, 3),
        "velocity": round(v, 2),
        "turbulence": round(min(100, (Re/1e7)**0.5 * 100), 1),
        "thermalStability": round(T_out, 1),
        "leakRisk": round(max(0, 100 - safety_score), 2),
        "safetyScore": round(safety_score, 1)
    }

def run_lh2_storage_scenario(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Stockage Cryogénique LH2 avec modélisation du Boil-Off (BOG)."""
    V = inputs.get('volume', 100)
    P_tank = inputs.get('pressure', 1.5) * 1e5
    T_liq = 20.3 # K
    T_amb = inputs.get('ambientTemp', 300)
    
    # Rayon du réservoir sphérique
    R = (3 * V / (4 * math.pi))**(1/3)
    Area = 4 * math.pi * R**2
    
    # Isolation (MLI - Multi-Layer Insulation)
    k_ins = 0.0001 # W/mK (Haute performance)
    d_ins = 0.1 # 10cm
    Q_heat = (k_ins * Area * (T_amb - T_liq)) / d_ins
    
    # Chaleur latente de vaporisation H2
    h_fg = 445000 # J/kg
    m_bog = Q_heat / h_fg # kg/s
    
    # Pourcentage de perte par jour
    rho_liq = 70.8 # kg/m³
    loss_day = (m_bog * 86400) / (V * rho_liq) * 100
    
    return {
        "boilOffRate": round(loss_day, 4),
        "thermalLeak": round(Q_heat, 1),
        "internalPressure": round(P_tank / 1e5, 2),
        "stabilityScore": round(max(0, 100 - loss_day * 100), 1)
    }

# Enregistrement des moteurs
SCENARIO_ENGINES = {
    "H2_PIPELINE": run_pipeline_scenario,
    "LH2_STORAGE": run_lh2_storage_scenario,
}
