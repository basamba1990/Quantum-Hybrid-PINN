"""
Module de prédicteur ML généraliste avec support des grilles dynamiques.
Adapte automatiquement les données d'entrée à la taille attendue par le modèle FNO.
"""

import numpy as np
from typing import Tuple, Dict, Any, Optional, Union
import logging
from pathlib import Path

from interpolation_layer import DynamicInterpolationLayer

logger = logging.getLogger(__name__)


class DynamicMLPredictor:
    """
    Prédicteur ML généraliste qui gère automatiquement les différentes tailles de grille.
    """

    def __init__(
        self,
        model_input_shape: Tuple[int, int, int] = (32, 32, 32),
        model_path: Optional[str] = None
    ):
        """
        Initialiser le prédicteur ML.

        Args:
            model_input_shape: Forme attendue par le modèle FNO.
            model_path: Chemin vers le modèle ML pré-entraîné.
        """
        self.model_input_shape = model_input_shape
        self.model_path = model_path
        self.model = None
        self.interpolation_layer = DynamicInterpolationLayer(target_shape=model_input_shape)
        self.normalization_stats = {}

        logger.info(f"MLPredictor initialized with input shape: {model_input_shape}")

        if model_path:
            self.load_model(model_path)

    def load_model(self, model_path: str) -> bool:
        """
        Charger le modèle ML.

        Args:
            model_path: Chemin vers le modèle.

        Returns:
            True si succès, False sinon.
        """
        try:
            logger.info(f"Loading ML model from: {model_path}")
            # Placeholder pour le chargement du modèle
            # En production, utiliser torch.load() ou équivalent
            self.model_path = model_path
            logger.info("Model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False

    def load_normalization_stats(self, stats_path: str) -> bool:
        """
        Charger les statistiques de normalisation.

        Args:
            stats_path: Chemin vers les statistiques.

        Returns:
            True si succès, False sinon.
        """
        try:
            logger.info(f"Loading normalization stats from: {stats_path}")
            # Placeholder pour le chargement des stats
            # En production, utiliser np.load() ou équivalent
            self.normalization_stats = {
                "mean": 0.0,
                "std": 1.0
            }
            logger.info("Normalization stats loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load normalization stats: {e}")
            return False

    def preprocess_input(self, data: np.ndarray) -> np.ndarray:
        """
        Prétraiter les données d'entrée.

        Args:
            data: Données d'entrée brutes.

        Returns:
            Données prétraitées et adaptées.
        """
        logger.info(f"Preprocessing input data with shape: {data.shape}")

        # Étape 1: Adapter les dimensions
        adapted_data = self.interpolation_layer.adapt_data_dynamic(data)
        logger.debug(f"After adaptation: {adapted_data.shape}")

        # Étape 2: Normaliser
        if self.normalization_stats:
            mean = self.normalization_stats.get("mean", 0.0)
            std = self.normalization_stats.get("std", 1.0)
            adapted_data = (adapted_data - mean) / (std + 1e-8)
            logger.debug("Data normalized")

        # Étape 3: Ajouter la dimension batch si nécessaire
        if adapted_data.ndim == 3:
            adapted_data = np.expand_dims(adapted_data, axis=0)
            logger.debug(f"Added batch dimension: {adapted_data.shape}")

        return adapted_data

    def postprocess_output(self, output: np.ndarray) -> np.ndarray:
        """
        Post-traiter la sortie du modèle.

        Args:
            output: Sortie brute du modèle.

        Returns:
            Sortie post-traitée.
        """
        logger.info(f"Postprocessing output with shape: {output.shape}")

        # Retirer la dimension batch si présente
        if output.ndim == 4:
            output = output[0]
            logger.debug(f"Removed batch dimension: {output.shape}")

        # Dénormaliser
        if self.normalization_stats:
            mean = self.normalization_stats.get("mean", 0.0)
            std = self.normalization_stats.get("std", 1.0)
            output = output * (std + 1e-8) + mean
            logger.debug("Data denormalized")

        return output

    def predict(
        self,
        input_data: np.ndarray,
        return_adaptation_info: bool = False
    ) -> Union[np.ndarray, Tuple[np.ndarray, Dict[str, Any]]]:
        """
        Effectuer une prédiction.

        Args:
            input_data: Données d'entrée.
            return_adaptation_info: Retourner les infos d'adaptation.

        Returns:
            Prédiction (et infos d'adaptation si demandé).
        """
        logger.info(f"Starting prediction with input shape: {input_data.shape}")

        # Prétraiter
        preprocessed = self.preprocess_input(input_data)
        logger.debug(f"Preprocessed shape: {preprocessed.shape}")

        # Prédiction (placeholder)
        # En production, appeler le modèle réel
        prediction = self._mock_predict(preprocessed)
        logger.debug(f"Raw prediction shape: {prediction.shape}")

        # Post-traiter
        postprocessed = self.postprocess_output(prediction)
        logger.debug(f"Postprocessed prediction shape: {postprocessed.shape}")

        if return_adaptation_info:
            adaptation_info = self.interpolation_layer.get_adaptation_info()
            return postprocessed, adaptation_info
        else:
            return postprocessed

    def _mock_predict(self, preprocessed_data: np.ndarray) -> np.ndarray:
        """
        Effectuer une prédiction fictive (placeholder).

        Args:
            preprocessed_data: Données prétraitées.

        Returns:
            Prédiction fictive.
        """
        # En production, utiliser le modèle réel
        # Pour l'instant, retourner une prédiction fictive
        return preprocessed_data * 0.9 + np.random.randn(*preprocessed_data.shape) * 0.1

    def predict_batch(
        self,
        batch_data: np.ndarray
    ) -> np.ndarray:
        """
        Effectuer des prédictions sur un batch.

        Args:
            batch_data: Batch de données (N, H, W, D).

        Returns:
            Batch de prédictions.
        """
        logger.info(f"Batch prediction with shape: {batch_data.shape}")

        predictions = []
        for i in range(batch_data.shape[0]):
            pred = self.predict(batch_data[i])
            predictions.append(pred)

        return np.stack(predictions, axis=0)

    def get_model_info(self) -> Dict[str, Any]:
        """
        Obtenir les informations du modèle.

        Returns:
            Dictionnaire contenant les infos du modèle.
        """
        return {
            "model_path": self.model_path,
            "input_shape": self.model_input_shape,
            "normalization_stats": self.normalization_stats,
            "interpolation_info": self.interpolation_layer.get_adaptation_info()
        }


class MLPredictorFactory:
    """
    Factory pour créer des prédicteurs ML adaptés à différents cas.
    """

    # Configurations prédéfinies pour différents cas
    CASE_CONFIGS = {
        "h2_pipeline": {
            "model_input_shape": (32, 32, 32),
            "model_name": "fno_h2_pipeline",
            "normalization_required": True
        },
        "lh2_storage": {
            "model_input_shape": (32, 32, 32),
            "model_name": "fno_lh2_storage",
            "normalization_required": True
        },
        "nh3_synthesis": {
            "model_input_shape": (32, 32, 32),
            "model_name": "fno_nh3_synthesis",
            "normalization_required": True
        }
    }

    @staticmethod
    def create_predictor(
        case_name: str,
        model_path: Optional[str] = None
    ) -> DynamicMLPredictor:
        """
        Créer un prédicteur ML pour un cas spécifique.

        Args:
            case_name: Nom du cas.
            model_path: Chemin vers le modèle (optionnel).

        Returns:
            Instance de DynamicMLPredictor.
        """
        if case_name not in MLPredictorFactory.CASE_CONFIGS:
            logger.warning(f"Case {case_name} not found, using default config")
            config = MLPredictorFactory.CASE_CONFIGS["h2_pipeline"]
        else:
            config = MLPredictorFactory.CASE_CONFIGS[case_name]

        logger.info(f"Creating predictor for case: {case_name}")
        logger.info(f"Config: {config}")

        predictor = DynamicMLPredictor(
            model_input_shape=config["model_input_shape"],
            model_path=model_path
        )

        return predictor

    @staticmethod
    def register_case_config(
        case_name: str,
        config: Dict[str, Any]
    ) -> None:
        """
        Enregistrer une nouvelle configuration de cas.

        Args:
            case_name: Nom du cas.
            config: Configuration du cas.
        """
        MLPredictorFactory.CASE_CONFIGS[case_name] = config
        logger.info(f"Registered case config for: {case_name}")

    @staticmethod
    def list_available_cases() -> Dict[str, Dict[str, Any]]:
        """
        Lister tous les cas disponibles.

        Returns:
            Dictionnaire des cas disponibles.
        """
        return MLPredictorFactory.CASE_CONFIGS


# Exemple d'utilisation
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Créer un prédicteur pour le cas H2 Pipeline
    predictor = MLPredictorFactory.create_predictor("h2_pipeline")

    # Créer des données de test avec une forme différente
    test_data = np.random.randn(16, 16, 16)
    print(f"Input data shape: {test_data.shape}")

    # Effectuer une prédiction
    prediction = predictor.predict(test_data, return_adaptation_info=True)
    if isinstance(prediction, tuple):
        pred, info = prediction
        print(f"Prediction shape: {pred.shape}")
        print(f"Adaptation info: {info}")
    else:
        print(f"Prediction shape: {prediction.shape}")

    # Obtenir les infos du modèle
    model_info = predictor.get_model_info()
    print(f"Model info: {model_info}")
