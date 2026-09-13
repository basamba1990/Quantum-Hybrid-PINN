import importlib.util
import unittest
from pathlib import Path

PATH = Path(__file__).parents[1] / "validate_physics_contract_g3.py"
spec = importlib.util.spec_from_file_location("g3_validator", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class G3ContractTests(unittest.TestCase):
    def test_missing_physics_contract_is_blocked(self):
        errors = module.validate({"fieldDescriptors": {}})
        self.assertIn("physicsContract object is missing", errors)

    def test_complete_contract_passes(self):
        descriptors = {name: {"unit": units[0], "quantity": quantity} for name, (units, quantity) in module.REQUIRED_FIELDS.items()}
        contract = {
            "validated": True,
            "governingEquations": ["mass"],
            "phaseModel": {"name": "VOF"},
            "materialProperties": {"validated": True},
            "initialConditionsPersisted": True,
            "boundaryConditionsPersisted": True,
        }
        errors = module.validate({
            "fieldDescriptors": descriptors,
            "provenance": {"solver": "solver", "solverVersion": "1", "calculationId": "run", "sourceHash": "a" * 64},
            "physicsContract": contract,
            "frames": [{"file": "frame_0000.vtu"}, {"file": "frame_0001.vtu"}],
        })
        self.assertEqual(errors, [])

if __name__ == "__main__":
    unittest.main()
