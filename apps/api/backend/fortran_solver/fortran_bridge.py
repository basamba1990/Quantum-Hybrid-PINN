import os
import ctypes
import numpy as np

class FortranPhysicsEngine:
    def __init__(self, lib_path=None):
        if lib_path is None:
            lib_path = os.path.join(os.path.dirname(__file__), 'libns_solver.so')
        
        if not os.path.exists(lib_path):
            raise FileNotFoundError(f"Bibliothèque Fortran non trouvée à {lib_path}. Exécutez 'make' dans le dossier fortran_solver.")
        
        self.lib = ctypes.CDLL(lib_path)
        
        # Définition de la signature : n_points passé par valeur (c_int), pointeurs en c_void_p, résidus en POINTER(c_double)
        self.lib.compute_ns_residuals_c.argtypes = [
            ctypes.c_int,               # n_points (par valeur si pas de POINTER dans Fortran, ou POINTER si transmis par référence)
            ctypes.c_void_p,            # u
            ctypes.c_void_p,            # v
            ctypes.c_void_p,            # p
            ctypes.c_void_p,            # rho
            ctypes.c_void_p,            # viscosity
            ctypes.POINTER(ctypes.c_double), # res_mass
            ctypes.POINTER(ctypes.c_double), # res_momentum
            ctypes.POINTER(ctypes.c_double)  # res_energy
        ]
        self.lib.compute_ns_residuals_c.restype = None

    def compute_residuals(self, u_arr, v_arr, p_arr, rho_arr, nu_arr):
        n = len(u_arr)
        
        u_np = np.ascontiguousarray(u_arr, dtype=np.float64)
        v_np = np.ascontiguousarray(v_arr, dtype=np.float64)
        p_np = np.ascontiguousarray(p_arr, dtype=np.float64)
        rho_np = np.ascontiguousarray(rho_arr, dtype=np.float64)
        nu_np = np.ascontiguousarray(nu_arr, dtype=np.float64)
        
        res_mass = ctypes.c_double()
        res_mom = ctypes.c_double()
        res_en = ctypes.c_double()
        
        self.lib.compute_ns_residuals_c(
            ctypes.c_int(n),
            u_np.ctypes.data_as(ctypes.c_void_p),
            v_np.ctypes.data_as(ctypes.c_void_p),
            p_np.ctypes.data_as(ctypes.c_void_p),
            rho_np.ctypes.data_as(ctypes.c_void_p),
            nu_np.ctypes.data_as(ctypes.c_void_p),
            ctypes.byref(res_mass),
            ctypes.byref(res_mom),
            ctypes.byref(res_en)
        )
        
        return {
            "mass": float(res_mass.value),
            "momentum": float(res_mom.value),
            "energy": float(res_en.value)
        }
