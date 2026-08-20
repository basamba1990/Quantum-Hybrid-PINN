
import requests
import numpy as np
import torch
import torch.nn as nn
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


def finite_number(value: Any) -> float | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric if math.isfinite(numeric) else None

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

def run_mining_block_scenario_physical(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Analyse d'un bloc minier profond (Truly-Operational)."""
    depth = inputs.get('depth', 2000) # m
    rock_type = inputs.get('rockType', 'granite')
    
    rho_rock = 2700 if rock_type == 'granite' else 2600
    thermal_grad = 0.03 # K/m (30°C/km)
    T_surf = 288.15 # 15°C
    
    P_litho = rho_rock * G * depth / 1e6 # MPa
    T_depth = T_surf + thermal_grad * depth # K
    
    # Module d'Young et Poisson pour Granite
    E = 60e9 # Pa
    nu = 0.25
    
    # Critère de rupture de Mohr-Coulomb simplifié
    cohesion = 20e6 # Pa
    phi = 30 * (math.pi / 180) # Angle de friction
    stress_limit = (2 * cohesion * math.cos(phi)) / (1 - math.sin(phi)) + P_litho * 1e6 * (1 + math.sin(phi)) / (1 - math.sin(phi))
    safety_factor = stress_limit / (P_litho * 1e6 * 2.5) # Ratio simplifié tunnel/litho
    
    return {
        "lithostaticPressure_MPa": round(P_litho, 2),
        "ambientTemperature_K": round(T_depth, 1),
        "safetyFactor": round(min(10.0, safety_factor), 2),
        "stabilityStatus": "STABLE" if safety_factor > 1.5 else "CRITICAL",
        "rho_rock": rho_rock, "E": E, "nu": nu
    }

def run_fpga_heatsink_scenario_physical(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Analyse thermique d'un dissipateur FPGA (Truly-Operational)."""
    power = inputs.get('power', 40.0) # W
    v_air = inputs.get('airVelocity', 2.5) # m/s
    T_amb = inputs.get('ambientTemp', 298.15) # K
    
    k_alu = 167.0 # W/mK (Al 6061)
    k_air = 0.026 # W/mK
    nu_air = 1.5e-5 # m²/s
    Pr_air = 0.71
    
    # Dimensions
    L_base = 0.045 # m
    H_pin = 0.015 # m
    D_pin = 0.003 # m
    N_pins = 49 # 7x7
    
    # Convection forcée sur cylindre (Correlation de Hilpert)
    Re_d = v_air * D_pin / nu_air
    if Re_d < 4000:
        Nu = 0.683 * (Re_d**0.466) * (Pr_air**(1/3))
    else:
        Nu = 0.193 * (Re_d**0.618) * (Pr_air**(1/3))
        
    h_conv = Nu * k_air / D_pin
    
    # Efficacité de l'ailette (pin fin)
    m = math.sqrt(4 * h_conv / (k_alu * D_pin))
    eta_fin = math.tanh(m * H_pin) / (m * H_pin)
    
    # Résistance thermique totale
    A_base = L_base**2
    A_pins = N_pins * (math.pi * D_pin * H_pin)
    R_conv = 1 / (h_conv * (A_base + eta_fin * A_pins))
    
    T_junction = T_amb + power * (R_conv + 0.5) # 0.5 K/W pour TIM (Thermal Interface Material)
    
    return {
        "maxTemperature_K": round(T_junction, 1),
        "convectionCoeff_W_m2K": round(h_conv, 1),
        "thermalResistance_K_W": round(R_conv + 0.5, 3),
        "status": "SAFE" if T_junction < 358.15 else "OVERHEAT", # 85°C limit
        "h_conv": h_conv, "eta_fin": eta_fin
    }



class TransientPINNLoss(nn.Module):
    """Résidus instationnaires calculés par Autograd PyTorch.

    Le modèle doit retourner [rho, u, v, w, p, T]. Les unités et propriétés
    de transport doivent provenir du contrat de cas, jamais d'une valeur de
    démonstration injectée par le frontend.
    """

    def __init__(self, mu: float = MU_H2, k_thermal: float = K_H2, cp: float = CP_H2):
        super().__init__()
        self.mu = float(mu)
        self.k_thermal = float(k_thermal)
        self.cp = float(cp)

    @staticmethod
    def _grad(value: torch.Tensor, variable: torch.Tensor) -> torch.Tensor:
        # Une dérivée seconde d’un champ affine ne porte pas de graphe ; elle
        # vaut mathématiquement zéro et ne doit pas faire échouer Autograd.
        if not value.requires_grad:
            return torch.zeros_like(variable)
        gradient = torch.autograd.grad(
            value,
            variable,
            grad_outputs=torch.ones_like(value),
            create_graph=True,
            retain_graph=True,
            allow_unused=True,
        )[0]
        return torch.zeros_like(variable) if gradient is None else gradient

    def pointwise_terms(self, model: torch.nn.Module, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor):
        coordinates = [v.requires_grad_(True) for v in (t, x, y, z)]
        t, x, y, z = coordinates
        outputs = model(torch.cat([t, x, y, z], dim=-1))
        if outputs.shape[-1] < 6:
            raise ValueError("Le PINN-T doit retourner au moins rho, u, v, w, p, T.")
        rho, u, p, temperature = outputs[:, 0:1], outputs[:, 1:2], outputs[:, 4:5], outputs[:, 5:6]
        drho_dt, drho_dx = self._grad(rho, t), self._grad(rho, x)
        du_dt, du_dx = self._grad(u, t), self._grad(u, x)
        dp_dx = self._grad(p, x)
        dT_dt, dT_dx = self._grad(temperature, t), self._grad(temperature, x)
        d2u_dx2 = self._grad(du_dx, x)
        d2T_dx2 = self._grad(dT_dx, x)
        mass = drho_dt + u * drho_dx + rho * du_dx
        momentum = rho * (du_dt + u * du_dx) + dp_dx - self.mu * d2u_dx2
        energy = rho * self.cp * (dT_dt + u * dT_dx) - self.k_thermal * d2T_dx2
        return {
            "drho_dt": drho_dt, "drho_dx": drho_dx,
            "du_dt": du_dt, "du_dx": du_dx, "d2u_dx2": d2u_dx2,
            "dp_dx": dp_dx, "dT_dt": dT_dt, "dT_dx": dT_dx,
            "d2T_dx2": d2T_dx2, "rho": rho, "u": u,
            "mass": mass, "momentum": momentum, "energy": energy,
        }

    def pointwise_terms(self, model: torch.nn.Module, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor):
        coordinates = [v.requires_grad_(True) for v in (t, x, y, z)]
        t, x, y, z = coordinates
        outputs = model(torch.cat([t, x, y, z], dim=-1))
        if outputs.shape[-1] < 6:
            raise ValueError("Le PINN-T doit retourner au moins rho, u, v, w, p, T.")
        rho, u, p, temperature = outputs[:, 0:1], outputs[:, 1:2], outputs[:, 4:5], outputs[:, 5:6]
        drho_dt, drho_dx = self._grad(rho, t), self._grad(rho, x)
        du_dt, du_dx = self._grad(u, t), self._grad(u, x)
        dp_dx = self._grad(p, x)
        dT_dt, dT_dx = self._grad(temperature, t), self._grad(temperature, x)
        d2u_dx2 = self._grad(du_dx, x)
        d2T_dx2 = self._grad(dT_dx, x)
        mass = drho_dt + u * drho_dx + rho * du_dx
        momentum = rho * (du_dt + u * du_dx) + dp_dx - self.mu * d2u_dx2
        energy = rho * self.cp * (dT_dt + u * dT_dx) - self.k_thermal * d2T_dx2
        return {
            "drho_dt": drho_dt, "drho_dx": drho_dx,
            "du_dt": du_dt, "du_dx": du_dx, "d2u_dx2": d2u_dx2,
            "dp_dx": dp_dx, "dT_dt": dT_dt, "dT_dx": dT_dx,
            "d2T_dx2": d2T_dx2, "rho": rho, "u": u,
            "mass": mass, "momentum": momentum, "energy": energy,
        }

    def forward(self, model: torch.nn.Module, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor):
        terms = self.pointwise_terms(model, t, x, y, z)
        return {name: torch.mean(terms[name].square()) for name in ("mass", "momentum", "energy")}

# --- Classe pour interagir avec l'API PINN ---
class H2PinnAPIClient:
    def __init__(self, base_url: str, timeout_s: float = 120.0):
        self.base_url = base_url.rstrip('/')
        self.timeout_s = timeout_s

    def predict_batch(self, t: List[float], x: List[float], y: List[float], z: List[float]) -> List[Dict[str, Any]]:
        if not (len(t) == len(x) == len(y) == len(z)):
            raise ValueError("Les vecteurs t, x, y et z doivent avoir la même longueur.")
        if not t:
            return []
        payload = {"time": t, "x": x, "y": y, "z": z}
        response = requests.post(
            f"{self.base_url}/v2/predict-batch",
            json=payload,
            timeout=self.timeout_s,
        )
        response.raise_for_status()
        body = response.json()
        predictions = body.get("predictions")
        if not isinstance(predictions, list) or len(predictions) != len(t):
            raise RuntimeError("L'API PINN n'a pas retourné une prédiction par point temporel.")
        return predictions


# --- Calcul des résidus physiques par différences finies (compatibilité legacy) ---

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
        self.dx = 1.0
        self.dt = 1.0
        self.pinn_t_loss = TransientPINNLoss()
        self.fortran_bridge = None
        try:
            from apps.backend.fortran_solver.fortran_bridge import FortranPhysicsEngine
            self.fortran_bridge = FortranPhysicsEngine()
        except (ImportError, FileNotFoundError, OSError):
            # Le mode Autograd reste disponible. L'absence du .so ne doit pas
            # transformer une exécution en données synthétiques.
            self.fortran_bridge = None

    def generate_pipeline_data(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        physical_outputs = run_pipeline_scenario_physical(inputs)
        length_km = inputs.get('length', 100)
        num_points = int(inputs.get('num_points', 100))
        x_coords = np.linspace(0, length_km * 1000, num_points)
        zeros = np.zeros(num_points)
        pinn_predictions_raw = self.api_client.predict_batch(
            t=zeros.tolist(), x=x_coords.tolist(), y=zeros.tolist(), z=zeros.tolist()
        )
        pinn_data = {
            "pressure": np.array([p['pressure'] for p in pinn_predictions_raw]),
            "velocity_u": np.array([p['velocity_u'] for p in pinn_predictions_raw]),
            "velocity_v": np.array([p['velocity_v'] for p in pinn_predictions_raw]),
            "velocity_w": np.array([p['velocity_w'] for p in pinn_predictions_raw]),
            "temperature": np.array([p['temperature'] for p in pinn_predictions_raw]),
            "density": np.array([p['density'] for p in pinn_predictions_raw]),
            "x_coords": x_coords,
        }
        residuals = calculate_navier_stokes_residuals(pinn_data, self.dx, self.dt)
        return {
            "meta": {"scenario": "H2_PIPELINE", "inputs": inputs, "physical_outputs": physical_outputs},
            "pinn_predictions": {k: v.tolist() for k, v in pinn_data.items()},
            "hybrid_data": {k: v.tolist() for k, v in pinn_data.items()},
            "residuals": {k: float(np.mean(v)) for k, v in residuals.items()},
            "credibility_score": self._calculate_credibility_score(residuals, 'pipeline'),
            "residual_method": "finite_difference_legacy",
        }

    def generate_transient_series(
        self,
        scenario_type: str,
        *,
        x_coords: List[float],
        y_coords: List[float],
        z_coords: List[float],
        time_steps: List[float],
        physics: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """Interroge le PINN pour chaque (t,x,y,z), sans synthèse analytique."""
        if not x_coords or not time_steps:
            # Fallback si les coordonnées ne sont pas fournies par le frontend
            # On utilise le domaine DN50 standard (11,000 points)
            num_points = 11000
            x_coords = np.linspace(-1.275, 1.275, num_points).tolist()
            y_coords = np.zeros(num_points).tolist()
            z_coords = np.zeros(num_points).tolist()
        
        if not time_steps:
            time_steps = [0.0, 0.5, 1.0, 2.0, 5.0]

        if not (len(x_coords) == len(y_coords) == len(z_coords)):
            raise ValueError("Les coordonnées spatiales doivent avoir la même longueur.")
        
        num_spatial_points = len(x_coords)
        flat_t = np.repeat(np.asarray(time_steps, dtype=float), num_spatial_points).tolist()
        flat_x = np.tile(np.asarray(x_coords, dtype=float), len(time_steps)).tolist()
        flat_y = np.tile(np.asarray(y_coords, dtype=float), len(time_steps)).tolist()
        flat_z = np.tile(np.asarray(z_coords, dtype=float), len(time_steps)).tolist()
        
        # Inférence par batch pour tous les instants t
        predictions = self.api_client.predict_batch(flat_t, flat_x, flat_y, flat_z)
        
        frames = []
        cursor = 0
        for frame_index, time_value in enumerate(time_steps):
            frame_predictions = predictions[cursor:cursor + num_spatial_points]
            cursor += num_spatial_points
            
            points = []
            for idx, prediction in enumerate(frame_predictions):
                point = {
                    "x": float(x_coords[idx]), 
                    "y": float(y_coords[idx]), 
                    "z": float(z_coords[idx])
                }
                # Extraction des champs physiques (température, pression, etc.)
                point.update({
                    key: float(value) 
                    for key, value in prediction.items() 
                    if isinstance(value, (int, float))
                })
                points.append(point)
            
            # Les seuils et l'axe gravitaire doivent provenir du contrat de cas.
            # Sans champ de phase ou seuil thermodynamique explicite, aucune bulle
            # ni iso-surface n'est inventée : la couche est signalée indisponible.
            case_physics = physics or {}
            saturation_temperature_k = case_physics.get("saturation_temperature_k")
            danger_temperature_k = case_physics.get("danger_temperature_k")
            gravity_axis = case_physics.get("gravity_axis")
            bubble_limit = case_physics.get("bubble_limit")
            bubble_limit = int(bubble_limit) if bubble_limit is not None else 0
            phase_field_present = any(
                any(key in point for key in ("vapor_fraction", "phase_fraction", "boil_off_rate"))
                for point in points
            )
            thresholds_available = (
                finite_number(saturation_temperature_k) is not None
                and finite_number(danger_temperature_k) is not None
                and gravity_axis in {"x", "y", "z"}
                and phase_field_present
                and bubble_limit > 0
            )
            danger_mask = None
            bubbles = []
            layer_status = "unavailable_missing_case_threshold_or_phase_field"
            if thresholds_available:
                saturation_temperature_k = float(saturation_temperature_k)
                danger_temperature_k = float(danger_temperature_k)
                danger_mask = [
                    1 if finite_number(point.get("temperature")) is not None and float(point["temperature"]) >= danger_temperature_k else 0
                    for point in points
                ]
                for point in points:
                    phase_fraction = finite_number(
                        point.get("vapor_fraction", point.get("phase_fraction", point.get("boil_off_rate")))
                    )
                    temperature = finite_number(point.get("temperature"))
                    if phase_fraction is None or temperature is None or temperature < saturation_temperature_k or phase_fraction <= 0:
                        continue
                    velocity_axis = finite_number(point.get(f"velocity_{gravity_axis}"))
                    if velocity_axis is None:
                        continue
                    position = {"x": float(point["x"]), "y": float(point["y"]), "z": float(point["z"])}
                    position[gravity_axis] += velocity_axis * float(time_value)
                    bubbles.append({
                        "x": position["x"],
                        "y": position["y"],
                        "z": position["z"],
                        "radius": float(max(0.0, phase_fraction)),
                        "intensity": float(phase_fraction),
                        "source": "predicted_phase_field"
                    })
                    if len(bubbles) >= bubble_limit:
                        break
                layer_status = "available_from_predicted_phase_field"

            frame_payload = {
                "frame": frame_index,
                "time": float(time_value),
                "points": points,
                "transient_layers": {
                    "danger_mask": danger_mask,
                    "vapor_bubbles": bubbles,
                    "status": layer_status,
                },
            }
            frames.append(frame_payload)
            
        return {
            "scenario_type": scenario_type,
            "is_true_transient": True,
            "transient_source": "PINN inference at explicit (t,x,y,z) coordinates; optional layers require case thresholds and a predicted phase field",
            "time_unit": "s",
            "time_steps": [float(t) for t in time_steps],
            "total_frames": len(frames),
            "points_per_frame": num_spatial_points,
            "time_series": frames,
            "layer_contract": {
                "status": frames[0].get("transient_layers", {}).get("status"),
                "saturation_temperature_k": finite_number((physics or {}).get("saturation_temperature_k")),
                "danger_temperature_k": finite_number((physics or {}).get("danger_temperature_k")),
                "gravity_axis": (physics or {}).get("gravity_axis"),
                "bubble_limit": (physics or {}).get("bubble_limit"),
                "source": "case_contract_and_predicted_phase_field",
            },
        }

    def calculate_transient_residuals(self, model: torch.nn.Module, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor, properties: Dict[str, float] | None = None) -> Dict[str, Any]:
        """Calcule les résidus PINN-T par Autograd puis réduit éventuellement via Fortran."""
        properties = properties or {"viscosity": MU_H2, "conductivity": K_H2, "cp": CP_H2}
        loss = TransientPINNLoss(
            mu=float(properties["viscosity"]),
            k_thermal=float(properties["conductivity"]),
            cp=float(properties["cp"]),
        )
        terms = loss.pointwise_terms(model, t, x, y, z)
        if self.fortran_bridge is not None:
            n = terms["rho"].shape[0]
            constant = lambda value: np.full(n, float(value), dtype=np.float64)
            residuals = self.fortran_bridge.compute_transient_residuals(
                drho_dt=terms["drho_dt"].detach().cpu().numpy().ravel(),
                drho_dx=terms["drho_dx"].detach().cpu().numpy().ravel(),
                du_dt=terms["du_dt"].detach().cpu().numpy().ravel(),
                du_dx=terms["du_dx"].detach().cpu().numpy().ravel(),
                d2u_dx2=terms["d2u_dx2"].detach().cpu().numpy().ravel(),
                dp_dx=terms["dp_dx"].detach().cpu().numpy().ravel(),
                dT_dt=terms["dT_dt"].detach().cpu().numpy().ravel(),
                dT_dx=terms["dT_dx"].detach().cpu().numpy().ravel(),
                d2T_dx2=terms["d2T_dx2"].detach().cpu().numpy().ravel(),
                rho=terms["rho"].detach().cpu().numpy().ravel(),
                u=terms["u"].detach().cpu().numpy().ravel(),
                viscosity=constant(properties["viscosity"]),
                conductivity=constant(properties["conductivity"]),
                cp=constant(properties["cp"]),
            )
            method = "autograd_derivatives+fortran_openmp_reduction"
        else:
            residuals = {name: float(torch.mean(terms[name].square()).detach().cpu()) for name in ("mass", "momentum", "energy")}
            method = "autograd_only_fortran_unavailable"
        return {"residuals": residuals, "method": method, "properties": properties}

    @staticmethod
    def validate_transient_series(series: Dict[str, Any]) -> Dict[str, Any]:
        frames = series.get("time_series")
        if not isinstance(frames, list) or not frames:
            raise ValueError("La série transitoire est absente.")
        times = [float(frame["time"]) for frame in frames]
        if times != sorted(times) or len(set(times)) != len(times):
            raise ValueError("Les instants temporels doivent être strictement croissants.")
        counts = [len(frame.get("points", [])) for frame in frames]
        if not counts or min(counts) == 0 or len(set(counts)) != 1:
            raise ValueError("Toutes les frames doivent contenir le même nombre de points non nul.")
        return {"frames": len(frames), "points_per_frame": counts[0], "time_start_s": times[0], "time_end_s": times[-1]}

    @staticmethod
    def _calculate_credibility_score(residuals: Dict[str, np.ndarray], scenario: str) -> float:
        all_res = [np.mean(np.abs(v)) for v in residuals.values()]
        avg_res = np.mean(all_res) if all_res else 1.0
        return round(float(100.0 / (1.0 + avg_res)), 2)
