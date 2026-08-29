"""
Advanced Physics Analysis Module
Provides turbulence spectrum computation, boundary layer analysis,
and residual map generation for CFD/PINN hybrid simulations.
"""

import numpy as np
from typing import List, Dict, Optional, Any


class AdvancedPhysicsAnalysis:
    """Advanced physics analysis service for turbulence, boundary layer, and residual analysis."""

    def __init__(self, fluid_engine=None):
        self.fluid_engine = fluid_engine
        self._results_cache: Dict = {}

    def compute_turbulence_spectrum(
        self,
        velocity_fields: List[np.ndarray],
        dx: float,
        dy: float,
        dz: float,
    ) -> Dict:
        """Compute turbulence energy spectrum from 3D velocity fields.

        Args:
            velocity_fields: List of 3 numpy arrays [u, v, w] representing
                the velocity components on a uniform 3D grid.
            dx, dy, dz: Grid spacings in each direction.

        Returns:
            Dictionary containing wavenumbers, energy spectrum, and metadata.
        """
        if len(velocity_fields) != 3:
            raise ValueError("velocity_fields must contain exactly 3 arrays (u, v, w)")

        u, v, w = velocity_fields

        # Grid dimensions
        nx, ny, nz = u.shape

        # FFT of velocity components
        u_hat = np.fft.fftn(u, norm="ortho")
        v_hat = np.fft.fftn(v, norm="ortho")
        w_hat = np.fft.fftn(w, norm="ortho")

        # Wavenumber grids
        kx = np.fft.fftfreq(nx, d=dx) * 2 * np.pi
        ky = np.fft.fftfreq(ny, d=dy) * 2 * np.pi
        kz = np.fft.fftfreq(nz, d=dz) * 2 * np.pi

        # 3D wavenumber magnitude
        KX, KY, KZ = np.meshgrid(kx, ky, kz, indexing="ij")
        k_mag = np.sqrt(KX**2 + KY**2 + KZ**2)

        # Energy spectrum E(k) = 0.5 * (|u_hat|^2 + |v_hat|^2 + |w_hat|^2)
        energy = 0.5 * (np.abs(u_hat)**2 + np.abs(v_hat)**2 + np.abs(w_hat)**2)

        # Bin the spectrum into 1D bins of k magnitude
        k_max = max(k_mag.max(), 1e-10)
        n_bins = min(nx, ny, nz) // 2
        k_bins = np.linspace(0, k_max, n_bins + 1)
        bin_centers = 0.5 * (k_bins[:-1] + k_bins[1:])

        e_1d = np.zeros(n_bins)
        for i in range(n_bins):
            mask = (k_mag >= k_bins[i]) & (k_mag < k_bins[i + 1])
            if mask.any():
                e_1d[i] = np.sum(energy[mask])

        # Reynolds number estimate (using kinetic energy)
        u_rms = np.sqrt(np.mean(u**2 + v**2 + w**2))
        tke = 0.5 * u_rms**2

        # Enstrophy
        du_dy = np.gradient(u, dy, axis=1)
        dv_dx = np.gradient(v, dx, axis=0)
        enstrophy = 0.5 * np.mean((du_dy - dv_dx)**2)

        return {
            "wavenumbers": bin_centers.tolist(),
            "energy_spectrum": e_1d.tolist(),
            "tke": float(tke),
            "u_rms": float(u_rms),
            "enstrophy": float(enstrophy),
            "grid_size": {"nx": nx, "ny": ny, "nz": nz},
            "dx": dx,
            "dy": dy,
            "dz": dz,
        }

    def compute_boundary_layer_thickness(
        self,
        velocity_profile: np.ndarray,
        y_coords: np.ndarray,
        u_infinity: Optional[float] = None,
        threshold: float = 0.99,
    ) -> Dict:
        """Estimate boundary layer thickness from a velocity profile.

        Args:
            velocity_profile: 1D array of streamwise velocity values.
            y_coords: Corresponding wall-normal coordinates.
            u_infinity: Free-stream velocity. If None, uses max of profile.
            threshold: Fraction of u_infinity defining the boundary layer edge.

        Returns:
            Dictionary with delta (boundary layer thickness), displacement
            thickness, momentum thickness, and shape factor.
        """
        if u_infinity is None:
            u_infinity = float(np.max(velocity_profile))

        if u_infinity == 0:
            return {"delta": 0.0, "delta_star": 0.0, "theta": 0.0, "shape_factor": 0.0}

        # Boundary layer thickness: y where u(y) >= threshold * u_infinity
        edge_idx = np.searchsorted(velocity_profile, threshold * u_infinity)
        delta = float(y_coords[min(edge_idx, len(y_coords) - 1)])

        # Displacement thickness: integral(1 - u/U_inf) dy
        integrand1 = 1.0 - velocity_profile / u_infinity
        integrand1 = np.clip(integrand1, 0, 1)
        delta_star = float(np.trapz(integrand1, y_coords))

        # Momentum thickness: integral(u/U_inf)(1 - u/U_inf) dy
        u_ratio = velocity_profile / u_infinity
        integrand2 = u_ratio * (1.0 - u_ratio)
        theta = float(np.trapz(integrand2, y_coords))

        # Shape factor
        shape_factor = float(delta_star / theta) if theta > 0 else 0.0

        return {
            "delta": delta,
            "delta_star": delta_star,
            "theta": theta,
            "shape_factor": shape_factor,
            "u_infinity": float(u_infinity),
        }

    def compute_residual_norms(
        self,
        residuals: Dict[str, np.ndarray],
    ) -> Dict[str, float]:
        """Compute L1, L2, and Linf norms for each residual field.

        Args:
            residuals: Dictionary mapping residual names to numpy arrays.

        Returns:
            Dictionary mapping residual names to their norm dictionaries.
        """
        norms = {}
        for name, field in residuals.items():
            arr = np.asarray(field)
            norms[name] = {
                "L1": float(np.mean(np.abs(arr))),
                "L2": float(np.sqrt(np.mean(arr**2))),
                "Linf": float(np.max(np.abs(arr))),
            }
        return norms

    def validate_mass_conservation(
        self,
        density_field: np.ndarray,
        velocity_u: np.ndarray,
        velocity_v: np.ndarray,
        velocity_w: np.ndarray,
        dx: float,
        dy: float,
        dz: float,
        dt: float,
    ) -> Dict:
        """Validate continuity equation: d(rho)/dt + div(rho*u) = 0.

        Returns mass conservation residual statistics.
        """
        drho_dt = np.gradient(density_field, dt, axis=0)

        drho_u_dx = np.gradient(density_field * velocity_u, dx, axis=1)
        drho_v_dy = np.gradient(density_field * velocity_v, dy, axis=2)
        drho_w_dz = np.gradient(density_field * velocity_w, dz, axis=3) if density_field.ndim == 4 else 0.0

        if density_field.ndim == 4:
            continuity_residual = drho_dt + drho_u_dx + drho_v_dy + drho_w_dz
        else:
            continuity_residual = drho_dt + drho_u_dx + drho_v_dy

        return {
            "mean_residual": float(np.mean(np.abs(continuity_residual))),
            "max_residual": float(np.max(np.abs(continuity_residual))),
            "rms_residual": float(np.sqrt(np.mean(continuity_residual**2))),
            "is_conserved": bool(np.mean(np.abs(continuity_residual)) < 1e-4),
        }

    def compute_vorticity(self, u: np.ndarray, v: np.ndarray, w: np.ndarray, dx: float, dy: float, dz: float) -> Dict:
        """Compute vorticity components from 3D velocity fields."""
        dv_dx = np.gradient(v, dx, axis=0)
        du_dy = np.gradient(u, dy, axis=1)
        dw_dy = np.gradient(w, dy, axis=1)
        dv_dz = np.gradient(v, dz, axis=2)
        du_dz = np.gradient(u, dz, axis=2)
        dw_dx = np.gradient(w, dx, axis=0)

        omega_x = dw_dy - dv_dz
        omega_y = du_dz - dw_dx
        omega_z = dv_dx - du_dy

        return {
            "omega_x": omega_x.tolist(),
            "omega_y": omega_y.tolist(),
            "omega_z": omega_z.tolist(),
            "magnitude": np.sqrt(omega_x**2 + omega_y**2 + omega_z**2).tolist()
        }

    def compute_reynolds_stress_tensor(self, u: np.ndarray, v: np.ndarray, w: np.ndarray) -> Dict:
        """Compute Reynolds stress tensor components from 3D velocity fields.
        Assumes u, v, w are fluctuating components (u' = u - mean(u)).
        """
        # For simplicity, assuming these are already fluctuating components or we compute fluctuations here
        # In a real scenario, you'd need time-averaged or ensemble-averaged fields to get fluctuations
        u_prime = u - np.mean(u)
        v_prime = v - np.mean(v)
        w_prime = w - np.mean(w)

        tau_xx = -np.mean(u_prime * u_prime)
        tau_yy = -np.mean(v_prime * v_prime)
        tau_zz = -np.mean(w_prime * w_prime)
        tau_xy = -np.mean(u_prime * v_prime)
        tau_xz = -np.mean(u_prime * w_prime)
        tau_yz = -np.mean(v_prime * w_prime)

        return {
            "tau_xx": float(tau_xx),
            "tau_yy": float(tau_yy),
            "tau_zz": float(tau_zz),
            "tau_xy": float(tau_xy),
            "tau_xz": float(tau_xz),
            "tau_yz": float(tau_yz),
        }

    def derive_fields(
        self,
        predictions3d: List[Dict[str, Any]],
        dx: float = 0.01, # Placeholder, should be derived from data
        dy: float = 0.01, # Placeholder, should be derived from data
        dz: float = 0.01  # Placeholder, should be derived from data
    ) -> Dict[str, Any]:
        """Derive advanced physics fields from 3D predictions."""
        if not predictions3d:
            return {}

        # Convert list of dicts to structured numpy arrays for easier processing
        # Assuming predictions3d contains 'x', 'y', 'z', 'velocity_u', 'velocity_v', 'velocity_w', 'temperature', 'pressure', 'density'
        xs = np.array([p['x'] for p in predictions3d])
        ys = np.array([p['y'] for p in predictions3d])
        zs = np.array([p['z'] for p in predictions3d])
        us = np.array([p['velocity_u'] for p in predictions3d])
        vs = np.array([p['velocity_v'] for p in predictions3d])
        ws = np.array([p['velocity_w'] for p in predictions3d])
        temps = np.array([p['temperature'] for p in predictions3d])
        pressures = np.array([p['pressure'] for p in predictions3d])
        densities = np.array([p['density'] for p in predictions3d])

        # Determine grid dimensions and spacing (simplified for now)
        # This needs to be more robust, potentially reconstructing a grid from scattered points
        unique_x = np.sort(np.unique(xs))
        unique_y = np.sort(np.unique(ys))
        unique_z = np.sort(np.unique(zs))

        nx, ny, nz = len(unique_x), len(unique_y), len(unique_z)

        # If the data is not on a perfect grid, interpolation would be needed.
        # For now, assume it's somewhat structured or dense enough for gradient calculations.
        # Reshape to 3D grid if possible, otherwise operate on flattened arrays and handle gradients carefully.
        # For simplicity, let's assume a structured grid can be formed.
        # This part is critical and might need a more sophisticated grid reconstruction or interpolation.
        # For a first pass, let's assume the predictions3d are ordered such that reshaping works.
        
        # Placeholder for grid reconstruction - this is a simplification
        # A proper implementation would involve interpolation onto a regular grid
        try:
            u_grid = us.reshape(nx, ny, nz)
            v_grid = vs.reshape(nx, ny, nz)
            w_grid = ws.reshape(nx, ny, nz)
            temp_grid = temps.reshape(nx, ny, nz)
            pressure_grid = pressures.reshape(nx, ny, nz)
            density_grid = densities.reshape(nx, ny, nz)

            # Recalculate dx, dy, dz from unique coordinates
            dx = np.mean(np.diff(unique_x)) if nx > 1 else 0.01
            dy = np.mean(np.diff(unique_y)) if ny > 1 else 0.01
            dz = np.mean(np.diff(unique_z)) if nz > 1 else 0.01

        except ValueError: # Data might not be perfectly gridded
            # Fallback: operate on flattened arrays, gradients will be less accurate
            # Or, more robustly, interpolate onto a regular grid first.
            # For now, we'll use the flattened arrays and acknowledge potential inaccuracies.
            u_grid, v_grid, w_grid = us, vs, ws
            temp_grid, pressure_grid, density_grid = temps, pressures, densities
            # If not gridded, dx, dy, dz are less meaningful for gradient calculation across the whole domain
            # Use default values or infer from min/max range and number of points
            dx = (np.max(xs) - np.min(xs)) / (nx - 1) if nx > 1 else 0.01
            dy = (np.max(ys) - np.min(ys)) / (ny - 1) if ny > 1 else 0.01
            dz = (np.max(zs) - np.min(zs)) / (nz - 1) if nz > 1 else 0.01

        derived_data = {}

        # 1. TKE, Spectre E(k)
        if u_grid.ndim == 3: # Only if gridded for now
            turbulence_results = self.compute_turbulence_spectrum([u_grid, v_grid, w_grid], dx, dy, dz)
            derived_data.update({
                "tke": turbulence_results.get("tke"),
                "energy_spectrum": turbulence_results.get("energy_spectrum"),
                "wavenumbers": turbulence_results.get("wavenumbers"),
            })
        else:
            # Simplified TKE for non-gridded data
            tke_flat = 0.5 * (us**2 + vs**2 + ws**2)
            derived_data["tke"] = float(np.mean(tke_flat))
            derived_data["energy_spectrum"] = [] # Not computable without grid
            derived_data["wavenumbers"] = []

        # 2. Vorticité
        if u_grid.ndim == 3:
            vorticity_results = self.compute_vorticity(u_grid, v_grid, w_grid, dx, dy, dz)
            derived_data.update({
                "vorticity_x": vorticity_results.get("omega_x"),
                "vorticity_y": vorticity_results.get("omega_y"),
                "vorticity_z": vorticity_results.get("omega_z"),
                "vorticity_magnitude": vorticity_results.get("magnitude"),
            })
        else:
            derived_data["vorticity_magnitude"] = [] # Not computable without grid

        # 3. Tenseur de Reynolds (simplified, needs time-averaged data for true fluctuations)
        reynolds_stress_results = self.compute_reynolds_stress_tensor(us, vs, ws)
        derived_data.update(reynolds_stress_results)

        # 4. Résidus PDE : absence de preuve explicite = UNAVAILABLE.
        # Cette analyse dérivée n'a pas accès au modèle PINN et ne doit donc
        # jamais fabriquer un résidu à partir d'un tirage aléatoire ou d'un zéro.
        derived_data["pde_residuals"] = {
            "continuity": None,
            "momentum": None,
            "energy": None,
            "status": "UNAVAILABLE",
            "computed_by": None,
        }
        residual_points = [
            p.get("residuals") for p in predictions3d
            if isinstance(p.get("residuals"), dict)
        ]
        if residual_points:
            def _mean_finite(key):
                values = [r.get(key) for r in residual_points]
                values = [float(v) for v in values if isinstance(v, (int, float)) and np.isfinite(v)]
                return float(np.mean(values)) if values else None

            derived_data["pde_residuals"] = {
                "continuity": _mean_finite("continuity"),
                "momentum": _mean_finite("momentum"),
                "energy": _mean_finite("energy"),
                "status": "COMPUTED_FROM_PERSISTED_POINTWISE_EVIDENCE",
                "computed_by": "persisted_predictions3d.residuals",
            }

        # 5. Profil couche limite (requires specific wall-normal profile)
        # This needs a specific slice of data near a wall. For a general 3D dataset,
        # we can't compute a single boundary layer profile without more context.
        # We'll return a placeholder or a simplified example.
        # For demonstration, let's assume a profile along y-axis near x=0, z=0
        # This needs to be refined based on actual geometry and wall location
        boundary_layer_profile = []
        # Example: if we had a wall at y_min, we'd filter points near it
        # For now, return a dummy or simplified profile
        if len(unique_y) > 1:
            # Simple example: take a slice at median x and z, and sort by y
            median_x = np.median(xs)
            median_z = np.median(zs)
            slice_points = [p for p in predictions3d if np.isclose(p['x'], median_x, atol=dx*2) and np.isclose(p['z'], median_z, atol=dz*2)]
            slice_points.sort(key=lambda p: p['y'])
            if len(slice_points) > 5:
                y_coords_bl = np.array([p['y'] for p in slice_points])
                velocity_profile_bl = np.array([np.sqrt(p['velocity_u']**2 + p['velocity_v']**2 + p['velocity_w']**2) for p in slice_points])
                if np.max(velocity_profile_bl) > 1e-6: # Avoid division by zero
                    bl_results = self.compute_boundary_layer_thickness(velocity_profile_bl, y_coords_bl)
                    derived_data["boundary_layer_profile"] = bl_results
                else:
                    derived_data["boundary_layer_profile"] = {"delta": 0.0, "delta_star": 0.0, "theta": 0.0, "shape_factor": 0.0}
            else:
                derived_data["boundary_layer_profile"] = {"message": "Not enough points for boundary layer profile in this slice."}
        else:
            derived_data["boundary_layer_profile"] = {"message": "Not enough variation in Y for boundary layer profile."}

        return derived_data