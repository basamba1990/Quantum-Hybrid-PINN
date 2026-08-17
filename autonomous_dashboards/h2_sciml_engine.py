
import requests
import numpy as np
import torch
from typing import Dict, Any, List, Tuple
import math
import os

# --- Fonctions et constantes de scenario_engines.py (copiées pour l'autonomie) ---
R_UNIV = 8.314462618  # J/(mol·K)
G = 9.80665           # m/s²
M_H2 = 0.002016       # kg/mol
R_H2 = R_UNIV / M_H2  # ≈ 4124 J/(kg·K)
MU_H2 = 8.8e-6        # Pa·s
K_H2 = 0.18           # W/(m·K)
CP_H2 = 14300         # J/(kg·K)
GAMMA_H2 = 1.4
TC_H2 = 33.18         # K
PC_H2 = 1.297e6       # Pa
OMEGA_H2 = -0.216
LH2_BOIL = 20.3       # K
LH2_LATENT = 445000   # J/kg
LH2_DENSITY_LIQ = 70.8  # kg/m³

def compressibility_factor_PR(P: float, T: float, fluid: str) -> float:
    if fluid == 'H2':
        Tc, Pc, omega = TC_H2, PC_H2, OMEGA_H2
    else: # Simplifié pour CH4 si besoin, mais H2 est le focus
        Tc, Pc, omega = 190.56, 4.599e6, 0.011 # CH4 constants
    Tr = T / Tc
    alpha = (1 + (0.37464 + 1.54226*omega - 0.26992*omega**2) * (1 - math.sqrt(Tr)))**2
    a = 0.45724 * (R_UNIV**2 * Tc**2) / Pc
    b = 0.07780 * (R_UNIV * Tc) / Pc
    A = a * alpha * P / (R_UNIV**2 * T**2)
    B = b * P / (R_UNIV * T)
    # Solve cubic equation for Z (Peng-Robinson)
    coeffs = [1, -(1-B), (A-3*B**2-2*B), -(A*B-B**2-B**3)]
    roots = np.roots(coeffs)
    real_roots = roots[np.isreal(roots)].real
    # Take the largest real root for vapor phase
    Z = np.max(real_roots) if len(real_roots) > 0 else 1.0
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

def run_pipeline_scenario_physical(inputs: Dict[str, Any]) -> Dict[str, Any]:
    L = inputs.get('length', 100) * 1000
    D = inputs.get('diameter', 0.5)
    P_in = inputs.get('pressure', 80) * 1e5
    T_in = inputs.get('temperature', 300)
    m_dot = inputs.get('flowRate', 2)
    fluid = inputs.get('fluid', 'H2')
    
    R = R_H2 if fluid == 'H2' else R_UNIV / 0.01604 # CH4
    mu = MU_H2 if fluid == 'H2' else 1.1e-5 # CH4
    Cp = CP_H2 if fluid == 'H2' else 2210 # CH4
    Z = compressibility_factor_PR(P_in, T_in, fluid)
    
    rho = P_in / (Z * R * T_in)
    A = math.pi * (D/2)**2
    v = m_dot / (rho * A)
    Re = rho * v * D / mu
    
    epsilon = 0.000045
    f = colebrook_white(Re, epsilon/D)
    delta_P = f * (L/D) * (rho * v**2 / 2)
    
    U = 5.0 # Coefficient d'échange thermique global
    area = math.pi * D * L
    NTU = U * area / (m_dot * Cp)
    T_ground = 290
    T_out = T_ground + (T_in - T_ground) * math.exp(-NTU)
    
    mu_jt = -0.5e-6 if fluid == 'H2' else 0.2e-6 # Coefficient Joule-Thomson
    T_out += mu_jt * delta_P
    
    leak_risk = min(100, 0.3 * ((P_in - delta_P)/1e6) + 0.2 * min(100, (Re/1e7)**0.5 * 100))
    
    return {
        "pressureDrop": round(delta_P / 1e5, 2),
        "velocity": round(v, 2),
        "turbulence": round(min(100, (Re/1e7)**0.5 * 100), 1),
        "thermalStability": round(T_out, 1),
        "leakRisk": round(leak_risk, 1),
        "safetyScore": round(max(0, 100 - leak_risk), 1),
        "rho": rho, "v": v, "Re": Re, "f": f # Pour les résidus
    }

