from pathlib import Path
import subprocess
import re
from datetime import datetime
from typing import List, Union, Optional
import timeit

import numpy as np
import Ofpp


class OpenFOAMUtils:
    """Classe utilitaire pour interagir avec OpenFOAM (mesh, décomposition, solveur, reconstruction)"""

    def __init__(self, case_path: Union[str, Path]):
        """
        Initialise l'utilitaire avec le chemin du cas OpenFOAM.

        Args:
            case_path: Chemin vers le répertoire du cas OpenFOAM
        """
        self.case_path = Path(case_path).resolve()
        if not self.case_path.exists():
            raise FileNotFoundError(f"Le chemin du cas n'existe pas : {self.case_path}")

    @staticmethod
    def run_subprocess(command: List[str], capture_output: bool = True, text: bool = True) -> str:
        """Exécute une commande shell et retourne sa sortie."""
        result = subprocess.run(command, capture_output=capture_output, text=text, check=True)
        return result.stdout

    @staticmethod
    def generate_intervals(start: float, end: float, step: float, round_to: int = 6) -> List[float]:
        """Génère une liste d'intervalles de temps sans dérive des flottants."""
        intervals = []
        current = start
        while current <= end + 1e-12:
            intervals.append(round(current, round_to))
            current = round(current + step, round_to)
        return intervals

    @staticmethod
    def max_time_directory(case_path: Path, round_to: int = 2) -> float:
        """
        Trouve le plus grand répertoire de temps dans le cas OpenFOAM.
        Ignore 'constant', 'system', 'processor*'.
        """
        max_time = 0.0
        for item in case_path.iterdir():
            if item.is_dir() and item.name not in ['constant', 'system'] and not item.name.startswith('processor'):
                try:
                    t = float(item.name)
                    if t > max_time:
                        max_time = t
                except ValueError:
                    continue
        return round(max_time, round_to)

    @staticmethod
    def update_decompose_par_dict(case_path: Path, num_processors: int) -> str:
        """Met à jour le fichier decomposeParDict avec le nombre de sous-domaines."""
        dict_path = case_path / "system" / "decomposeParDict"
        if not dict_path.exists():
            raise FileNotFoundError(f"decomposeParDict introuvable : {dict_path}")
        cmd = [
            "foamDictionary", "-case", str(case_path),
            "-entry", "numberOfSubdomains", "-set", str(num_processors),
            "system/decomposeParDict"
        ]
        return OpenFOAMUtils.run_subprocess(cmd, capture_output=True, text=True)

    def decompose_case(self, n_processors: int) -> str:
        """
        Décompose le cas pour une exécution parallèle.

        Args:
            n_processors: Nombre de processeurs pour la décomposition

        Returns:
            Log de la commande decomposePar
        """
        # Mettre à jour decomposeParDict avec le nombre de processeurs
        self.update_decompose_par_dict(self.case_path, n_processors)

        # Exécuter decomposePar
        cmd = ["decomposePar", "-force", "-case", str(self.case_path)]
        log = self.run_subprocess(cmd, capture_output=True, text=True)
        return f"✅ Décomposition effectuée sur {n_processors} sous-domaines.\n{log}"

    def run_solver(self, solver: str, n_processors: int = 1) -> str:
        """
        Exécute le solveur OpenFOAM en série ou en parallèle.

        Args:
            solver: Nom du solveur (ex: simpleFoam, pisoFoam)
            n_processors: Nombre de processeurs (1 = série)

        Returns:
            Log de l'exécution du solveur
        """
        if n_processors > 1:
            # Vérifier que la décomposition a été faite
            processor_dirs = list(self.case_path.glob("processor*"))
            if not processor_dirs:
                raise RuntimeError("Le cas n'a pas été décomposé. Appelez decompose_case() d'abord.")
            cmd = ["mpirun", "-np", str(n_processors), solver, "-parallel", "-case", str(self.case_path)]
            log = self.run_subprocess(cmd, capture_output=True, text=True)
            return f"✅ Solveur parallèle terminé ({n_processors} cœurs).\n{log}"
        else:
            cmd = [solver, "-case", str(self.case_path)]
            log = self.run_subprocess(cmd, capture_output=True, text=True)
            return f"✅ Solveur série terminé.\n{log}"

    def reconstruct_case(self) -> str:
        """Reconstruit les résultats parallèles en un seul répertoire de temps."""
        cmd = ["reconstructPar", "-case", str(self.case_path)]
        log = self.run_subprocess(cmd, capture_output=True, text=True)
        return f"✅ Reconstruction terminée.\n{log}"

    # ========== Méthodes supplémentaires utiles ==========

    def generate_mesh(self, mesh_utility: str = "blockMesh") -> str:
        """Génère le maillage si nécessaire."""
        poly_mesh = self.case_path / "constant" / "polyMesh"
        if poly_mesh.exists():
            return "ℹ️ Le maillage existe déjà, aucune génération effectuée."

        cmd = [mesh_utility, "-case", str(self.case_path)]
        log = self.run_subprocess(cmd, capture_output=True, text=True)
        return f"✅ Maillage généré avec {mesh_utility}.\n{log}"

    @staticmethod
    def parse_to_numpy(
        case_path: Path,
        variables: List[str],
        time_list: List[float],
        save_dir: Optional[Path] = None,
        round_to: int = 6
    ) -> Path:
        """
        Parse les champs OpenFOAM vers des fichiers NumPy.

        Args:
            case_path: Chemin du cas OpenFOAM
            variables: Liste des noms de champs (ex: ['U', 'p', 'T'])
            time_list: Liste des instants à parser
            save_dir: Répertoire de sauvegarde (par défaut : case_path/../Assets)
            round_to: Précision pour les noms de fichiers

        Returns:
            Chemin du répertoire contenant les fichiers .npy
        """
        if save_dir is None:
            save_dir = case_path.parent / "Assets" / case_path.name
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)

        for t in time_list:
            t_str = str(int(t)) if t.is_integer() else str(round(t, round_to))
            time_dir = case_path / t_str
            if not time_dir.exists():
                continue
            for var in variables:
                foam_file = time_dir / var
                if not foam_file.exists():
                    continue
                data = Ofpp.parse_internal_field(str(foam_file))
                np_file = save_dir / f"{var}_{t_str}.npy"
                np.save(np_file, data)
        return save_dir


# Alias pour rétrocompatibilité avec l'ancien nom (OpenfoamUtils sans majuscule F)
OpenfoamUtils = OpenFOAMUtils
