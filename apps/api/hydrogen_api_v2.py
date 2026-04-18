"""
FastAPI server for Hydrogen PINN Model - V2
Provides REST endpoints for training, inference, and data assimilation with 3D PINN and Deep Kalman Filter
"""

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

# ============================================================================
# FIX FOR RENDER: Add current directory to Python path
# ============================================================================
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Now import local modules
from hydrogen_pinn_model import (
    HydrogenPINN,
    train_pinn,
    predict_hydrogen_state,
    generate_training_data,
)
from hydrogen_pinn_v8 import HydrogenPINNV8, get_device

# Initialize FastAPI app
app = FastAPI(
    title="Quantum-Hybrid PINN API (V8)",
    description="Physics-Informed Neural Network for Hydrogen Storage Analysis with 3D Navier-Stokes and Deep Kalman Filter",
    version="2.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model storage
models: Dict[str, HydrogenPINN] = {}
current_model: Optional[HydrogenPINN] = None
models_dir = "models"
os.makedirs(models_dir, exist_ok=True)

models_v8: Dict[str, HydrogenPINNV8] = {}
current_model_v8: Optional[HydrogenPINNV8] = None
models_dir_v8 = "models_v8"
os.makedirs(models_dir_v8, exist_ok=True)


# ============================================================================
# Pydantic Models V1
# ============================================================================

class InitializeRequest(BaseModel):
    layers: List[int] = [2, 64, 64, 64, 3]

class TrainRequest(BaseModel):
    N_pde: int = 5000
    N_ic: int = 500
    N_bc: int = 500
    epochs: int = 5000
    learning_rate: float = 0.001
    model_name: str = "hydrogen_pinn_default"

class LoadRequest(BaseModel):
    model_path: str

class PredictionRequest(BaseModel):
    time: float
    position: float

class BatchPredictionRequest(BaseModel):
    batch: List[PredictionRequest]

class PredictionResponse(BaseModel):
    pressure: float
    velocity: float
    temperature: float
    time: float
    position: float
    timestamp: str

class ModelStatusResponse(BaseModel):
    model_loaded: bool
    model_name: Optional[str]
    device: str
    timestamp: str

# ============================================================================
# Pydantic Models V2
# ============================================================================

class InitializeRequestV8(BaseModel):
    layers: List[int] = [4, 256, 256, 256, 256, 5]
    fluid_type: str = "H2"

class TrainRequestV8(BaseModel):
    N_pde: int = 5000
    epochs: int = 5000
    learning_rate: float = 0.001
    model_name: str = "hydrogen_pinn_v8_default"

class PredictionRequestV8(BaseModel):
    time: float
    x: float
    y: float
    z: float

class PredictionResponseV8(BaseModel):
    pressure: float
    velocity_u: float
    velocity_v: float
    velocity_w: float
    temperature: float
    density: float
    time: float
    x: float
    y: float
    z: float
    timestamp: str

class AssimilationRequestV8(BaseModel):
    current_state: List[float]
    observation: List[float]

class AssimilationResponseV8(BaseModel):
    assimilated_state: List[float]
    timestamp: str

class ModelStatusResponseV8(BaseModel):
    model_loaded: bool
    model_name: Optional[str]
    device: str
    timestamp: str

# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Quantum-Hybrid PINN API (V8)",
        "version": "2.0.0"
    }

# ============================================================================
# V1 Endpoints
# ============================================================================

@app.post("/model/initialize")
async def initialize_model(request: InitializeRequest):
    global current_model
    try:
        current_model = HydrogenPINN(layers=request.layers)
        models["default"] = current_model
        return {
            "status": "success",
            "message": "Model initialized successfully",
            "layers": request.layers,
            "device": "cuda" if torch.cuda.is_available() else "cpu",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Initialization error: {str(e)}")

@app.post("/model/train")
async def train_model(request: TrainRequest):
    global current_model
    try:
        if current_model is None:
            current_model = HydrogenPINN()
        history = train_pinn(
            current_model,
            epochs=request.epochs,
            learning_rate=request.learning_rate,
            N_pde=request.N_pde,
            N_ic=request.N_ic,
            N_bc=request.N_bc,
        )
        model_path = os.path.join(models_dir, f"{request.model_name}.pt")
        torch.save(current_model.state_dict(), model_path)
        models[request.model_name] = current_model
        return {
            "status": "success",
            "message": "Training completed successfully",
            "model_name": request.model_name,
            "model_path": model_path,
            "final_loss": float(history["loss"][-1]),
            "epochs": request.epochs,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training error: {str(e)}")

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    global current_model
    try:
        if current_model is None:
            raise ValueError("No model loaded. Initialize or load a model first.")
        result = predict_hydrogen_state(current_model, request.time, request.position)
        return PredictionResponse(
            **result,
            timestamp=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# ============================================================================
# V2 Endpoints
# ============================================================================

@app.post("/v2/model/initialize")
async def initialize_model_v8(request: InitializeRequestV8):
    global current_model_v8
    try:
        current_model_v8 = HydrogenPINNV8(layers=request.layers, fluid_type=request.fluid_type)
        models_v8[f"default_v8_{request.fluid_type}"] = current_model_v8
        return {
            "status": "success",
            "message": "Model V8 initialized successfully",
            "layers": request.layers,
            "device": str(get_device()),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Initialization error V8: {str(e)}")

@app.post("/v2/model/train")
async def train_model_v8(request: TrainRequestV8):
    global current_model_v8
    try:
        if current_model_v8 is None:
            current_model_v8 = HydrogenPINNV8()
        history = current_model_v8.train_pinn(
            epochs=request.epochs,
            learning_rate=request.learning_rate,
            N_pde=request.N_pde,
        )
        model_path = os.path.join(models_dir_v8, f"{request.model_name}.pt")
        torch.save(current_model_v8.pinn_model.state_dict(), model_path)
        models_v8[request.model_name] = current_model_v8
        return {
            "status": "success",
            "message": "Training V8 completed successfully",
            "model_name": request.model_name,
            "model_path": model_path,
            "final_loss": float(history["loss"][-1]),
            "epochs": request.epochs,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training error V8: {str(e)}")

@app.post("/v2/validate-3d", response_model=PredictionResponseV8)
async def validate_3d(request: PredictionRequestV8):
    global current_model_v8
    try:
        if current_model_v8 is None:
            raise ValueError("No V8 model loaded. Initialize or load a model first.")
        result = current_model_v8.predict_state(request.time, request.x, request.y, request.z)
        return PredictionResponseV8(
            **result,
            timestamp=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"3D Validation error: {str(e)}")

@app.post("/v2/assimilate", response_model=AssimilationResponseV8)
async def assimilate_data(request: AssimilationRequestV8):
    global current_model_v8
    try:
        if current_model_v8 is None:
            raise ValueError("No V8 model loaded. Initialize or load a model first.")
        assimilated_state = current_model_v8.assimilate_data(request.current_state, request.observation)
        return AssimilationResponseV8(
            assimilated_state=assimilated_state,
            timestamp=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data assimilation error: {str(e)}")

# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("RELOAD", "false").lower() == "true"

    print(f"Starting Quantum-Hybrid PINN API (V8) on {host}:{port}")
    print(f"Swagger UI: http://{host}:{port}/docs")
    print(f"ReDoc: http://{host}:{port}/redoc")

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )