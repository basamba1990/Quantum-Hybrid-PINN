"""
============================================================================
SWEET SPOT ANALYZER — Module d'Analyse de Stabilité Thermodynamique
Quantum-Hybrid-PINN | Industrial Grade (ANSYS-level)
============================================================================
S'exécute automatiquement à chaque simulation pour identifier le point
idéal de stabilité du gaz sans transition de phase non désirée.
Utilise l'équation d'état de Peng-Robinson pour une précision industrielle.
============================================================================
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# CONSTANTES PHYSIQUES — FLUIDES SUPPORTÉS
# ============================================================================

FLUID_CONSTANTS = {
    'H2': {
        'name': 'Hydrogène',
        'critical_pressure_Pa': 1.293e6,
        'critical_temperature_K': 33.145,
        'critical_density_kg_m3': 31.3,
        'triple_point_K': 13.803,
        'triple_point_Pa': 7040.0,
        'boiling_point_K': 20.271,
        'molecular_weight_kg_mol': 2.016e-3,
        'gamma': 1.405,  # Rapport Cp/Cv
        'omega': 0.113,  # Facteur acentrique
    },
    'CH4': {
        'name': 'Méthane',
        'critical_pressure_Pa': 4.599e6,
        'critical_temperature_K': 190.56,
        'critical_density_kg_m3': 162.0,
        'triple_point_K': 90.694,
        'triple_point_Pa': 11696.0,
        'boiling_point_K': 111.66,
        'molecular_weight_kg_mol': 16.043e-3,
        'gamma': 1.30,
        'omega': 0.0115,
    },
    'CO2': {
        'name': 'CO2 Supercritique',
        'critical_pressure_Pa': 7.377e6,
        'critical_temperature_K': 304.128,
        'critical_density_kg_m3': 467.6,
        'triple_point_K': 216.55,
        'triple_point_Pa': 518000.0,
        'boiling_point_K': 194.65,
        'molecular_weight_kg_mol': 44.01e-3,
        'gamma': 1.28,
        'omega': 0.224,
    },
    'NH3': {
        'name': 'Ammoniac',
        'critical_pressure_Pa': 11.28e6,
        'critical_temperature_K': 405.4,
        'critical_density_kg_m3': 235.0,
        'triple_point_K': 195.49,
        'triple_point_Pa': 6060.0,
        'boiling_point_K': 239.82,
        'molecular_weight_kg_mol': 17.031e-3,
        'gamma': 1.31,
        'omega': 0.250,
    },
}

R_UNIVERSAL = 8.314  # J/(mol·K)


# ============================================================================
# ÉQUATION D'ÉTAT DE PENG-ROBINSON (ANSYS-level accuracy)
# ============================================================================

class PengRobinsonEOS:
    """Équation d'état de Peng-Robinson pour le calcul du facteur Z."""

    def __init__(self, fluid_type: str = 'H2'):
        self.fluid = FLUID_CONSTANTS.get(fluid_type, FLUID_CONSTANTS['H2'])
        self.Tc = self.fluid['critical_temperature_K']
        self.Pc = self.fluid['critical_pressure_Pa']
        self.omega = self.fluid['omega']
        self.kappa = 0.37464 + 1.54226 * self.omega - 0.26992 * self.omega**2
        self.a = 0.45724 * R_UNIVERSAL**2 * self.Tc**2 / self.Pc
        self.b = 0.07780 * R_UNIVERSAL * self.Tc / self.Pc

    def alpha(self, T_K: float) -> float:
        """Fonction alpha(T) de Peng-Robinson."""
        if T_K <= 0:
            return 1.0
        return (1 + self.kappa * (1 - np.sqrt(T_K / self.Tc)))**2

    def compressibility_factor(self, P_Pa: float, T_K: float) -> float:
        """
        Calcule le facteur de compressibilité Z via l'équation cubique PR.
        Z³ - (1-B)Z² + (A-3B²-2B)Z - (AB-B²-B³) = 0
        """
        if P_Pa <= 0 or T_K <= 0:
            return 1.0
        a_T = self.a * self.alpha(T_K)
        A = a_T * P_Pa / (R_UNIVERSAL * T_K)**2
        B = self.b * P_Pa / (R_UNIVERSAL * T_K)

        # Coefficients de l'équation cubique
        coeffs = [
            1.0,
            -(1 - B),
            A - 3 * B**2 - 2 * B,
            -(A * B - B**2 - B**3)
        ]

        roots = np.roots(coeffs)
        real_roots = roots[np.isreal(roots)].real
        real_roots = real_roots[real_roots > 0]  # Z doit être positif

        if len(real_roots) == 0:
            return 1.0
        # Retourner la plus grande racine réelle (phase vapeur/gaz)
        return float(np.max(real_roots))

    def density(self, P_Pa: float, T_K: float) -> float:
        """Densité du fluide: ρ = P*M/(Z*R*T)"""
        Z = self.compressibility_factor(P_Pa, T_K)
        if Z <= 0:
            return 0.0
        M = self.fluid['molecular_weight_kg_mol']
        return P_Pa * M / (Z * R_UNIVERSAL * T_K)

    def mach_number(self, velocity_ms: float, T_K: float) -> float:
        """Nombre de Mach: Ma = v / a, avec a = sqrt(γ*R_specific*T)"""
        if T_K <= 0:
            return 0.0
        gamma = self.fluid['gamma']
        M = self.fluid['molecular_weight_kg_mol']
        R_specific = R_UNIVERSAL / M
        a_sound = np.sqrt(gamma * R_specific * T_K)
        return velocity_ms / a_sound if a_sound > 0 else 0.0

    def reynolds_number(self, P_Pa: float, T_K: float, diameter_m: float, velocity_ms: float) -> float:
        """Nombre de Reynolds: Re = ρ*v*D/μ"""
        rho = self.density(P_Pa, T_K)
        # Viscosité dynamique (corrélation de Sutherland simplifiée)
        mu = 8.76e-6 * (T_K / 300)**0.65  # Pa·s pour H2
        if mu <= 0 or diameter_m <= 0:
            return 0.0
        return rho * velocity_ms * diameter_m / mu

    def deviation_from_ideal(self, Z: float) -> Dict[str, Any]:
        """Analyse de la déviation par rapport au gaz idéal."""
        deviation = abs(Z - 1.0)
        if deviation < 0.02:
            level = 'EXCELLENT'
            desc = 'Comportement quasi-idéal (< 2% de déviation)'
        elif deviation < 0.05:
            level = 'BON'
            desc = 'Déviation faible (< 5%)'
        elif deviation < 0.15:
            level = 'ACCEPTABLE'
            desc = 'Déviation modérée — effets non-idéaux notables'
        elif deviation < 0.30:
            level = 'SUBLISTE'
            desc = 'Déviation significative — utiliser corrections EoS'
        else:
            level = 'CRITIQUE'
            desc = 'Forte déviation — comportement fortement non-idéal'
        return {
            'deviation': round(deviation, 6),
            'level': level,
            'description': desc,
        }


