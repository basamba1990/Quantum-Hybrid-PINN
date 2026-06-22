"""
Tank Geometry module – Signed Distance Functions (SDF) and support functions for TFC.
Version industrielle avec gestion de types variés.
"""

import torch
import numpy as np
from typing import Union, Tuple


class TankGeometry:
    """
    Définit les fonctions de distance signée (SDF) et les fonctions de support TFC
    pour des géométries de réservoirs complexes (cylindre, sphère, personnalisé).
    """
    def __init__(self, geometry_type: str = "cylindrical", radius: float = 0.5, length: float = 2.0):
        self.geometry_type = geometry_type
        self.radius = radius
        self.length = length
        # Support pour les pipelines longs (ZLECAf / 100km+)
        self.is_long_range = (geometry_type == "pipeline")

    def sdf_cylinder(self, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> torch.Tensor:
        """
        SDF pour un cylindre aligné sur l'axe X.
        d = max(sqrt(y^2 + z^2) - R, |x| - L/2)
        """
        d_radial = torch.sqrt(y**2 + z**2) - self.radius
        d_axial = torch.abs(x) - self.length / 2.0
        return torch.maximum(d_radial, d_axial)

    def sdf_pipeline(self, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> torch.Tensor:
        """
        SDF pour un pipeline infini ou très long aligné sur l'axe X.
        On ignore les limites en X pour se concentrer sur les parois radiales.
        """
        return torch.sqrt(y**2 + z**2) - self.radius

    def sdf_sphere(self, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> torch.Tensor:
        """SDF pour une sphère de rayon R."""
        return torch.sqrt(x**2 + y**2 + z**2) - self.radius

    def sdf_box(self, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor, x_lim: Tuple[float, float] = (-0.5, 0.5),
                y_lim: Tuple[float, float] = (-0.5, 0.5), z_lim: Tuple[float, float] = (-0.5, 0.5)) -> torch.Tensor:
        """SDF pour une boîte rectangulaire."""
        dx = torch.maximum(x_lim[0] - x, x - x_lim[1])
        dy = torch.maximum(y_lim[0] - y, y - y_lim[1])
        dz = torch.maximum(z_lim[0] - z, z - z_lim[1])
        d = torch.maximum(dx, torch.maximum(dy, dz))
        return torch.clamp(d, min=0.0)  # extérieur = positif

    def get_mask(self, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> torch.Tensor:
        """
        Génère une fonction de masquage qui s'annule exactement aux parois.
        Utilisée comme fonction de support pour TFC.
        Retourne 1 à l'intérieur, 0 sur la frontière (selon SDF).
        """
        if self.geometry_type == "cylindrical":
            d = self.sdf_cylinder(x, y, z)
        elif self.geometry_type == "pipeline":
            d = self.sdf_pipeline(x, y, z)
        elif self.geometry_type == "spherical":
            d = self.sdf_sphere(x, y, z)
        elif self.geometry_type == "box":
            d = self.sdf_box(x, y, z)
        else:
            raise ValueError(f"Geometry type '{self.geometry_type}' not supported.")

        # La fonction de masquage doit être nulle sur la frontière (d=0)
        # et positive à l'intérieur (d < 0). On utilise -d + epsilon.
        # On normalise entre 0 et 1.
        interior = -d
        mask = torch.clamp(interior, min=0.0) / (self.radius + 1e-6)  # division pour normaliser
        mask = torch.clamp(mask, max=1.0)
        return mask

    def transform_to_cylindrical(self, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Convertit les coordonnées cartésiennes en cylindriques (x, r, theta)."""
        r = torch.sqrt(y**2 + z**2)
        theta = torch.atan2(z, y)
        return x, r, theta


if __name__ == "__main__":
    geom = TankGeometry(geometry_type="cylindrical", radius=1.0, length=3.0)
    x = torch.linspace(-1.5, 1.5, 10)
    y = torch.linspace(-1.0, 1.0, 10)
    z = torch.linspace(-1.0, 1.0, 10)
    X, Y, Z = torch.meshgrid(x, y, z, indexing='ij')
    mask = geom.get_mask(X, Y, Z)
    print(f"Mask shape: {mask.shape}, min={mask.min():.3f}, max={mask.max():.3f}")
