import torch
import numpy as np
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

"""
Fluid Properties and Equations of State (EOS) Factory
Supports: Hydrogen (H2), Ammonia (NH3), Methane (CH4), and Supercritical CO2 (sCO2)
V8.1: Added CoolProp fallback and validation for H2 liquid
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
        },
        'kinetics': 'temkin_pyzhev',
        'delta_H': -46110.0, # J/mol
        'Ea': 160000.0,      # J/mol
        'alpha': 0.5
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
    },
    'generique': {
        'name': 'Roche générique',
        'density': 2500.0,          # kg/m³
        'wave_speed': 300.0,        # m/s (onde de compression)
        'poisson': 0.25,
        'young_modulus': 50e9,      # Pa
        'mu': 1.0e-5,               # Valeur par défaut pour la compatibilité Navier-Stokes
        'Cp': 1000.0,
        'k': 2.0,
        'gamma': 1.1,
        'eos_type': 'solid_elastic_simplified',
        'params': {
            'rho': 2500.0, 'E': 50e9, 'nu': 0.25
        }
    }
}

# Variable globale pour ne logger l'avertissement CoolProp qu'une seule fois
_coolprop_warned = False

def get_eos(fluid_type: str, rho: torch.Tensor, T: torch.Tensor) -> torch.Tensor:
    """
    Équation d'État avec validation et fallback (V8.1)
    """
    global _coolprop_warned
    config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
    R = config.get('R_specific', 8.314)
    params = config['params']
    
    if fluid_type == 'H2':
        try:
            import CoolProp.CoolProp as CP
                        rho_np = rho.cpu().detach().numpy() if rho.is_cuda else rho.detach().numpy()
            T_np = T.cpu().detach().numpy() if T.is_cuda else T.detach().numpy()
            
            # Aplatir les entrées pour CoolProp
            original_shape = rho_np.shape
            rho_flat = rho_np.flatten()
            T_flat = T_np.flatten()
            
            # Calcul vectorisé ou boucle si nécessaire
            p_flat = np.array([CP.PropsSI('P', 'T', T_flat[i], 'Dmass', rho_flat[i], 'H2') 
                             for i in range(len(rho_flat))])
            
            # Remettre à la forme originale
            p_np = p_flat.reshape(original_shape)
            return torch.from_numpy(p_np).to(rho.device).float()
            
        except ImportError:
            if not _coolprop_warned:
                logger.warning("⚠️ CoolProp not installed. Using Silvera-Goldman fallback (may be non-physical).")
                _coolprop_warned = True
        except Exception as e:
            if not _coolprop_warned:
                logger.warning(f"⚠️ CoolProp failed: {e}. Falling back to Silvera-Goldman.")
                _coolprop_warned = True
    
    if config['eos_type'] == 'silvera_goldman':
        p_ideal = rho * R * T
        repulsion = params['A'] * torch.exp(-params['alpha'] * (100.0 / (rho + 1e-6))**(1/3))
        attraction = -params['B'] * (rho**2)
        quantum_corr = params['C'] * (rho**3) / (T + 1e-6)
        p = p_ideal + repulsion + attraction + quantum_corr
        return p
        
    elif config['eos_type'] == 'peng_robinson':
        a = params['a']
        b = params['b']
        Tc = params['Tc']
        omega = params['omega']
        kappa = 0.37464 + 1.54226 * omega - 0.26992 * omega**2
        alpha = (1 + kappa * (1 - torch.sqrt(T / Tc)))**2
        a_T = a * alpha
        v = 1.0 / (rho + 1e-8)
        p = (R * T) / (v - b) - a_T / (v**2 + 2*b*v - b**2)
        return p
        
    elif config['eos_type'] == 'solid_elastic_simplified':
        rho_ref = params.get('rho', 2500.0)
        E = params.get('E', 50e9)
        return E * (rho / rho_ref - 1.0)
        
    else:
        return rho * R * T * (1 + 0.1 * (rho / params.get('rho_c', 1.0)))
