import torch
import numpy as np

class TankGeometry:
    """
    Définit les fonctions de distance signée (SDF) et les fonctions de support TFC
    pour des géométries de réservoirs complexes.
    """
    
    def __init__(self, geometry_type="cylindrical", radius=0.5, length=2.0):
        self.geometry_type = geometry_type
        self.radius = radius
        self.length = length

    def sdf_cylinder(self, x, y, z):
        """
        SDF pour un cylindre aligné sur l'axe X.
        d = max(sqrt(y^2 + z^2) - R, |x| - L/2)
        """
        d_radial = torch.sqrt(y**2 + z**2) - self.radius
        d_axial = torch.abs(x) - self.length / 2.0
        
        # Approximation lisse de la fonction max pour la différentiabilité
        return torch.max(d_radial, d_axial)

    def sdf_sphere(self, x, y, z):
        """SDF pour une sphère de rayon R."""
        return torch.sqrt(x**2 + y**2 + z**2) - self.radius

    def get_mask(self, x, y, z):
        """
        Génère une fonction de masquage qui s'annule exactement aux parois.
        Utilisée comme fonction de support pour TFC.
        """
        if self.geometry_type == "cylindrical":
            d = self.sdf_cylinder(x, y, z)
        elif self.geometry_type == "spherical":
            d = self.sdf_sphere(x, y, z)
        else:
            # Par défaut : boîte unitaire (déjà géré mais inclus pour cohérence)
            d = torch.max(torch.abs(x)-0.5, torch.max(torch.abs(y)-0.5, torch.abs(z)-0.5))
            
        # La fonction de masquage doit être nulle sur la frontière (d=0)
        # et positive à l'intérieur (d < 0).
        # On utilise -d pour que l'intérieur soit positif.
        mask = torch.relu(-d) 
        return mask

    def transform_to_cylindrical(self, x, y, z):
        """Transforme les coordonnées cartésiennes en cylindriques pour faciliter certains calculs."""
        r = torch.sqrt(y**2 + z**2)
        theta = torch.atan2(z, y)
        return x, r, theta
