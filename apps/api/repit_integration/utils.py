import numpy as np
from pathlib import Path
import subprocess
from typing import List, Union


def hard_constraint_bc(data, extended_vars_list, left_wall_temp, right_wall_temp):
    """Applique des conditions aux limites (enforced BC) sur la température.
    Cette fonction est un placeholder – à adapter à ton cas réel.
    """
    # Recherche l'index de la température dans extended_vars_list
    try:
        idx_T = extended_vars_list.index("T")
    except ValueError:
        return data  # pas de T, on ne fait rien

    # data shape: (nvars, H, W) ou (nvars, H*W)
    # On suppose que les deux premières et deux dernières colonnes sont les parois
    if data.ndim == 3:
        # Paroi gauche (colonne 0) et droite (colonne -1)
        data[idx_T, :, 0] = left_wall_temp
        data[idx_T, :, -1] = right_wall_temp
    elif data.ndim == 2:
        # Cas où data est aplatie: (nvars, N)
        H = int(np.sqrt(data.shape[1]))
        data_T = data[idx_T].reshape(H, H)
        data_T[:, 0] = left_wall_temp
        data_T[:, -1] = right_wall_temp
        data[idx_T] = data_T.reshape(-1)
    return data


def add_feature(data):
    """Ajoute les caractéristiques corrélées (voisins) pour l'apprentissage.
    Placeholder – adapte selon ta logique réelle.
    Retourne un tableau 1D des caractéristiques étendues.
    """
    # Pour l'exemple, on retourne simplement les données aplaties
    # + on ajoute la moyenne des voisins (simpliste)
    if data.ndim == 2:
        flat = data.reshape(-1)
    else:
        flat = data.reshape(-1)
    # On ajoute une caractéristique bidon: la valeur au centre du domaine
    center_idx = len(flat) // 2
    center_val = flat[center_idx]
    return np.concatenate([flat, [center_val]])


# Aliases pour rétrocompatibilité avec la classe OpenfoamUtils attendue
class OpenfoamUtils:
    """Wrapper vers la classe OpenFOAMUtils du module openfoam_utils."""
    @staticmethod
    def max_time_directory(case_path: Path, round_to: int = 2) -> float:
        from .openfoam_utils import OpenFOAMUtils
        return OpenFOAMUtils.max_time_directory(case_path, round_to)

    @staticmethod
    def generate_intervals(start: float, end: float, step: float, round_to: int = 2) -> List[float]:
        from .openfoam_utils import OpenFOAMUtils
        return OpenFOAMUtils.generate_intervals(start, end, step, round_to)

    @staticmethod
    def run_subprocess(command: List[str], capture_output: bool = True, text: bool = True) -> str:
        from .openfoam_utils import OpenFOAMUtils
        return OpenFOAMUtils.run_subprocess(command, capture_output, text)