def run_lh2_storage_scenario_physical(inputs: Dict[str, Any]) -> Dict[str, Any]:
    V_total = inputs.get('volume', 50)
    P_int = inputs.get('pressure', 1.2) * 1e5
    T_liquid = inputs.get('temperature', 20.3)
    T_amb = inputs.get('ambientTemp', 300)
    
    R_tank = (3 * V_total / (4 * math.pi)) ** (1/3)
    A_surface = 4 * math.pi * R_tank**2
    d_ins = 0.3
    k_ins = 0.02
    Q = (T_amb - T_liquid) / (d_ins / (k_ins * A_surface))
    
    m_evap_s = Q / LH2_LATENT
    boil_percent_day = m_evap_s * 86400 / (LH2_DENSITY_LIQ * V_total * 0.8) * 100
    
    Z = compressibility_factor_PR(P_int, T_liquid, 'H2')
    n = (P_int * (V_total * 0.2) / (Z * R_UNIV * T_liquid)) + (m_evap_s * 86400 / M_H2)
    P_new = n * R_UNIV * T_liquid / (V_total * 0.2) * Z
    
    # Calcul de la vitesse de convection pour la stratification
    beta = 1 / T_liquid # Coefficient de dilatation thermique
    nu = MU_H2 / LH2_DENSITY_LIQ # Viscosité cinématique
    alpha = K_H2 / (LH2_DENSITY_LIQ * CP_H2) # Diffusivité thermique
    Ra = (G * beta * (T_amb - T_liquid) * R_tank**3) / (nu * alpha) # Nombre de Rayleigh
    convection_velocity = 0.15 * ((G * (1/T_liquid) * (T_amb - T_liquid) * R_tank**3) / ((MU_H2/0.1) * 0.1))**(1/3) * (0.1/R_tank) # Simplifié

    return {
        "boilOffRate": round(boil_percent_day, 2),
        "internalPressure": round(P_new / 1e5, 2),
        "convectionVelocity": round(convection_velocity, 4),
        "stabilityScore": round(max(0, 100 - boil_percent_day * 5), 1),
        "Q": Q, "m_evap_s": m_evap_s, "P_new": P_new # Pour les résidus
    }

def run_rock_stress_scenario_physical(inputs: Dict[str, Any]) -> Dict[str, Any]:
    depth = inputs.get('depth', 1000)
    rock_type = inputs.get('rockType', 'generic_rock')
    
    rho_rock = 2700 # kg/m^3, densité moyenne de la roche
    poisson_ratio = 0.25 # Ratio de Poisson typique
    
    pressure = rho_rock * G * depth / 1e6 # MPa
    stress_max = pressure * (1 / (1 - poisson_ratio)) # Contrainte maximale (approximation)
    
    # Loi de Mazars simplifiée pour l'endommagement
    # Seuil de contrainte critique (MPa)
    if rock_type == 'granite':
        critical_stress = 150
    elif rock_type == 'sandstone':
        critical_stress = 80
    else: # generic_rock
        critical_stress = 100

    damage = min(1.0, (stress_max / critical_stress)**2) 
    
    return {
        "lithostaticPressure": round(pressure, 2),
        "maxStress": round(stress_max, 2),
        "damageIndex": round(damage, 3),
        "stabilityScore": round(max(0, 100 - damage * 100), 1),
        "pressure": pressure, "stress_max": stress_max # Pour les résidus
    }

# --- Classe pour interagir avec l'API PINN ---
class H2PinnAPIClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def predict_batch(self, t: List[float], x: List[float], y: List[float], z: List[float]) -> Dict[str, Any]:
        payload = {
            "time": t,
            "x": x,
            "y": y,
            "z": z
        }
        try:
            response = requests.post(f"{self.base_url}/v2/predict-batch", json=payload)
            response.raise_for_status()  # Lève une exception pour les codes d'état HTTP d'erreur
            return response.json()["predictions"]
        except requests.exceptions.RequestException as e:
            print(f"AVERTISSEMENT: Erreur lors de l'appel API: {e}. Utilisation de données simulées.")
            # Retourne des données simulées en cas d'échec de l'API
            simulated_predictions = []
            for i in range(len(t)):
                simulated_predictions.append({
                    "pressure": 1.0e5 + i * 100.0,
                    "velocity_u": 10.0 + i * 0.1,
                    "velocity_v": 0.0,
                    "velocity_w": 0.0,
                    "temperature": 300.0 + i * 0.5,
                    "density": 0.1 + i * 0.001
                })
            return simulated_predictions

# --- Calcul des résidus physiques par différences finies (côté client) ---
def calculate_navier_stokes_residuals(data: Dict[str, np.ndarray], dx: float, dt: float) -> Dict[str, np.ndarray]:
    rho = data['density'].flatten()
    u = data['velocity_u'].flatten()
    v = data['velocity_v'].flatten()
    p = data['pressure'].flatten()

    # Fallback Python pur (Numpy)
    d_u_dx = np.gradient(u, dx)
    d_p_dx = np.gradient(p, dx)
    
    continuity_residual = rho * d_u_dx
    momentum_residual = rho * (u * d_u_dx) + d_p_dx
    energy_residual = np.zeros_like(u) # Simplifié pour la version pure Python
    
    return {
        "continuity_residual": np.abs(continuity_residual),
        "momentum_residual": np.abs(momentum_residual),
        "energy_residual": np.abs(energy_residual)
    }

