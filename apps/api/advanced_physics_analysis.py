"""
Advanced Physics Analysis Module
Provides turbulence spectrum computation, boundary layer analysis,
and residual map generation for CFD/PINN hybrid simulations.
"""

import numpy as np
from typing import List, Dict, Optional


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
