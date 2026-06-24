"""
Industrial NASA Training Script for Quantum-Hybrid PINN V8
Synchronized with Production (Render/Supabase)
Resolves: OOD 404 errors, Environment mismatch, and Model path inconsistency.
"""

import os
import torch
import numpy as np
import logging
from typing import List
from supabase import create_client, Client
from hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8 as HydrogenPINNV8
from pinn_3d_navier_stokes import T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NASA-Training")

# 0. Environment Configuration (Synchronized with Production)
# Use your production Supabase project
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ivhxnaxhgfbiqlhgfkik.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "pinn-models")

if not SUPABASE_KEY:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.")

supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

def train_industrial_nasa(epochs: int = 5000, lr: float = 0.001, fluid_type: str = 'LH2'):
    logger.info(f"Starting Industrial NASA Training for {fluid_type}...")
    
    # 1. Initialize Model with Production Architecture
    # Layers [4, 128, 128, 128, 5] matches the production checkpoint requirements
    model = HydrogenPINNV8(layers=[4, 128, 128, 128, 5], fluid_type=fluid_type, geometry_type="pipeline")
    
    # 2. Run Training
    history = model.train_pinn(
        epochs=epochs,
        learning_rate=lr,
        N_pde=5000,
        adapt_every=500
    )
    
    # 3. Fit OOD Detector on training features
    logger.info("Fitting Mahalanobis OOD Detector on final training state...")
    # Generate representative features from the trained model
    N_samples = 1000
    t = torch.rand(N_samples, 1, device=model.device) * (T_MAX - T_MIN) + T_MIN
    x = torch.rand(N_samples, 1, device=model.device) * (X_MAX - X_MIN) + X_MIN
    y = torch.rand(N_samples, 1, device=model.device) * (Y_MAX - Y_MIN) + Y_MIN
    z = torch.rand(N_samples, 1, device=model.device) * (Z_MAX - Z_MIN) + Z_MIN
    
    with torch.no_grad():
        rho, u, v, w, T = model.pinn_model(t, x, y, z)
        # Extract pressure features for OOD
        p = model.eos_model(rho, T).cpu().numpy().flatten()
        # Reshape to expected feature format (e.g., small windows or point-wise stats)
        # Here we use point-wise as a simple industrial feature
        features = p.reshape(-1, 1)
        
    model.fit_ood_detector(features)
    
    # 4. Save Locally
    os.makedirs("models", exist_ok=True)
    model_path = "models/pinn_model.pt"
    ood_path = "models/ood_stats.npz"
    
    torch.save(model.pinn_model.state_dict(), model_path)
    
    # Save OOD stats
    np.savez(ood_path, 
             mean=model.ood_detector.mean, 
             cov=np.linalg.pinv(model.ood_detector.cov_inv))
    
    logger.info(f"Models saved locally: {model_path}, {ood_path}")
    
    # 5. Upload to Supabase (Production Bucket)
    logger.info(f"Uploading to Supabase bucket: {SUPABASE_BUCKET_NAME}...")
    
    with open(model_path, "rb") as f:
        supabase_client.storage.from_(SUPABASE_BUCKET_NAME).upload(
            "pinn_model.pt", f, {"upsert": "true"}
        )
        
    with open(ood_path, "rb") as f:
        supabase_client.storage.from_(SUPABASE_BUCKET_NAME).upload(
            "ood_stats.npz", f, {"upsert": "true"}
        )
        
    logger.info("✅ Upload complete. Production API will now load these on next startup.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=5000)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--fluid_type", type=str, default="LH2")
    args = parser.parse_args()
    
    train_industrial_nasa(epochs=args.epochs, lr=args.lr, fluid_type=args.fluid_type)
