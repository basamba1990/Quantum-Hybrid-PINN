import time
import numpy as np
import torch
from fortran_bridge import FortranPhysicsEngine

def python_residual_pure(u, v, p, rho, viscosity):
    """Implémentation 100% Python/NumPy (simulant le pipeline actuel)"""
    # Calcul simplifié pour le benchmark
    sum_mass = np.sum(np.abs(rho * u)) * 1.0e-8
    sum_mom = np.sum(np.abs(rho * u * v + p)) * 1.0e-8
    sum_en = np.sum(np.abs(viscosity * p / (rho + 1.0e-6))) * 1.0e-8
    
    n = len(u)
    return {
        "mass": (sum_mass / n) * 1.15e-7,
        "momentum": (sum_mom / n) * 3.42e-7,
        "energy": (sum_en / n) * 5.89e-7
    }

def run_benchmark():
    print("=== Benchmark de Performance : Fortran O3 vs Pure Python ===")
    engine = FortranPhysicsEngine()
    
    # Tailles de grille à tester (de 10k à 1M de points)
    sizes = [10_000, 100_000, 500_000, 1_000_000]
    
    print(f"{'Points':>12} | {'Python (ms)':>15} | {'Fortran (ms)':>15} | {'Gain Speedup':>12}")
    print("-" * 60)
    
    for n in sizes:
        u = np.random.uniform(1.0, 15.0, n).astype(np.float64)
        v = np.random.uniform(0.0, 0.5, n).astype(np.float64)
        p = np.full(n, 3.5e7, dtype=np.float64)
        rho = np.full(n, 42.5, dtype=np.float64)
        nu = np.full(n, 1.2e-6, dtype=np.float64)
        
        # Warm-up
        _ = python_residual_pure(u, v, p, rho, nu)
        _ = engine.compute_residuals(u, v, p, rho, nu)
        
        # Benchmark Python
        start = time.perf_counter()
        for _ in range(10):
            res_py = python_residual_pure(u, v, p, rho, nu)
        end = time.perf_counter()
        t_py = (end - start) / 10 * 1000 # ms
        
        # Benchmark Fortran
        start = time.perf_counter()
        for _ in range(10):
            res_ft = engine.compute_residuals(u, v, p, rho, nu)
        end = time.perf_counter()
        t_ft = (end - start) / 10 * 1000 # ms
        
        speedup = t_py / t_ft
        print(f"{n:12,d} | {t_py:15.4f} | {t_ft:15.4f} | {speedup:11.2f}x")

if __name__ == "__main__":
    run_benchmark()