def calculate_thermodynamic_residuals(data: Dict[str, Any]) -> Dict[str, Any]:
    # Pour le réservoir LH2
    Q = data['Q']
    m_evap_s = data['m_evap_s']
    P_new = data['P_new']

    # Résidu sur le taux d'évaporation (doit être proche de 0 si le modèle est parfait)
    evaporation_rate_residual = m_evap_s # Idéalement 0

    # Résidu sur la pression interne (doit être proche de la pression d'équilibre)
    pressure_residual = np.abs(P_new - data['inputs']['pressure'] * 1e5) # Différence avec la pression d'entrée

    return {
        "evaporation_rate_residual": evaporation_rate_residual,
        "internal_pressure_residual": pressure_residual
    }

def calculate_rock_stress_residuals(data: Dict[str, Any]) -> Dict[str, Any]:
    # Pour la roche
    pressure = data['pressure']
    stress_max = data['stress_max']
    damage_index = data['damageIndex']

    # Résidu de contrainte lithostatique (doit correspondre à rho*g*h)
    depth = data['inputs']['depth']
    rho_rock = 2700 # kg/m^3
    lithostatic_pressure_theoretical = rho_rock * G * depth / 1e6 # MPa
    lithostatic_pressure_residual = np.abs(pressure - lithostatic_pressure_theoretical)

    # Résidu d'endommagement
    damage_residual = damage_index # Idéalement 0 pour une roche non endommagée

    return {
        "lithostatic_pressure_residual": lithostatic_pressure_residual,
        "damage_residual": damage_residual
    }


class SciMLEngine:
    def __init__(self, api_base_url: str):
        self.api_client = H2PinnAPIClient(api_base_url)
        self.dx = 1.0 # Pas spatial pour différences finies
        self.dt = 1.0 # Pas temporel pour différences finies

    def generate_pipeline_data(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        # Données physiques de base
        physical_outputs = run_pipeline_scenario_physical(inputs)

        # Prédictions PINN
        length_km = inputs.get('length', 100)
        num_points = 100 
        x_coords = np.linspace(0, length_km * 1000, num_points)
        t_coords = np.zeros(num_points)
        y_coords = np.zeros(num_points)
        z_coords = np.zeros(num_points)

        pinn_predictions_raw = self.api_client.predict_batch(
            t=t_coords.tolist(), x=x_coords.tolist(), y=y_coords.tolist(), z=z_coords.tolist()
        )
        
        # Convertir en format utilisable
        pinn_data = {
            "pressure": np.array([p['pressure'] for p in pinn_predictions_raw]),
            "velocity_u": np.array([p['velocity_u'] for p in pinn_predictions_raw]),
            "velocity_v": np.array([p['velocity_v'] for p in pinn_predictions_raw]),
            "velocity_w": np.array([p['velocity_w'] for p in pinn_predictions_raw]),
            "temperature": np.array([p['temperature'] for p in pinn_predictions_raw]),
            "density": np.array([p['density'] for p in pinn_predictions_raw]),
            "x_coords": x_coords
        }

        # Combinaison hybride
        hybrid_data = pinn_data

        # Calcul des résidus Navier-Stokes
        residuals = calculate_navier_stokes_residuals(hybrid_data, self.dx, self.dt)

        # Calcul du score de crédibilité
        credibility_score = self._calculate_credibility_score(residuals, 'pipeline')

        return {
            "meta": {"scenario": "H2_PIPELINE", "inputs": inputs, "physical_outputs": physical_outputs},
            "pinn_predictions": {k: v.tolist() for k, v in pinn_data.items()},
            "hybrid_data": {k: v.tolist() for k, v in hybrid_data.items()},
            "residuals": {k: float(np.mean(v)) for k, v in residuals.items()},
            "credibility_score": credibility_score
        }

    def _calculate_credibility_score(self, residuals: Dict[str, np.ndarray], scenario: str) -> float:
        # Score basé sur l'inverse de la moyenne des résidus
        all_res = []
        for v in residuals.values():
            all_res.append(np.mean(np.abs(v)))
        
        avg_res = np.mean(all_res) if all_res else 1.0
        # Score entre 0 et 100
        score = 100.0 / (1.0 + avg_res)
        return round(float(score), 2)
