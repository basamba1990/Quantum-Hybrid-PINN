ROCK_CONFIGS = {
    'generic_rock': {
        'name': 'Roche générique',
        'density': 2500.0,          # kg/m³
        'young_modulus': 50e9,      # Pa (50 GPa)
        'poisson_ratio': 0.25,
        'damage_threshold': 1e-4,   # déformation seuil d'endommagement
        'damage_rate': 100.0,       # paramètre de vitesse d'endommagement
        'nonlinear_alpha': 1e-10,   # non-linéarité module / pression
    }
}
