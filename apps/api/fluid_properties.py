import torch
import numpy as np
from typing import Dict, Any

"""
Fluid Properties and Equations of State (EOS) Factory
Supports: Hydrogen (H2), Ammonia (NH3), Methane (CH4), and Supercritical CO2 (sCO2)
"""

FLUID_CONFIGS = {
    'H2': {
        'name': 'Hydrogen',
        'R_specific': 4124.0,  # J/(kg·K)
        'mu': 8.8e-6,         # Pa·s
        'k': 0.18,            # W/(m·K)
        'Cp': 14300.0,        # J/(kg·K)
        'gamma': 1.4,
        'eos_type': 'silvera_goldman',
        'params': {
            'A': 1.713e-3, 'B': 1.567e-6, 'C': 2.145e-12, 'alpha': 1.44
        }
    },
    'NH3': {
        'name': 'Ammonia',
        'R_specific': 488.2,
        'mu': 1.0e-5,
        'k': 0.02,
        'Cp': 2100.0,
        'gamma': 1.31,
        'eos_type': 'peng_robinson',
        'params': {
            'a': 0.422, 'b': 3.7e-5, 'Tc': 405.5, 'Pc': 11.3e6, 'omega': 0.25
        }
    },
    'CH4': {
        'name': 'Methane',
        'R_specific': 518.3,
        'mu': 1.1e-5,
        'k': 0.03,
        'Cp': 2200.0,
        'gamma': 1.3,
        'eos_type': 'peng_robinson',
        'params': {
            'a': 0.23, 'b': 4.27e-5, 'Tc': 190.6, 'Pc': 4.6e6, 'omega': 0.01
        }
    },
    'sCO2': {
        'name': 'Supercritical CO2',
        'R_specific': 188.9,
        'mu': 3.0e-5,
        'k': 0.05,
        'Cp': 850.0,
        'gamma': 1.28,
        'eos_type': 'helmholtz_simplified',
        'params': {
            'Tc': 304.1, 'Pc': 7.38e6, 'rho_c': 467.6
        }
    }
}

def get_eos(fluid_type: str, rho: torch.Tensor, T: torch.Tensor) -> torch.Tensor:
    config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
    R = config['R_specific']
    params = config['params']
    
    if config['eos_type'] == 'silvera_goldman':
        # Silvera-Goldman for H2
        p_ideal = rho * R * T
        repulsion = params['A'] * rho * torch.exp(params['alpha'] * rho / 100.0)
        attraction = -params['B'] * (rho**2)
        quantum_corr = params['C'] * (rho**3) / (T + 1e-6)
        return p_ideal * (1 + repulsion + attraction + quantum_corr)
        
    elif config['eos_type'] == 'peng_robinson':
        # Peng-Robinson for NH3, CH4
        a = params['a']
        b = params['b']
        Tc = params['Tc']
        omega = params['omega']
        
        kappa = 0.37464 + 1.54226 * omega - 0.26992 * omega**2
        alpha = (1 + kappa * (1 - torch.sqrt(T / Tc)))**2
        a_T = a * alpha
        
        # p = RT / (V-b) - a(T) / (V^2 + 2bV - b^2) where V = 1/rho
        v = 1.0 / (rho + 1e-8)
        p = (R * T) / (v - b) - a_T / (v**2 + 2*b*v - b**2)
        return p
        
    else:
        # Default/Simplified Helmholtz for sCO2
        return rho * R * T * (1 + 0.1 * (rho / params.get('rho_c', 1.0)))