# ============================================================================
# MODULE SWEET SPOT ANALYZER — Point Central
# ============================================================================

class SweetSpotAnalyzer:
    """
    Analyseur de stabilité thermodynamique pour identifier le sweet spot
    d'opération sans transition de phase non désirée.
    """

    def __init__(self, fluid_type: str = 'H2'):
        self.fluid_type = fluid_type
        self.eos = PengRobinsonEOS(fluid_type)
        self.fluid = FLUID_CONSTANTS.get(fluid_type, FLUID_CONSTANTS['H2'])

    def _classify_state(self, P_Pa: float, T_K: float) -> Dict[str, Any]:
        """Classifie l'état thermodynamique du fluide."""
        Pc = self.fluid['critical_pressure_Pa']
        Tc = self.fluid['critical_temperature_K']
        P_ratio = P_Pa / Pc
        T_ratio = T_K / Tc

        if P_ratio < 1 and T_ratio < 1:
            state = 'SOLIDE/LIQUIDE'
        elif P_ratio < 1 and T_ratio > 1:
            state = 'GAZ (sous-critique)'
        elif P_ratio > 1 and T_ratio < 1:
            state = 'LIQUIDE COMPRIMÉ'
        else:
            state = 'SUPERCRITIQUE'

        return {
            'state': state,
            'P_Pc_ratio': round(P_ratio, 2),
            'T_Tc_ratio': round(T_ratio, 2),
        }

    def _assess_stability(self, P_Pa: float, T_K: float, Z: float) -> Dict[str, Any]:
        """Évalue la stabilité du gaz et le risque de transition de phase."""
        Pc = self.fluid['critical_pressure_Pa']
        Tc = self.fluid['critical_temperature_K']
        P_ratio = P_Pa / Pc
        T_ratio = T_K / Tc

        # Score de stabilité [0, 1]
        score = 1.0
        reasons = []

        # Éloignement du point critique
        if P_ratio < 2:
            score *= 0.3
            reasons.append('Proche de Pc — risque de transition de phase')
        elif P_ratio < 5:
            score *= 0.7
            reasons.append('Ratio P/Pc modéré')
        elif P_ratio < 10:
            score *= 0.9
            reasons.append('Ratio P/Pc acceptable')

        if T_ratio < 2:
            score *= 0.2
            reasons.append('Proche de Tc — température critique')
        elif T_ratio < 5:
            score *= 0.6
            reasons.append('Ratio T/Tc modéré')
        elif T_ratio < 9:
            score *= 0.9

        # Déviation Z
        Z_dev = abs(Z - 1.0)
        if Z_dev < 0.05:
            score *= 1.0
        elif Z_dev < 0.15:
            score *= 0.85
        elif Z_dev < 0.30:
            score *= 0.6
        else:
            score *= 0.3
            reasons.append(f'Forte déviation Z (|Z-1| = {Z_dev:.3f})')

        # État supercritique
        state_info = self._classify_state(P_Pa, T_K)
        if state_info['state'] == 'SUPERCRITIQUE':
            score = max(score, 0.85)  # Bonus supercritique

        # Risque de transition
        if P_ratio > 5 and T_ratio > 5:
            phase_risk = 'NONE'
        elif P_ratio > 2 and T_ratio > 2:
            phase_risk = 'LOW'
        elif P_ratio > 1 or T_ratio > 1:
            phase_risk = 'MODERATE'
        else:
            phase_risk = 'HIGH'

        return {
            'stability_score': round(score, 4),
            'phase_transition_risk': phase_risk,
            'reasons': reasons if reasons else ['Conditions optimales — supercritique stable'],
            'state_classification': state_info,
            'sweet_spot': score >= 0.85 and phase_risk == 'NONE',
        }

    def analyze_operating_point(
        self,
        pressure_Pa: float,
        temperature_K: float,
        velocity_ms: float = 0,
        pipe_diameter_m: float = 0.3,
    ) -> Dict[str, Any]:
        """
        Analyse complète d'un point d'opération.
        Retourne toutes les métriques thermodynamiques + verdict sweet spot.
        """
        Z = self.eos.compressibility_factor(pressure_Pa, temperature_K)
        rho = self.eos.density(pressure_Pa, temperature_K)
        mach = self.eos.mach_number(velocity_ms, temperature_K)
        reynolds = self.eos.reynolds_number(pressure_Pa, temperature_K, pipe_diameter_m, velocity_ms)
        deviation = self.eos.deviation_from_ideal(Z)
        stability = self._assess_stability(pressure_Pa, temperature_K, Z)
        state = self._classify_state(pressure_Pa, temperature_K)

        # Verdict global
        Pc = self.fluid['critical_pressure_Pa']
        Tc = self.fluid['critical_temperature_K']
        verdict_parts = []

        if stability['sweet_spot']:
            verdict_parts.append('SWEET SPOT CONFIRMÉ')
            certification = 'INDUSTRIAL-GOLD'
        elif stability['stability_score'] >= 0.6:
            verdict_parts.append('Opération stable')
            certification = 'INDUSTRIAL-SILVER'
        else:
            verdict_parts.append('Conditions sub-optimales')
            certification = 'INDUSTRIAL-BRONZE'

        verdict_parts.append(f"P/Pc = {pressure_Pa/Pc:.1f}x")
        verdict_parts.append(f"T/Tc = {temperature_K/Tc:.1f}x")

        return {
            'fluid_type': self.fluid_type,
            'fluid_name': self.fluid['name'],
            'operating_point': {
                'pressure_Pa': pressure_Pa,
                'pressure_MPa': pressure_Pa / 1e6,
                'pressure_bar': pressure_Pa / 1e5,
                'temperature_K': temperature_K,
                'temperature_C': temperature_K - 273.15,
            },
            'thermodynamic_properties': {
                'compressibility_factor_Z': round(Z, 6),
                'density_kg_m3': round(rho, 6),
                'mach_number': round(mach, 6),
                'reynolds_number_DN300': f'{reynolds:.2e}',
                'flow_regime': 'Incompressible (Ma < 0.3)' if mach < 0.3 else 'Compressible',
                'deviation_from_ideal': deviation,
            },
            'state_classification': state,
            'stability_assessment': stability,
            'verdict': ' | '.join(verdict_parts),
            'certification': certification,
            'critical_properties': {
                'Pc_MPa': Pc / 1e6,
                'Tc_K': Tc,
                'P_ratio': round(pressure_Pa / Pc, 1),
                'T_ratio': round(temperature_K / Tc, 1),
            },
        }

    def analyze_pipeline_profile(
        self,
        inlet_pressure_MPa: float,
        inlet_temperature_K: float,
        pipeline_length_m: float,
        pressure_drop_MPa: float,
        cooling_K: float,
        velocity_ms: float = 10.0,
        pipe_diameter_m: float = 0.3,
        num_segments: int = 20,
    ) -> Dict[str, Any]:
        """
        Analyse le profil de stabilité le long d'un pipeline entier.
        Détecte si le sweet spot est maintenu sur toute la longueur.
        """
        Pc = self.fluid['critical_pressure_Pa']
        Tc = self.fluid['critical_temperature_K']

        # Grille de segments le long du pipeline
        segment_positions = np.linspace(0, pipeline_length_m, num_segments)
        segments = []

        sweet_spot_maintained = True
        min_stability_score = 1.0
        max_mach = 0.0
        max_Z_deviation = 0.0

        for pos in segment_positions:
            frac = pos / pipeline_length_m if pipeline_length_m > 0 else 0
            P_Pa = (inlet_pressure_MPa - frac * pressure_drop_MPa) * 1e6
            T_K = inlet_temperature_K - frac * cooling_K

            result = self.analyze_operating_point(P_Pa, T_K, velocity_ms, pipe_diameter_m)

            stability_score = result['stability_assessment']['stability_score']
            mach = result['thermodynamic_properties']['mach_number']
            Z = result['thermodynamic_properties']['compressibility_factor_Z']

            if not result['stability_assessment']['sweet_spot']:
                sweet_spot_maintained = False
            min_stability_score = min(min_stability_score, stability_score)
            max_mach = max(max_mach, mach)
            max_Z_deviation = max(max_Z_deviation, abs(Z - 1.0))

            segments.append({
                'position_m': round(float(pos), 2),
                'pressure_MPa': result['operating_point']['pressure_MPa'],
                'temperature_K': result['operating_point']['temperature_K'],
                'Z': result['thermodynamic_properties']['compressibility_factor_Z'],
                'density_kg_m3': result['thermodynamic_properties']['density_kg_m3'],
                'mach': mach,
                'stability_score': stability_score,
                'sweet_spot': result['stability_assessment']['sweet_spot'],
            })

        # Verdict pipeline global
        if sweet_spot_maintained and min_stability_score >= 0.85:
            pipeline_verdict = 'SWEET SPOT MAINTENU — Aucune transition de phase sur toute la longueur'
            pipeline_certification = 'INDUSTRIAL-GOLD'
        elif min_stability_score >= 0.6:
            pipeline_verdict = 'Stabilité acceptable — surveillance recommandée'
            pipeline_certification = 'INDUSTRIAL-SILVER'
        else:
            pipeline_verdict = 'Conditions critiques détectées — intervention requise'
            pipeline_certification = 'INDUSTRIAL-BRONZE'

        # Gradient de pression
        pressure_gradient_MPa_per_m = -pressure_drop_MPa / pipeline_length_m if pipeline_length_m > 0 else 0

        return {
            'pipeline_analysis': {
                'length_m': pipeline_length_m,
                'inlet': {
                    'pressure_MPa': inlet_pressure_MPa,
                    'temperature_K': inlet_temperature_K,
                },
                'outlet': {
                    'pressure_MPa': round(inlet_pressure_MPa - pressure_drop_MPa, 2),
                    'temperature_K': round(inlet_temperature_K - cooling_K, 2),
                },
                'pressure_drop_MPa': pressure_drop_MPa,
                'pressure_gradient_MPa_per_m': round(pressure_gradient_MPa_per_m, 4),
                'cooling_K': cooling_K,
                'temperature_gradient_K_per_m': round(-cooling_K / pipeline_length_m, 4) if pipeline_length_m > 0 else 0,
            },
            'sweet_spot_maintained': sweet_spot_maintained,
            'min_stability_score': round(min_stability_score, 4),
            'max_mach': round(max_mach, 6),
            'max_Z_deviation': round(max_Z_deviation, 4),
            'pipeline_verdict': pipeline_verdict,
            'pipeline_certification': pipeline_certification,
            'segments': segments,
            'critical_properties': {
                'Pc_MPa': Pc / 1e6,
                'Tc_K': Tc,
            },
        }

    def find_optimal_sweet_spot(
        self,
        pressure_range_MPa: Tuple[float, float] = (1, 200),
        temperature_range_K: Tuple[float, float] = (20, 500),
        n_pressure: int = 50,
        n_temperature: int = 50,
    ) -> Dict[str, Any]:
        """
        Scan une grille P-T pour identifier le sweet spot optimal.
        """
        pressures = np.linspace(pressure_range_MPa[0], pressure_range_MPa[1], n_pressure)
        temperatures = np.linspace(temperature_range_K[0], temperature_range_K[1], n_temperature)

        best_score = 0.0
        best_point = None
        all_scores = []

        for T in temperatures:
            for P in pressures:
                P_Pa = P * 1e6
                result = self.analyze_operating_point(P_Pa, T)
                score = result['stability_assessment']['stability_score']
                all_scores.append({
                    'P_MPa': P, 'T_K': T, 'score': score,
                    'Z': result['thermodynamic_properties']['compressibility_factor_Z'],
                    'rho': result['thermodynamic_properties']['density_kg_m3'],
                })
                if score > best_score:
                    best_score = score
                    best_point = result

        return {
            'optimal_sweet_spot': best_point,
            'max_stability_score': round(best_score, 4),
            'scan_parameters': {
                'pressure_range_MPa': pressure_range_MPa,
                'temperature_range_K': temperature_range_K,
                'grid_points': n_pressure * n_temperature,
            },
        }


