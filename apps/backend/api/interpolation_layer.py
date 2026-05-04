"""
Couche d'interpolation intelligente pour adapter les données OpenFOAM au modèle FNO.
Gère les conflits de dimensions entre les sorties OpenFOAM et les entrées du modèle FNO.
"""

import numpy as np
from typing import Tuple, Dict, Any, Optional
from scipy.interpolate import RegularGridInterpolator
import logging

logger = logging.getLogger(__name__)


class InterpolationLayer:
    """Couche d'interpolation pour adapter les dimensions des données."""

    def __init__(self, target_shape: Tuple[int, int, int] = (32, 32, 32)):
        """
        Initialiser la couche d'interpolation.

        Args:
            target_shape: Forme cible pour les données (par défaut 32x32x32 pour FNO).
        """
        self.target_shape = target_shape
        logger.info(f"InterpolationLayer initialized with target shape: {target_shape}")

    def adapt_data(
        self,
        data: np.ndarray,
        method: str = "linear",
        preserve_bounds: bool = True
    ) -> np.ndarray:
        """
        Adapter les données à la forme cible.

        Args:
            data: Données d'entrée (peut être 3D ou 4D).
            method: Méthode d'interpolation ('linear', 'nearest', 'cubic').
            preserve_bounds: Préserver les limites des données originales.

        Returns:
            Données adaptées à la forme cible.
        """
        if data.ndim == 3:
            return self._interpolate_3d(data, method, preserve_bounds)
        elif data.ndim == 4:
            # Traiter chaque canal séparément
            adapted_channels = []
            for i in range(data.shape[0]):
                adapted = self._interpolate_3d(data[i], method, preserve_bounds)
                adapted_channels.append(adapted)
            return np.stack(adapted_channels, axis=0)
        else:
            raise ValueError(f"Expected 3D or 4D data, got {data.ndim}D")

    def _interpolate_3d(
        self,
        data: np.ndarray,
        method: str = "linear",
        preserve_bounds: bool = True
    ) -> np.ndarray:
        """
        Interpoler les données 3D à la forme cible.

        Args:
            data: Données 3D.
            method: Méthode d'interpolation.
            preserve_bounds: Préserver les limites.

        Returns:
            Données interpolées.
        """
        original_shape = data.shape
        logger.debug(f"Interpolating from shape {original_shape} to {self.target_shape}")

        if original_shape == self.target_shape:
            logger.debug("Data already has target shape, no interpolation needed")
            return data

        # Utiliser scipy pour l'interpolation
        try:
            # Créer les grilles de coordonnées
            x_orig = np.linspace(0, 1, original_shape[0])
            y_orig = np.linspace(0, 1, original_shape[1])
            z_orig = np.linspace(0, 1, original_shape[2])

            # Créer l'interpolateur
            if method == "linear":
                interpolator = RegularGridInterpolator(
                    (x_orig, y_orig, z_orig),
                    data,
                    method="linear",
                    bounds_error=not preserve_bounds,
                    fill_value=np.nan if preserve_bounds else "extrapolate"
                )
            elif method == "nearest":
                interpolator = RegularGridInterpolator(
                    (x_orig, y_orig, z_orig),
                    data,
                    method="nearest",
                    bounds_error=False,
                    fill_value=np.nan
                )
            else:
                logger.warning(f"Method {method} not supported, using linear")
                interpolator = RegularGridInterpolator(
                    (x_orig, y_orig, z_orig),
                    data,
                    method="linear",
                    bounds_error=not preserve_bounds,
                    fill_value=np.nan if preserve_bounds else "extrapolate"
                )

            # Créer les points d'évaluation
            x_new = np.linspace(0, 1, self.target_shape[0])
            y_new = np.linspace(0, 1, self.target_shape[1])
            z_new = np.linspace(0, 1, self.target_shape[2])

            xx, yy, zz = np.meshgrid(x_new, y_new, z_new, indexing="ij")
            points = np.stack([xx, yy, zz], axis=-1)

            # Interpoler
            adapted_data = interpolator(points)

            # Gérer les NaN si preserve_bounds est True
            if preserve_bounds and np.isnan(adapted_data).any():
                logger.warning("NaN values detected after interpolation, filling with nearest valid value")
                adapted_data = self._fill_nan_values(adapted_data)

            logger.debug(f"Interpolation successful: {original_shape} -> {self.target_shape}")
            return adapted_data

        except Exception as e:
            logger.error(f"Interpolation failed: {e}")
            raise

    def _fill_nan_values(self, data: np.ndarray) -> np.ndarray:
        """
        Remplir les valeurs NaN avec les valeurs les plus proches.

        Args:
            data: Données contenant des NaN.

        Returns:
            Données sans NaN.
        """
        mask = np.isnan(data)
        if not mask.any():
            return data

        # Utiliser la moyenne des valeurs valides
        valid_values = data[~mask]
        if len(valid_values) > 0:
            fill_value = np.mean(valid_values)
        else:
            fill_value = 0.0

        data[mask] = fill_value
        return data

    def adapt_batch(
        self,
        batch: np.ndarray,
        method: str = "linear"
    ) -> np.ndarray:
        """
        Adapter un batch de données.

        Args:
            batch: Batch de données (N, C, H, W, D) ou (N, H, W, D).
            method: Méthode d'interpolation.

        Returns:
            Batch adapté.
        """
        if batch.ndim == 5:
            # Format (N, C, H, W, D)
            n_samples, n_channels = batch.shape[0], batch.shape[1]
            adapted_batch = np.zeros(
                (n_samples, n_channels, *self.target_shape),
                dtype=batch.dtype
            )
            for i in range(n_samples):
                adapted_batch[i] = self.adapt_data(batch[i], method)
            return adapted_batch
        elif batch.ndim == 4:
            # Format (N, H, W, D)
            n_samples = batch.shape[0]
            adapted_batch = np.zeros(
                (n_samples, *self.target_shape),
                dtype=batch.dtype
            )
            for i in range(n_samples):
                adapted_batch[i] = self.adapt_data(batch[i], method)
            return adapted_batch
        else:
            raise ValueError(f"Expected 4D or 5D batch, got {batch.ndim}D")

    def get_scaling_factors(self) -> Dict[str, float]:
        """
        Obtenir les facteurs d'échelle pour la transformation.

        Returns:
            Dictionnaire contenant les facteurs d'échelle.
        """
        return {
            "target_shape": self.target_shape,
            "total_voxels": np.prod(self.target_shape)
        }


