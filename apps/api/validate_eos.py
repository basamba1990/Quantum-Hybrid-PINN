"""
Validation de l'Équation d'État Silvera-Goldman pour l'Hydrogène Liquide
Comparaison avec les données expérimentales NIST et vérification des propriétés thermodynamiques
"""

import torch
import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

# Données expérimentales NIST pour H2 liquide (points de référence)
NIST_H2_DATA = {
    "LH2_20K": {"rho": 71.0, "T": 20.0, "p_exp": 0.1e5},  # Pa (approximation)
    "LH2_25K": {"rho": 65.0, "T": 25.0, "p_exp": 0.5e5},
    "LH2_30K": {"rho": 58.0, "T": 30.0, "p_exp": 1.5e5},
    "LH2_33K": {"rho": 50.0, "T": 33.0, "p_exp": 13.0e5},  # Température critique
}

class SilveraGoldmanValidator:
    """
    Validateur de l'EOS Silvera-Goldman pour l'hydrogène liquide.
    Teste les propriétés thermodynamiques et les dérivées.
    """
    
    def __init__(self, device: str = "cpu"):
        self.device = torch.device(device)
        self.R_H2 = 4124.0  # J/(kg·K)
        self.params = {
            'A': 1.713e-3, 'B': 1.567e-6, 'C': 2.145e-12, 'alpha': 1.44
        }
        self.results = {}
        
    def silvera_goldman_eos(self, rho: torch.Tensor, T: torch.Tensor) -> torch.Tensor:
        """
        Implémentation de l'EOS Silvera-Goldman.
        p = p_ideal + p_repulsion + p_attraction + p_quantum
        """
        p_ideal = rho * self.R_H2 * T
        
        repulsion = self.params['A'] * torch.exp(-self.params['alpha'] * (100.0 / (rho + 1e-6))**(1/3))
        attraction = -self.params['B'] * (rho**2)
        quantum_corr = self.params['C'] * (rho**3) / (T + 1e-6)
        
        return p_ideal + repulsion + attraction + quantum_corr
    
    def test_monotonicity_rho(self) -> Dict:
        """
        Test 1 : La pression doit augmenter avec la densité à T constante.
        ∂p/∂ρ|_T > 0
        """
        logger.info("Test 1 : Monotonie en densité (∂p/∂ρ|_T > 0)")
        
        T = torch.tensor([25.0], dtype=torch.float32, device=self.device)
        rho_values = torch.linspace(50, 80, 10, dtype=torch.float32, device=self.device)
        
        p_values = []
        for rho in rho_values:
            rho_t = rho.unsqueeze(0).requires_grad_(True)
            p = self.silvera_goldman_eos(rho_t, T)
            p_values.append(p.item())
        
        # Vérifier la monotonie
        is_monotonic = all(p_values[i] <= p_values[i+1] for i in range(len(p_values)-1))
        
        # Calculer la dérivée numérique
        dp_drho_numeric = (p_values[-1] - p_values[0]) / (rho_values[-1].item() - rho_values[0].item())
        
        result = {
            "test": "Monotonie en densité",
            "passed": is_monotonic,
            "dp_drho_numeric": float(dp_drho_numeric),
            "p_values": [float(p) for p in p_values],
            "rho_values": [float(r) for r in rho_values.tolist()]
        }
        
        logger.info(f"  ✓ Monotonie : {'PASS' if is_monotonic else 'FAIL'}")
        logger.info(f"  ∂p/∂ρ|_T ≈ {dp_drho_numeric:.2e} Pa/(kg/m³)")
        
        self.results["test_1_monotonicity_rho"] = result
        return result
    
    def test_monotonicity_T(self) -> Dict:
        """
        Test 2 : La pression doit augmenter avec la température à ρ constante.
        ∂p/∂T|_ρ > 0
        """
        logger.info("Test 2 : Monotonie en température (∂p/∂T|_ρ > 0)")
        
        rho = torch.tensor([65.0], dtype=torch.float32, device=self.device)
        T_values = torch.linspace(20, 33, 10, dtype=torch.float32, device=self.device)
        
        p_values = []
        for T in T_values:
            T_t = T.unsqueeze(0).requires_grad_(True)
            p = self.silvera_goldman_eos(rho, T_t)
            p_values.append(p.item())
        
        # Vérifier la monotonie
        is_monotonic = all(p_values[i] <= p_values[i+1] for i in range(len(p_values)-1))
        
        # Calculer la dérivée numérique
        dp_dT_numeric = (p_values[-1] - p_values[0]) / (T_values[-1].item() - T_values[0].item())
        
        result = {
            "test": "Monotonie en température",
            "passed": is_monotonic,
            "dp_dT_numeric": float(dp_dT_numeric),
            "p_values": [float(p) for p in p_values],
            "T_values": [float(T) for T in T_values.tolist()]
        }
        
        logger.info(f"  ✓ Monotonie : {'PASS' if is_monotonic else 'FAIL'}")
        logger.info(f"  ∂p/∂T|_ρ ≈ {dp_dT_numeric:.2e} Pa/K")
        
        self.results["test_2_monotonicity_T"] = result
        return result
    
    def test_nist_comparison(self) -> Dict:
        """
        Test 3 : Comparaison avec les données expérimentales NIST.
        Calcul de l'erreur relative pour les points de référence.
        """
        logger.info("Test 3 : Comparaison avec données NIST")
        
        errors = {}
        for name, data in NIST_H2_DATA.items():
            rho = torch.tensor([data["rho"]], dtype=torch.float32, device=self.device)
            T = torch.tensor([data["T"]], dtype=torch.float32, device=self.device)
            
            p_calc = self.silvera_goldman_eos(rho, T).item()
            p_exp = data["p_exp"]
            
            rel_error = abs(p_calc - p_exp) / (abs(p_exp) + 1e-6) * 100
            
            errors[name] = {
                "rho": data["rho"],
                "T": data["T"],
                "p_calc": p_calc,
                "p_exp": p_exp,
                "rel_error_percent": rel_error
            }
            
            logger.info(f"  {name}: p_calc={p_calc:.2e} Pa, p_exp={p_exp:.2e} Pa, erreur={rel_error:.1f}%")
        
        result = {
            "test": "Comparaison NIST",
            "errors": errors
        }
        
        self.results["test_3_nist_comparison"] = result
        return result
    
    def test_derivative_consistency(self) -> Dict:
        """
        Test 4 : Vérification de la cohérence des dérivées.
        Les dérivées partielles doivent être continues et bien définies.
        """
        logger.info("Test 4 : Cohérence des dérivées partielles")
        
        rho = torch.tensor([65.0], dtype=torch.float32, device=self.device, requires_grad=True)
        T = torch.tensor([25.0], dtype=torch.float32, device=self.device, requires_grad=True)
        
        # Calculer p et ses dérivées
        p = self.silvera_goldman_eos(rho, T)
        
        # Dérivée par rapport à ρ
        dp_drho = torch.autograd.grad(p, rho, create_graph=True)[0]
        
        # Dérivée par rapport à T
        dp_dT = torch.autograd.grad(p, T, create_graph=True)[0]
        
        # Dérivées secondes
        d2p_drho2 = torch.autograd.grad(dp_drho, rho)[0]
        d2p_dT2 = torch.autograd.grad(dp_dT, T)[0]
        
        result = {
            "test": "Cohérence des dérivées",
            "dp_drho": float(dp_drho.item()),
            "dp_dT": float(dp_dT.item()),
            "d2p_drho2": float(d2p_drho2.item()),
            "d2p_dT2": float(d2p_dT2.item()),
            "passed": float(dp_drho.item()) > 0 and float(dp_dT.item()) > 0
        }
        
        logger.info(f"  ∂p/∂ρ = {dp_drho.item():.2e} Pa/(kg/m³)")
        logger.info(f"  ∂p/∂T = {dp_dT.item():.2e} Pa/K")
        logger.info(f"  ∂²p/∂ρ² = {d2p_drho2.item():.2e}")
        logger.info(f"  ∂²p/∂T² = {d2p_dT2.item():.2e}")
        
        self.results["test_4_derivative_consistency"] = result
        return result
    
    def test_speed_of_sound(self) -> Dict:
        """
        Test 5 : Vérification de la vitesse du son.
        c² = ∂p/∂ρ|_S (à entropie constante)
        Pour un test simplifié, on utilise c² ≈ ∂p/∂ρ|_T
        """
        logger.info("Test 5 : Vitesse du son")
        
        rho = torch.tensor([65.0], dtype=torch.float32, device=self.device, requires_grad=True)
        T = torch.tensor([25.0], dtype=torch.float32, device=self.device)
        
        p = self.silvera_goldman_eos(rho, T)
        dp_drho = torch.autograd.grad(p, rho)[0]
        
        c_squared = dp_drho / rho
        c = torch.sqrt(c_squared)
        
        # Pour l'hydrogène liquide, c ≈ 1000-1200 m/s
        c_exp_min = 1000.0
        c_exp_max = 1200.0
        
        is_physical = c_exp_min <= c.item() <= c_exp_max
        
        result = {
            "test": "Vitesse du son",
            "c_squared": float(c_squared.item()),
            "c": float(c.item()),
            "c_exp_range": [c_exp_min, c_exp_max],
            "passed": is_physical
        }
        
        logger.info(f"  c = {c.item():.1f} m/s (attendu: {c_exp_min}-{c_exp_max} m/s)")
        logger.info(f"  ✓ Physique : {'PASS' if is_physical else 'FAIL'}")
        
        self.results["test_5_speed_of_sound"] = result
        return result
    
    def test_stability(self) -> Dict:
        """
        Test 6 : Vérification de la stabilité thermodynamique.
        Conditions de stabilité : ∂p/∂ρ|_T > 0, ∂²p/∂T²|_ρ < 0 (pour certains fluides)
        """
        logger.info("Test 6 : Stabilité thermodynamique")
        
        rho = torch.tensor([65.0], dtype=torch.float32, device=self.device, requires_grad=True)
        T = torch.tensor([25.0], dtype=torch.float32, device=self.device, requires_grad=True)
        
        p = self.silvera_goldman_eos(rho, T)
        
        # Dérivées premières
        dp_drho = torch.autograd.grad(p, rho, create_graph=True)[0]
        dp_dT = torch.autograd.grad(p, T, create_graph=True)[0]
        
        # Dérivée seconde en T
        d2p_dT2 = torch.autograd.grad(dp_dT, T)[0]
        
        # Critères de stabilité
        stable_rho = float(dp_drho.item()) > 0
        
        result = {
            "test": "Stabilité thermodynamique",
            "dp_drho": float(dp_drho.item()),
            "d2p_dT2": float(d2p_dT2.item()),
            "stable_rho": stable_rho,
            "passed": stable_rho
        }
        
        logger.info(f"  ∂p/∂ρ|_T > 0 : {'PASS' if stable_rho else 'FAIL'}")
        
        self.results["test_6_stability"] = result
        return result
    
    def run_all_tests(self) -> Dict:
        """
        Exécute tous les tests de validation.
        """
        logger.info("=" * 80)
        logger.info("VALIDATION DE L'EOS SILVERA-GOLDMAN POUR H2 LIQUIDE")
        logger.info("=" * 80)
        
        self.test_monotonicity_rho()
        self.test_monotonicity_T()
        self.test_nist_comparison()
        self.test_derivative_consistency()
        self.test_speed_of_sound()
        self.test_stability()
        
        # Résumé
        logger.info("=" * 80)
        logger.info("RÉSUMÉ DES TESTS")
        logger.info("=" * 80)
        
        passed_tests = sum(1 for r in self.results.values() if r.get("passed", False))
        total_tests = len(self.results)
        
        logger.info(f"Tests réussis : {passed_tests}/{total_tests}")
        
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "results": self.results
        }
    
    def plot_results(self, output_dir: str = "/tmp"):
        """
        Génère des graphiques de validation.
        """
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        # Graphique 1 : Pression vs Densité
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        
        # Test 1 : Monotonie en densité
        ax = axes[0, 0]
        result = self.results.get("test_1_monotonicity_rho", {})
        if result:
            ax.plot(result["rho_values"], result["p_values"], 'o-', color='blue', linewidth=2)
            ax.set_xlabel("Densité (kg/m³)")
            ax.set_ylabel("Pression (Pa)")
            ax.set_title("Test 1 : Monotonie en densité (T=25K)")
            ax.grid(True, alpha=0.3)
        
        # Test 2 : Monotonie en température
        ax = axes[0, 1]
        result = self.results.get("test_2_monotonicity_T", {})
        if result:
            ax.plot(result["T_values"], result["p_values"], 'o-', color='red', linewidth=2)
            ax.set_xlabel("Température (K)")
            ax.set_ylabel("Pression (Pa)")
            ax.set_title("Test 2 : Monotonie en température (ρ=65 kg/m³)")
            ax.grid(True, alpha=0.3)
        
        # Test 3 : Comparaison NIST
        ax = axes[1, 0]
        result = self.results.get("test_3_nist_comparison", {})
        if result:
            names = list(result["errors"].keys())
            p_calc = [result["errors"][n]["p_calc"] for n in names]
            p_exp = [result["errors"][n]["p_exp"] for n in names]
            x = np.arange(len(names))
            ax.bar(x - 0.2, p_calc, 0.4, label="Calculée", color='blue', alpha=0.7)
            ax.bar(x + 0.2, p_exp, 0.4, label="Expérimentale", color='red', alpha=0.7)
            ax.set_xlabel("Point NIST")
            ax.set_ylabel("Pression (Pa)")
            ax.set_title("Test 3 : Comparaison avec NIST")
            ax.set_xticks(x)
            ax.set_xticklabels(names, rotation=45)
            ax.legend()
            ax.grid(True, alpha=0.3, axis='y')
        
        # Test 5 : Vitesse du son
        ax = axes[1, 1]
        result = self.results.get("test_5_speed_of_sound", {})
        if result:
            c = result["c"]
            c_min, c_max = result["c_exp_range"]
            ax.barh(["Vitesse du son"], [c], color='green', alpha=0.7)
            ax.axvline(c_min, color='red', linestyle='--', label=f"Min exp: {c_min} m/s")
            ax.axvline(c_max, color='red', linestyle='--', label=f"Max exp: {c_max} m/s")
            ax.set_xlabel("Vitesse (m/s)")
            ax.set_title("Test 5 : Vitesse du son")
            ax.legend()
            ax.grid(True, alpha=0.3, axis='x')
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/eos_validation.png", dpi=150, bbox_inches='tight')
        logger.info(f"Graphiques sauvegardés dans {output_dir}/eos_validation.png")
        plt.close()


if __name__ == "__main__":
    # Configuration du logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Exécuter la validation
    validator = SilveraGoldmanValidator(device="cpu")
    results = validator.run_all_tests()
    
    # Générer les graphiques
    validator.plot_results(output_dir="/tmp")
    
    # Afficher le résumé
    print("\n" + "=" * 80)
    print("RÉSUMÉ FINAL")
    print("=" * 80)
    print(f"Tests réussis : {results['passed_tests']}/{results['total_tests']}")
    print("=" * 80)
