import numpy as np
import torch

class PVTPhysicsEngine:
    """
    Moteur de physique PVT (Pression, Volume, Température) pour la validation
    et l'ajustement des propriétés des fluides dans les simulations hybrides.
    Inspiré par PVTtool (simulkade).
    """
    def __init__(self, fluid_type='H2'):
        self.fluid_type = fluid_type
        # Constantes pour l'Hydrogène (H2) par défaut
        self.R = 4124.0  # Constante spécifique du gaz J/(kg·K)
        self.critical_p = 1.297e6  # Pa
        self.critical_t = 33.18    # K
        
        if fluid_type == 'CH4':
            self.R = 518.3
            self.critical_p = 4.599e6
            self.critical_t = 190.56
            
    def calculate_density(self, pressure, temperature):
        """Loi des gaz parfaits corrigée (Z-factor simplifié)"""
        # rho = P / (Z * R * T)
        # Pour cette version, on utilise Z=1 (gaz parfait) ou une corrélation simple
        z = self.estimate_z_factor(pressure, temperature)
        density = pressure / (z * self.R * temperature)
        return density

    def estimate_z_factor(self, p, t):
        """Estimation simplifiée du facteur de compressibilité Z"""
        pr = p / self.critical_p
        tr = t / self.critical_t
        # Corrélation très simplifiée pour l'exemple
        z = 1.0 + (0.27 * pr / tr) if tr > 0 else 1.0
        return z

    def validate_state(self, p, v, t, rho_sim):
        """
        Valide si l'état simulé (rho_sim) respecte la cohérence PVT.
        Retourne l'erreur résiduelle.
        """
        rho_expected = self.calculate_density(p, t)
        error = np.abs(rho_sim - rho_expected) / (rho_expected + 1e-8)
        return error, rho_expected

    def get_fluid_properties(self, temperature):
        """Retourne la viscosité et la conductivité thermique en fonction de T"""
        # Modèle de Sutherland simplifié pour H2
        mu0 = 8.76e-6
        t0 = 273.15
        s = 72.0
        mu = mu0 * (temperature / t0)**1.5 * (t0 + s) / (temperature + s)
        return {"viscosity": mu, "specific_gas_constant": self.R}
