"""
Rock mass properties for deep mining simulations
Based on Hoek-Brown, Wagner (2019), Hoek & Diederichs (2006)
"""

ROCK_CONFIGS = {
    'generic_rock': {
        'name': 'Roche générique',
        'density': 2500.0,          # kg/m³
        'young_modulus': 50e9,      # Pa (50 GPa)
        'poisson_ratio': 0.25,
        'damage_threshold': 1e-4,   # déformation seuil d'endommagement
        'damage_rate': 100.0,       # paramètre de vitesse d'endommagement
        'nonlinear_alpha': 1e-10,   # non-linéarité module / pression
        'ucs': 100e6,               # Uniaxial Compressive Strength (Pa)
        'tensile_strength': 7e6,    # Pa
        'cohesion': 10e6,           # Pa
        'friction_angle': 45.0,     # degrees
    },
    'granite': {
        'name': 'Granite',
        'density': 2700.0,          # kg/m³ (Hoek & Diederichs 2006)
        'young_modulus': 50e9,      # Pa (50 GPa) - typical for deep granite
        'poisson_ratio': 0.25,
        'damage_threshold': 1e-4,
        'damage_rate': 100.0,
        'nonlinear_alpha': 1e-10,
        'ucs': 150e6,               # 150 MPa (Wagner 2019)
        'tensile_strength': 8e6,    # 8 MPa
        'cohesion': 12e6,           # 12 MPa
        'friction_angle': 50.0,     # 50°
        'dilatancy': 0.3,
    },
    'basalt': {
        'name': 'Basalt',
        'density': 2900.0,          # kg/m³
        'young_modulus': 60e9,      # Pa (60 GPa)
        'poisson_ratio': 0.28,
        'damage_threshold': 1.5e-4,
        'damage_rate': 80.0,
        'nonlinear_alpha': 1e-10,
        'ucs': 200e6,               # 200 MPa
        'tensile_strength': 12e6,
        'cohesion': 15e6,
        'friction_angle': 55.0,
        'dilatancy': 0.2,
    },
    'limestone': {
        'name': 'Limestone',
        'density': 2600.0,          # kg/m³
        'young_modulus': 30e9,      # Pa (30 GPa)
        'poisson_ratio': 0.22,
        'damage_threshold': 8e-5,
        'damage_rate': 150.0,
        'nonlinear_alpha': 2e-10,
        'ucs': 80e6,                # 80 MPa
        'tensile_strength': 5e6,
        'cohesion': 8e6,
        'friction_angle': 40.0,
        'dilatancy': 0.4,
    },
    'sandstone': {
        'name': 'Sandstone',
        'density': 2400.0,          # kg/m³
        'young_modulus': 25e9,      # Pa (25 GPa)
        'poisson_ratio': 0.20,
        'damage_threshold': 1e-4,
        'damage_rate': 120.0,
        'nonlinear_alpha': 1.5e-10,
        'ucs': 60e6,                # 60 MPa
        'tensile_strength': 4e6,
        'cohesion': 6e6,
        'friction_angle': 38.0,
        'dilatancy': 0.35,
    },
    'salt_halite': {
        'name': 'Halite (Sel)',
        'density': 2170.0,          # kg/m³
        'young_modulus': 15e9,      # Pa (15 GPa)
        'poisson_ratio': 0.32,
        'damage_threshold': 5e-5,
        'damage_rate': 200.0,
        'nonlinear_alpha': 3e-10,
        'ucs': 25e6,                # 25 MPa
        'tensile_strength': 1.5e6,
        'cohesion': 2.5e6,
        'friction_angle': 30.0,
        'dilatancy': 0.5,
    }
}
