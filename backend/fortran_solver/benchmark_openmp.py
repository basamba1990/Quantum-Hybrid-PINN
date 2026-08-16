import time
import numpy as np
import os
from fortran_bridge import FortranPhysicsEngine

def run_openmp_benchmark():
    print("=== Benchmark OpenMP : Multi-threading Performance ===")
    engine = FortranPhysicsEngine()
    
    n = 2_000_000 # 2 millions de points pour voir l'effet du parallélisme
    u = np.random.uniform(1.0, 15.0, n).astype(np.float64)
    v = np.random.uniform(0.0, 0.5, n).astype(np.float64)
    p = np.full(n, 3.5e7, dtype=np.float64)
    rho = np.full(n, 42.5, dtype=np.float64)
    nu = np.full(n, 1.2e-6, dtype=np.float64)
    
    # Test avec différents nombres de threads
    threads_to_test = [1, 2, 4]
    
    print(f"{'Threads':>10} | {'Temps (ms)':>15} | {'Speedup':>10}")
    print("-" * 45)
    
    base_time = 0
    for t in threads_to_test:
        os.environ["OMP_NUM_THREADS"] = str(t)
        
        # Warm-up
        _ = engine.compute_residuals(u, v, p, rho, nu)
        
        start = time.perf_counter()
        for _ in range(5):
            _ = engine.compute_residuals(u, v, p, rho, nu)
        end = time.perf_counter()
        
        avg_time = (end - start) / 5 * 1000
        if t == 1:
            base_time = avg_time
            speedup = 1.0
        else:
            speedup = base_time / avg_time
            
        print(f"{t:10d} | {avg_time:15.4f} | {speedup:9.2f}x")

if __name__ == "__main__":
    run_openmp_benchmark()
