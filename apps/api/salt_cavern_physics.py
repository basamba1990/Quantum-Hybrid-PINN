import torch
import torch.nn as nn
from typing import Dict, Any

# Imports internes
try:
    from fluid_properties import FLUID_CONFIGS, get_eos
except ImportError:
    from .fluid_properties import FLUID_CONFIGS, get_eos

class SaltCreepModel(nn.Module):
    """
    Modèle de fluage du sel (viscoplasticité) basé sur une loi de fluage secondaire.
    Exemple: Loi de Norton-Hoff généralisée pour le sel.
    """
    def __init__(self, A: float = 2.5e-10, n: float = 5.0, Q: float = 48000.0, R_gas: float = 8.314):
        super().__init__()
        self.A = A  # Constante matérielle (Pa^-n s^-1)
        self.n = n  # Exposant de la loi de fluage
        self.Q = Q  # Énergie d'activation (J/mol)
        self.R_gas = R_gas # Constante des gaz parfaits (J/mol.K)

    def forward(self, effective_stress: torch.Tensor, temperature: torch.Tensor) -> torch.Tensor:
        """
        Calcule le taux de déformation de fluage équivalent (epsilon_dot_eq).
        effective_stress: Contrainte équivalente de Von Mises (Pa)
        temperature: Température (K)
        """
        # Assurer que la température est positive pour éviter les erreurs log
        T_safe = torch.max(temperature, torch.tensor(1.0, device=temperature.device))
        
        # Loi de Norton-Hoff avec dépendance en température (Arrhenius)
        creep_rate = self.A * (effective_stress**self.n) * torch.exp(-self.Q / (self.R_gas * T_safe))
        return creep_rate

