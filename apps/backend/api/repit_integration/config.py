from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass, field


@dataclass
class OpenfoamConfig:
    """Configuration pour les simulations OpenFOAM."""
    solver_dir: Path = Path("/app/Solvers/default")
    assets_dir: Path = Path("/app/Assets")
    start_time: float = 0.0
    end_time: float = 100.0
    write_interval: float = 0.01
    round_to: int = 6
    num_processors: int = 1
    mesh_type: Optional[str] = None
    solver_type: Optional[str] = None
    logger: Optional[object] = None

    def get_variables(self) -> List[str]:
        """Retourne la liste des variables OpenFOAM à traiter."""
        return ["U", "p", "T"]  # À personnaliser


@dataclass
class TrainingConfig(OpenfoamConfig):
    """Configuration pour l'entraînement, héritant de OpenfoamConfig."""
    batch_size: int = 32
    learning_rate: float = 1e-3
    epochs: int = 100
    model_save_dir: Path = Path("/app/models")
    # Ajoute d'autres paramètres d'entraînement si nécessaire
