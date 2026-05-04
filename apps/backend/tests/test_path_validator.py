"""
Tests unitaires pour le module de validation des chemins.
"""

import unittest
import tempfile
import shutil
from pathlib import Path
import sys

# Ajouter le répertoire api au chemin
sys.path.insert(0, str(Path(__file__).parent.parent / "api"))

from path_validator import PathValidator, PathValidationResult


class TestPathValidator(unittest.TestCase):
    """Tests pour la classe PathValidator."""

    def setUp(self):
        """Créer un répertoire temporaire pour les tests."""
        self.temp_dir = tempfile.mkdtemp()
        self.validator = PathValidator(base_path=self.temp_dir)

    def tearDown(self):
        """Nettoyer le répertoire temporaire."""
        shutil.rmtree(self.temp_dir)

    def test_validate_nonexistent_case(self):
        """Tester la validation d'un cas inexistant."""
        result = self.validator.validate_case_path("nonexistent_case")
        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_code, "CASE_NOT_FOUND")

    def test_validate_valid_case(self):
        """Tester la validation d'un cas valide."""
        # Créer un cas valide
        case_path = Path(self.temp_dir) / "valid_case"
        case_path.mkdir()
        (case_path / "system").mkdir()
        (case_path / "constant").mkdir()
        (case_path / "constant" / "polyMesh").mkdir()
        (case_path / "0").mkdir()

        # Créer les fichiers obligatoires
        (case_path / "system" / "controlDict").touch()
        (case_path / "system" / "fvSchemes").touch()
        (case_path / "system" / "fvSolution").touch()
        (case_path / "constant" / "polyMesh" / "boundary").touch()
        (case_path / "constant" / "polyMesh" / "faces").touch()
        (case_path / "constant" / "polyMesh" / "neighbour").touch()
        (case_path / "constant" / "polyMesh" / "owner").touch()
        (case_path / "constant" / "polyMesh" / "points").touch()
        (case_path / "0" / "U").touch()
        (case_path / "0" / "p").touch()

        result = self.validator.validate_case_path("valid_case")
        self.assertTrue(result.is_valid)
        self.assertIsNotNone(result.details)

    def test_validate_case_missing_directories(self):
        """Tester la validation d'un cas avec répertoires manquants."""
        case_path = Path(self.temp_dir) / "incomplete_case"
        case_path.mkdir()
        # Ne créer que le répertoire system, pas les autres

        result = self.validator.validate_case_path("incomplete_case")
        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_code, "MISSING_DIRECTORIES")

    def test_validate_absolute_path_nonexistent(self):
        """Tester la validation d'un chemin absolu inexistant."""
        result = self.validator.validate_absolute_path("/nonexistent/path")
        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_code, "PATH_NOT_FOUND")

    def test_validate_absolute_path_file(self):
        """Tester la validation d'un chemin absolu qui est un fichier."""
        file_path = Path(self.temp_dir) / "test_file.txt"
        file_path.touch()

        result = self.validator.validate_absolute_path(str(file_path))
        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_code, "PATH_NOT_DIRECTORY")

    def test_list_available_cases_empty(self):
        """Tester la liste des cas quand aucun n'existe."""
        result = self.validator.list_available_cases()
        self.assertEqual(result["total_available"], 0)
        self.assertEqual(result["total_invalid"], 0)

    def test_list_available_cases_mixed(self):
        """Tester la liste des cas avec des cas valides et invalides."""
        # Créer un cas valide
        valid_case = Path(self.temp_dir) / "valid_case"
        valid_case.mkdir()
        (valid_case / "system").mkdir()
        (valid_case / "constant").mkdir()
        (valid_case / "constant" / "polyMesh").mkdir()
        (valid_case / "0").mkdir()

        # Créer un cas invalide
        invalid_case = Path(self.temp_dir) / "invalid_case"
        invalid_case.mkdir()

        result = self.validator.list_available_cases()
        self.assertEqual(result["total_available"], 1)
        self.assertEqual(result["total_invalid"], 1)


class TestPathValidationResult(unittest.TestCase):
    """Tests pour la classe PathValidationResult."""

    def test_valid_result_to_dict(self):
        """Tester la conversion d'un résultat valide en dictionnaire."""
        result = PathValidationResult(
            is_valid=True,
            path="/path/to/case",
            details={"size_mb": 10.5}
        )
        result_dict = result.to_dict()
        self.assertTrue(result_dict["is_valid"])
        self.assertEqual(result_dict["path"], "/path/to/case")
        self.assertEqual(result_dict["details"]["size_mb"], 10.5)

    def test_invalid_result_to_dict(self):
        """Tester la conversion d'un résultat invalide en dictionnaire."""
        result = PathValidationResult(
            is_valid=False,
            path="/path/to/case",
            error_code="CASE_NOT_FOUND",
            error_message="Case directory not found"
        )
        result_dict = result.to_dict()
        self.assertFalse(result_dict["is_valid"])
        self.assertEqual(result_dict["error_code"], "CASE_NOT_FOUND")
        self.assertEqual(result_dict["error_message"], "Case directory not found")


if __name__ == "__main__":
    unittest.main()