class SaltCavernPhysics:
    """
    Gère la physique spécifique des cavités salines, incluant le couplage thermomécanique
    et le comportement du sel.
    """
    def __init__(self, params: Dict[str, Any]):
        self.params = params
        self.salt_creep_model = SaltCreepModel(
            A=params.get("creep_A", 2.5e-10),
            n=params.get("creep_n", 5.0),
            Q=params.get("creep_Q", 48000.0)
        )
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def compute_thermomechanical_residuals(self, t, x, y, z, rho_fluid, u_fluid, v_fluid, w_fluid, T_fluid,
                                           rho_solid, u_solid, v_solid, w_solid, T_solid,
                                           stress_tensor: Dict[str, torch.Tensor]) -> Dict[str, torch.Tensor]:
        """
        Calcule les résidus des équations thermomécaniques pour le sel et le fluide.
        Ceci est une version simplifiée et conceptuelle.
        """
        # --- Équations pour le fluide (saumure/H2) --- (couplage avec GenericPINNSolver)
        # Les résidus du fluide sont gérés par GenericPINNSolver.
        # Ici, nous nous concentrons sur l'interaction et le solide.

        # --- Équations pour le solide (sel) --- 
        # 1. Conservation de la masse du solide (supposée constante pour le sel)
        # En réalité, la densité du sel change très peu, mais le volume de la caverne oui.
        # Pour un PINN, on pourrait modéliser le déplacement du solide.
        # Ici, nous allons plutôt modéliser les contraintes et déformations.

        # 2. Conservation de la quantité de mouvement du solide (équilibre des contraintes)
        # Équations d'équilibre: d(sigma_ij)/dx_j + rho_solid * g_i = 0
        # Pour simplifier, nous allons calculer une contrainte équivalente et le taux de fluage.

        # Contraintes (simplifiées pour l'exemple)
        sigma_xx = stress_tensor.get("sigma_xx", torch.zeros_like(x))
        sigma_yy = stress_tensor.get("sigma_yy", torch.zeros_like(x))
        sigma_zz = stress_tensor.get("sigma_zz", torch.zeros_like(x))
        sigma_xy = stress_tensor.get("sigma_xy", torch.zeros_like(x))
        sigma_xz = stress_tensor.get("sigma_xz", torch.zeros_like(x))
        sigma_yz = stress_tensor.get("sigma_yz", torch.zeros_like(x))

        # Contrainte équivalente de Von Mises (simplifiée)
        effective_stress = torch.sqrt(0.5 * ((sigma_xx - sigma_yy)**2 + (sigma_yy - sigma_zz)**2 + (sigma_zz - sigma_xx)**2) +
                                      3 * (sigma_xy**2 + sigma_xz**2 + sigma_yz**2))
        
        # Taux de déformation de fluage
        creep_rate = self.salt_creep_model(effective_stress, T_solid)

        # 3. Conservation de l'énergie du solide (transfert de chaleur)
        # d(rho_solid * Cp_solid * T_solid)/dt = div(k_solid * grad(T_solid)) + Q_source
        # Pour l'instant, nous nous concentrons sur le couplage thermique avec le fluide.

        # --- Couplage Thermique --- 
        # La température du sel à l'interface est égale à la température du fluide.
        # La perte de cette condition de couplage sera ajoutée à la fonction de perte globale.

        # --- Couplage Mécanique --- 
        # La pression du fluide agit comme une contrainte normale sur la paroi de la caverne.
        # Le déplacement de la paroi dû au fluage du sel affecte le volume de la caverne et donc la pression du fluide.

        # Résidus thermomécaniques (à définir plus précisément pour un PINN)
        # Pour l'instant, nous retournons le taux de fluage comme une métrique clé.
        return {
            "salt_creep_rate": creep_rate,
            "effective_stress": effective_stress,
            # Ajoutez d'autres résidus pertinents pour le solide et le couplage
        }

    def compute_coupling_loss(self, pinn_model_instance, geometry_handler_instance, fluid_type: str, device) -> torch.Tensor:
        """
        Calcule la perte due au couplage thermomécanique entre le fluide et le sel.
        """
        loss_coupling = torch.tensor(0.0, device=device)
        N_coupling = 100 # Points d'échantillonnage à l'interface

        if geometry_handler_instance.geometry_type == "salt_cavern":
            x_center = geometry_handler_instance.params.get("x_center", 0.0)
            y_center = geometry_handler_instance.params.get("y_center", 0.0)
            z_center = geometry_handler_instance.params.get("z_center", -1000.0)
            major_radius = geometry_handler_instance.params.get("major_radius", 100.0)
            minor_radius = geometry_handler_instance.params.get("minor_radius", 50.0)

            # Échantillonnage sur la surface de l'ellipsoïde (interface fluide-solide)
            t_interface = torch.rand(N_coupling, 1, device=device) * 10.0
            u_rand = torch.rand(N_coupling, 1, device=device)
            v_rand = torch.rand(N_coupling, 1, device=device)
            theta_interface = 2 * torch.pi * u_rand
            phi_interface = torch.acos(2 * v_rand - 1)

            x_interface = x_center + major_radius * torch.sin(phi_interface) * torch.cos(theta_interface)
            y_interface = y_center + major_radius * torch.sin(phi_interface) * torch.sin(theta_interface)
            z_interface = z_center + minor_radius * torch.cos(phi_interface)

            # Prédictions du fluide à l'interface
            rho_fluid_int, u_fluid_int, v_fluid_int, w_fluid_int, T_fluid_int = pinn_model_instance(t_interface, x_interface, y_interface, z_interface)
            p_fluid_int = pinn_model_instance.get_pressure(rho_fluid_int, T_fluid_int, fluid_type)

            # --- Conditions de couplage --- 
            # 1. Continuité de la température à l'interface (T_fluid = T_solid)
            # Pour l'instant, nous n'avons pas de modèle PINN pour le solide, donc nous utilisons une température de sel fixe.
            cavern_temperature = self.params.get("cavern_temperature", 300.0) # Température du sel
            loss_coupling += torch.mean((T_fluid_int - cavern_temperature)**2)

            # 2. Équilibre des contraintes normales à l'interface (P_fluid = -sigma_normal_solid)
            # Ceci est complexe sans un modèle de contrainte solide. Simplifions.
            # Nous pouvons pénaliser la différence entre la pression du fluide et une pression de référence du sel.
            # Pression de référence du sel (ex: pression lithostatique à la profondeur de la caverne)
            lithostatic_pressure = self.params.get("lithostatic_pressure", 25e6) # 25 MPa
            loss_coupling += torch.mean((p_fluid_int - lithostatic_pressure)**2)

            # 3. Continuité des flux de chaleur à l'interface (k_fluid * grad(T_fluid) . n = k_solid * grad(T_solid) . n)
            # Nécessite les gradients de température des deux côtés, plus complexe à implémenter ici.

            # 4. Conditions de non-glissement pour le fluide à la paroi (u_fluid = u_solid)
            # Si le solide est immobile, alors u_fluid = 0 à la paroi. Géré dans GeometryHandler BCs.

        return loss_coupling

if __name__ == '__main__':
    # Exemple d'utilisation
    params = {
        "creep_A": 2.5e-10, "creep_n": 5.0, "creep_Q": 48000.0,
        "cavern_temperature": 300.0, "lithostatic_pressure": 25e6
    }
    salt_physics = SaltCavernPhysics(params)

    # Exemple de calcul de fluage
    stress = torch.tensor([10e6, 20e6, 5e6]) # Pa
    temp = torch.tensor([300.0, 310.0, 290.0]) # K
    creep_rates = salt_physics.salt_creep_model(stress, temp)
    print(f"Taux de fluage: {creep_rates}")

    # Exemple de calcul de résidus (conceptuel)
    # Nécessite des entrées de fluide et de solide, ainsi que des tenseurs de contrainte
    # C'est ici que le couplage avec le PINN serait fait.
