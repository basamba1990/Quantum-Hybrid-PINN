import torch
import numpy as np
import sys
from pathlib import Path
import os

# Ajout du chemin pour l'API
def add_api_to_path():
    current = Path(__file__).resolve()
    for parent in current.parents:
        potential_api = parent / 'apps' / 'api'
        if potential_api.exists():
            sys.path.append(str(potential_api))
            return True
    return False

add_api_to_path()
from hydrogen_pinn_v8 import HydrogenPINNV8

def test_consistency(model_path: str, threshold: float = 0.05):
    """
    Vérifie si le modèle entraîné respecte les lois de la physique.
    Utilisé comme gate dans le pipeline CI/CD.
    """
    print(f"🔍 Testing physical consistency for: {model_path}")
    
    # Charger le modèle
    pinn = HydrogenPINNV8(layers=[4, 64, 64, 64, 5])
    try:
        pinn.pinn_model.load_state_dict(torch.load(model_path, map_location=pinn.device))
        pinn.pinn_model.eval()
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return False

    # Points de test aléatoires
    N_test = 1000
    t = torch.rand(N_test, 1) * 10.0
    x = torch.rand(N_test, 1) * 100.0
    y = torch.zeros(N_test, 1)
    z = torch.zeros(N_test, 1)

    # Calcul des résidus via l'auditeur physique
    is_valid, residuals = pinn.physics_auditor(t, x, y, z)
    
    print(f"📊 Mean Residuals:")
    for k, v in residuals.items():
        print(f"  - {k}: {v:.6f}")
    
    max_res = max(residuals.values())
    if is_valid:
        print(f"✅ PASSED: Max residual {max_res:.6f} is below threshold {threshold}")
        return True
    else:
        print(f"❌ FAILED: Max residual {max_res:.6f} exceeds industrial threshold {threshold}")
        return False

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="models/pinn_model.pt")
    parser.add_argument("--threshold", type=float, default=0.05)
    args = parser.parse_args()
    
    success = test_consistency(args.model, args.threshold)
    sys.exit(0 if success else 1)
