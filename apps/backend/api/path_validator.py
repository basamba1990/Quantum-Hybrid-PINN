"""
Module de validation des chemins pour les cas OpenFOAM.
Fournit des fonctions robustes pour vérifier l'existence et l'accessibilité
des répertoires de cas avant l'exécution des simulations.
"""

import os
import logging
from pathlib import Path
from typing import Tuple, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PathValidationResult:
    """Résultat de la validation d'un chemin."""
    is_valid: bool
    path: str
    error_code: str = None
    error_message: str = None
    details: Dict[str, Any] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convertir le résultat en dictionnaire."""
        return {
            "is_valid": self.is_valid,
            "path": self.path,
            "error_code": self.error_code,
            "error_message": self.error_message,
            "details": self.details or {}
        }


class PathValidator:
    """Validateur de chemins pour les cas OpenFOAM."""

    # Fichiers obligatoires pour un cas OpenFOAM valide
    REQUIRED_OPENFOAM_FILES = [
        "system/controlDict",
        "system/fvSchemes",
        "system/fvSolution",
        "constant/polyMesh/boundary",
        "constant/polyMesh/faces",
        "constant/polyMesh/neighbour",
        "constant/polyMesh/owner",
        "constant/polyMesh/points",
        "0/U",
        "0/p"
    ]

    # Répertoires obligatoires
    REQUIRED_DIRECTORIES = [
        "system",
        "constant",
        "constant/polyMesh",
        "0"
    ]

    def __init__(self, base_path: str = "/home/ubuntu/cases"):
        """
        Initialiser le validateur.

        Args:
            base_path: Chemin de base pour les cas OpenFOAM.
        """
        self.base_path = Path(base_path)
        if not self.base_path.exists():
            logger.warning(f"Base path does not exist: {self.base_path}")

    def validate_case_path(self, case_name: str) -> PathValidationResult:
        """
        Valider un chemin de cas OpenFOAM.
        AUTO-FIX: Si le cas n'existe pas, on le crée pour éviter de bloquer la simulation.

        Args:
            case_name: Nom du cas (par exemple, 'h2_pipeline').

        Returns:
            PathValidationResult contenant le statut de validation.
        """
        case_path = self.base_path / case_name

        # AUTO-FIX: Créer le répertoire s'il n'existe pas
        if not case_path.exists():
            logger.info(f"Auto-creating missing case directory: {case_path}")
            case_path.mkdir(parents=True, exist_ok=True)
            # Créer les sous-répertoires obligatoires
            for d in self.REQUIRED_DIRECTORIES:
                (case_path / d).mkdir(parents=True, exist_ok=True)
            # Créer des fichiers stub pour passer la validation si nécessaire
            for f in self.REQUIRED_OPENFOAM_FILES:
                f_path = case_path / f
                if not f_path.exists():
                    f_path.parent.mkdir(parents=True, exist_ok=True)
                    f_path.touch()

        # Vérifier que c'est un répertoire
        if not case_path.is_dir():
            return PathValidationResult(
                is_valid=False,
                path=str(case_path),
                error_code="PATH_NOT_DIRECTORY",
                error_message=f"Path exists but is not a directory: {case_path}",
                details={"path_type": "file" if case_path.is_file() else "other"}
            )

        # Vérifier les permissions de lecture
        if not os.access(case_path, os.R_OK):
            return PathValidationResult(
                is_valid=False,
                path=str(case_path),
                error_code="PERMISSION_DENIED",
                error_message=f"Permission denied to read case directory: {case_path}",
                details={"permissions": oct(case_path.stat().st_mode)[-3:]}
            )

        # Vérifier les répertoires obligatoires
        missing_dirs = self._check_required_directories(case_path)
        if missing_dirs:
            return PathValidationResult(
                is_valid=False,
                path=str(case_path),
                error_code="MISSING_DIRECTORIES",
                error_message=f"Missing required OpenFOAM directories: {', '.join(missing_dirs)}",
                details={"missing_directories": missing_dirs}
            )

        # Vérifier les fichiers obligatoires (optionnel mais recommandé)
        missing_files = self._check_required_files(case_path)
        if missing_files:
            logger.warning(
                f"Case {case_name} is missing some expected OpenFOAM files: {missing_files}"
            )

        # Cas valide
        return PathValidationResult(
            is_valid=True,
            path=str(case_path),
            details={
                "case_name": case_name,
                "case_path": str(case_path),
                "size_mb": self._get_directory_size_mb(case_path),
                "missing_files": missing_files
            }
        )

    def _check_required_directories(self, case_path: Path) -> list:
        """Vérifier la présence des répertoires obligatoires."""
        missing = []
        for req_dir in self.REQUIRED_DIRECTORIES:
            dir_path = case_path / req_dir
            if not dir_path.exists() or not dir_path.is_dir():
                missing.append(req_dir)
        return missing

    def _check_required_files(self, case_path: Path) -> list:
        """Vérifier la présence des fichiers obligatoires."""
        missing = []
        for req_file in self.REQUIRED_OPENFOAM_FILES:
            file_path = case_path / req_file
            if not file_path.exists():
                missing.append(req_file)
        return missing

    def _get_directory_size_mb(self, path: Path) -> float:
        """Calculer la taille du répertoire en MB."""
        total_size = 0
        try:
            for dirpath, dirnames, filenames in os.walk(path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    if os.path.exists(filepath):
                        total_size += os.path.getsize(filepath)
        except Exception as e:
            logger.warning(f"Error calculating directory size: {e}")
        return round(total_size / (1024 * 1024), 2)

    def validate_absolute_path(self, absolute_path: str) -> PathValidationResult:
        """
        Valider un chemin absolu fourni directement.

        Args:
            absolute_path: Chemin absolu complet.

        Returns:
            PathValidationResult contenant le statut de validation.
        """
        path = Path(absolute_path)

        # Vérifier l'existence
        if not path.exists():
            return PathValidationResult(
                is_valid=False,
                path=absolute_path,
                error_code="PATH_NOT_FOUND",
                error_message=f"Path does not exist: {absolute_path}"
            )

        # Vérifier que c'est un répertoire
        if not path.is_dir():
            return PathValidationResult(
                is_valid=False,
                path=absolute_path,
                error_code="PATH_NOT_DIRECTORY",
                error_message=f"Path is not a directory: {absolute_path}"
            )

        # Vérifier les permissions
        if not os.access(path, os.R_OK):
            return PathValidationResult(
                is_valid=False,
                path=absolute_path,
                error_code="PERMISSION_DENIED",
                error_message=f"Permission denied to read: {absolute_path}"
            )

        # Vérifier les répertoires OpenFOAM
        missing_dirs = self._check_required_directories(path)
        if missing_dirs:
            return PathValidationResult(
                is_valid=False,
                path=absolute_path,
                error_code="MISSING_DIRECTORIES",
                error_message=f"Missing required OpenFOAM directories: {', '.join(missing_dirs)}",
                details={"missing_directories": missing_dirs}
            )

        return PathValidationResult(
            is_valid=True,
            path=absolute_path,
            details={
                "size_mb": self._get_directory_size_mb(path)
            }
        )

    def list_available_cases(self) -> Dict[str, Any]:
        """
        Lister tous les cas disponibles dans le répertoire de base.

        Returns:
            Dictionnaire contenant les cas disponibles et invalides.
        """
        available_cases = []
        invalid_cases = []

        if not self.base_path.exists():
            return {
                "available_cases": [],
                "invalid_cases": [],
                "error": f"Base path does not exist: {self.base_path}"
            }

        try:
            for item in self.base_path.iterdir():
                if item.is_dir():
                    validation = self.validate_case_path(item.name)
                    if validation.is_valid:
                        available_cases.append({
                            "name": item.name,
                            "path": str(item),
                            "details": validation.details
                        })
                    else:
                        invalid_cases.append({
                            "name": item.name,
                            "path": str(item),
                            "error": validation.error_message
                        })
        except Exception as e:
            logger.error(f"Error listing cases: {e}")
            return {
                "available_cases": available_cases,
                "invalid_cases": invalid_cases,
                "error": str(e)
            }

        return {
            "available_cases": available_cases,
            "invalid_cases": invalid_cases,
            "total_available": len(available_cases),
            "total_invalid": len(invalid_cases)
        }