class DynamicInterpolationLayer(InterpolationLayer):
    """
    Couche d'interpolation dynamique qui détecte automatiquement la forme source.
    """

    def __init__(self, target_shape: Tuple[int, int, int] = (32, 32, 32)):
        """
        Initialiser la couche d'interpolation dynamique.

        Args:
            target_shape: Forme cible pour les données.
        """
        super().__init__(target_shape)
        self.last_source_shape = None

    def adapt_data_dynamic(
        self,
        data: np.ndarray,
        method: str = "linear"
    ) -> np.ndarray:
        """
        Adapter les données en détectant automatiquement la forme source.

        Args:
            data: Données d'entrée.
            method: Méthode d'interpolation.

        Returns:
            Données adaptées à la forme cible.
        """
        if data.ndim == 3:
            self.last_source_shape = data.shape
            logger.info(f"Auto-detected source shape: {data.shape}")
            return self.adapt_data(data, method)
        elif data.ndim == 4:
            self.last_source_shape = data.shape[1:]
            logger.info(f"Auto-detected source shape (per channel): {data.shape[1:]}")
            return self.adapt_data(data, method)
        else:
            raise ValueError(f"Expected 3D or 4D data, got {data.ndim}D")

    def get_adaptation_info(self) -> Dict[str, Any]:
        """
        Obtenir les informations sur l'adaptation.

        Returns:
            Dictionnaire contenant les informations d'adaptation.
        """
        return {
            "source_shape": self.last_source_shape,
            "target_shape": self.target_shape,
            "scaling_factors": {
                "x": self.target_shape[0] / self.last_source_shape[0] if self.last_source_shape else None,
                "y": self.target_shape[1] / self.last_source_shape[1] if self.last_source_shape else None,
                "z": self.target_shape[2] / self.last_source_shape[2] if self.last_source_shape else None,
            }
        }


# Exemple d'utilisation
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Créer des données de test
    test_data = np.random.randn(16, 16, 16)
    print(f"Original data shape: {test_data.shape}")

    # Adapter les données
    interpolator = InterpolationLayer(target_shape=(32, 32, 32))
    adapted_data = interpolator.adapt_data(test_data)
    print(f"Adapted data shape: {adapted_data.shape}")

    # Tester avec un batch
    batch_data = np.random.randn(4, 16, 16, 16)
    adapted_batch = interpolator.adapt_batch(batch_data)
    print(f"Adapted batch shape: {adapted_batch.shape}")

    # Tester l'interpolation dynamique
    dynamic_interpolator = DynamicInterpolationLayer()
    adapted_dynamic = dynamic_interpolator.adapt_data_dynamic(test_data)
    print(f"Dynamically adapted shape: {adapted_dynamic.shape}")
    print(f"Adaptation info: {dynamic_interpolator.get_adaptation_info()}")