# ============================================================================
# FONCTION D'INTEGRATION — Appelée par le pipeline principal
# ============================================================================

def run_sweet_spot_analysis(
    scenario_inputs: Dict[str, Any],
    fluid_type: str = 'H2',
) -> Dict[str, Any]:
    """
    Fonction principale appelée par le pipeline de simulation.
    Exécute automatiquement l'analyse sweet spot avec les paramètres d'entrée.
    """
    analyzer = SweetSpotAnalyzer(fluid_type)

    # Extraction des paramètres de la simulation
    pressure = scenario_inputs.get('pressure', 70)  # MPa par défaut
    temperature = scenario_inputs.get('temperature', 298.15)  # K par défaut
    velocity = scenario_inputs.get('inlet_velocity', 10.0)  # m/s
    diameter = scenario_inputs.get('diameter', 0.3)  # m
    length = scenario_inputs.get('length', 12.0)  # m

    pressure_Pa = pressure * 1e6

    # Analyse du point d'opération
    operating_analysis = analyzer.analyze_operating_point(
        pressure_Pa=pressure_Pa,
        temperature_K=temperature,
        velocity_ms=velocity,
        pipe_diameter_m=diameter,
    )

    # Analyse du profil pipeline
    pressure_drop = scenario_inputs.get('pressure_drop_MPa', 35.0)
    cooling = scenario_inputs.get('cooling_K', 15.0)

    pipeline_analysis = analyzer.analyze_pipeline_profile(
        inlet_pressure_MPa=pressure,
        inlet_temperature_K=temperature,
        pipeline_length_m=length,
        pressure_drop_MPa=pressure_drop,
        cooling_K=cooling,
        velocity_ms=velocity,
        pipe_diameter_m=diameter,
    )

    # Recherche du sweet spot optimal dans la plage pertinente
    sweet_spot_search = analyzer.find_optimal_sweet_spot(
        pressure_range_MPa=(max(0.5, pressure * 0.3), min(300, pressure * 2)),
        temperature_range_K=(max(15, temperature * 0.5), min(600, temperature * 2)),
    )

    return {
        'sweet_spot_analysis': {
            'fluid_type': fluid_type,
            'status': 'ANALYZED',
            'operating_point': operating_analysis,
            'pipeline_profile': pipeline_analysis,
            'optimal_sweet_spot_search': sweet_spot_search,
            'generated_at': __import__('datetime').datetime.utcnow().isoformat(),
        }
    }
