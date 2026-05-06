from pathlib import Path
from typing import List, Union, Optional, Literal
import numpy as np


class BaseDataset:
    """Classe de base pour les datasets FVNM (Finite Volume Method - Neural Network)."""

    def __init__(
        self,
        start_time: Union[int, float],
        end_time: Union[int, float],
        time_step: Union[int, float],
        dataset_dir: Union[str, Path],
        first_training: bool = False,
        vars_list: Optional[List[str]] = None,
        extended_vars_list: Optional[List[str]] = None,
        dims: int = 2,
        round_to: int = 2,
        grid_x: int = 200,
        grid_y: int = 200,
        grid_z: int = 1,
        grid_step: float = 0.005,
        output_dims: Literal["BD", "BCD", "BCHW"] = "BD",
        do_normalize: bool = True,
    ):
        self.start_time = start_time
        self.end_time = end_time
        self.time_step = time_step
        self.dataset_dir = Path(dataset_dir)
        self.first_training = first_training
        self.vars_list = vars_list or []
        self.extended_vars_list = extended_vars_list or []
        self.dims = dims
        self.round_to = round_to
        self.grid_x = grid_x
        self.grid_y = grid_y
        self.grid_z = grid_z
        self.grid_step = grid_step
        self.output_dims = output_dims
        self.do_normalize = do_normalize

        # Placeholders pour normalisation
        self.mean_ = None
        self.std_ = None

    def _prepare_input(self, time: float) -> np.ndarray:
        """Charge et prépare les données pour un instant donné.
        À surcharger dans les classes filles.
        """
        # Implémentation minimale pour éviter l'erreur
        # Charge les fichiers .npy pour chaque variable
        data_list = []
        for var in self.extended_vars_list:
            t_str = str(int(time)) if float(time).is_integer() else str(time)
            np_file = self.dataset_dir / f"{var}_{t_str}.npy"
            if not np_file.exists():
                raise FileNotFoundError(f"Fichier introuvable : {np_file}")
            data = np.load(np_file)
            data_list.append(data)
        return np.stack(data_list, axis=0)  # shape: (nvars, H, W)

    def _prepare_label(self, data_t: np.ndarray, data_t_next: np.ndarray) -> np.ndarray:
        """Calcule la différence entre t+dt et t."""
        return data_t_next - data_t

    def _inputs_labels(self):
        """Génère les entrées et labels pour tous les pas de temps."""
        times = np.arange(self.start_time, self.end_time + self.time_step/2, self.time_step)
        times = [round(t, self.round_to) for t in times]
        inputs, labels = [], []
        for t in times[:-1]:
            x_t = self._prepare_input(t)
            x_t_next = self._prepare_input(t + self.time_step)
            y = self._prepare_label(x_t, x_t_next)
            inputs.append(x_t)
            labels.append(y)
        return np.array(inputs), np.array(labels)
