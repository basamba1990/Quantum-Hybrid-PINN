import sys
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import torch
from datetime import datetime
import uvicorn

# Ajout du chemin local pour les imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

try:
    from hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8
except ImportError:
    from .hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8

app = FastAPI(
    title="Quantum-Hybrid-PINN TFC-Enriched API",
    description="API avec intégration de la Théorie des Connexions Fonctionnelles (TFC) pour la satisfaction exacte des BC/IC",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stockage des modèles
models: Dict[str, HydrogenPINNTFCV8] = {}
current_model: Optional[HydrogenPINNTFCV8] = None

class TrainRequest(BaseModel):
    N_pde: int = 5000
    epochs: int = 5000
    learning_rate: float = 0.001
    model_name: str = "tfc_pinn_default"

class PredictionRequest(BaseModel):
    time: float
    x: float
    y: float
    z: float

@app.post("/model/train")
async def train_model(request: TrainRequest):
    global current_model
    try:
        current_model = HydrogenPINNTFCV8()
        history = current_model.train_pinn(
            epochs=request.epochs,
            learning_rate=request.learning_rate,
            N_pde=request.N_pde
        )
        models[request.model_name] = current_model
        return {
            "status": "success",
            "message": "TFC-PINN training completed",
            "final_loss": float(history["loss"][-1]),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
async def predict(request: PredictionRequest):
    global current_model
    if current_model is None:
        current_model = HydrogenPINNTFCV8()
    
    try:
        result = current_model.predict_state(request.time, request.x, request.y, request.z)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
