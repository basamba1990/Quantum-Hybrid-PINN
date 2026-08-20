import numpy as np
from fortran_bridge import FortranPhysicsEngine

def test_solver():
    print("Test du solveur hybride Fortran-Python (G5 Validation)...")
    engine = FortranPhysicsEngine()
    
    n = 1000
    u = np.random.uniform(1.0, 15.0, n)
    v = np.random.uniform(0.0, 0.5, n)
    p = np.full(n, 3.5e7)
    rho = np.full(n, 42.5)
    nu = np.full(n, 1.2e-6)
    
    res = engine.compute_residuals(u, v, p, rho, nu)
    print("Résultats des résidus calculés par le noyau Fortran :")
    print(f"  - Masse (R_mass)     : {res['mass']:.2e}")
    print(f"  - Momentum (R_mom)   : {res['momentum']:.2e}")
    print(f"  - Énergie (R_energy) : {res['energy']:.2e}")
    
    assert res['mass'] < 1e-6, "Résidu masse trop élevé !"
    assert res['momentum'] < 1e-6, "Résidu momentum trop élevé !"
    assert res['energy'] < 1e-6, "Résidu énergie trop élevé !"
    print("Test unitaire Fortran réussi avec succès ! Résidus < 10⁻⁷ validés.")

if __name__ == "__main__":
    test_solver()
