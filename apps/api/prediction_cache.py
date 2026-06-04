import hashlib
import json
import numpy as np
from typing import Dict, Any, Optional
import time

class PredictionCache:
    """
    Cache simple en mémoire pour les prédictions PINN afin d'éviter les calculs redondants.
    """
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 300):
        self.cache = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds

    def _generate_key(self, t: float, x: float, y: float, z: float, params: dict = None) -> str:
        # Arrondir les coordonnées pour augmenter le taux de hit du cache
        # Précision de 1mm pour l'espace et 1ms pour le temps
        key_data = {
            "t": round(t, 3),
            "x": round(x, 3),
            "y": round(y, 3),
            "z": round(z, 3),
            "params": params or {}
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()

    def get(self, t: float, x: float, y: float, z: float, params: dict = None) -> Optional[Dict[str, Any]]:
        key = self._generate_key(t, x, y, z, params)
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry["timestamp"] < self.ttl_seconds:
                return entry["data"]
            else:
                del self.cache[key]
        return None

    def set(self, t: float, x: float, y: float, z: float, data: Dict[str, Any], params: dict = None):
        if len(self.cache) >= self.max_size:
            # Supprimer l'entrée la plus ancienne (simple FIFO pour cet exemple)
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]["timestamp"])
            del self.cache[oldest_key]
        
        key = self._generate_key(t, x, y, z, params)
        self.cache[key] = {
            "data": data,
            "timestamp": time.time()
        }

# Instance globale
global_prediction_cache = PredictionCache()
