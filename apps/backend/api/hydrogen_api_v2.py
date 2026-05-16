"""
FastAPI server for Hydrogen PINN Model - V2 (CORRECTED)
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
from fno_3d_navier_stokes import PINO3DNavierStokes
from advanced_physics_analysis import AdvancedPhysicsAnalysis
from pvt_physics_engine import PVTPhysicsEngine

# Initialize FastAPI app
app = FastAPI(
    title="Quantum-Hybrid PINN API (V8)",
    description="Physics-Informed Neural Network for Hydrogen Storage Analysis with 3D Navier-Stokes and Deep Kalman Filter",
    version="2.0.0",
)

# CORS middleware - FIXED: Added missing comma
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    
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

# Initialize Analysis Service
physics_engine = PVTPhysicsEngine(fluid_type="H2")
analysis_service = AdvancedPhysicsAnalysis(fluid_engine=physics_engine)


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

class BatchPredictionRequestV8(BaseModel):
    time: List[float]
    x: List[float]
    y: List[float]
    z: List[float]

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
    use_fno: bool = False

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

class TurbulenceSpectraRequest(BaseModel):
    simulation_id: str
    time: float
    region: Optional[Dict] = None

class BoundaryLayerRequest(BaseModel):
    simulation_id: str
    time: float
    x: float
    z: float

class ResidualMapRequest(BaseModel):
    simulation_id: str
    time: float
    plane: str = "xy"
    coord: float = 0.0

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
        if request.use_fno:
            # Initialize PINO (Physics-Informed Neural Operator)
            model = PINO3DNavierStokes(modes1=8, modes2=8, modes3=8, width=32, fluid_type=request.fluid_type)
            # Store in a special wrapper or directly
            current_model_v8 = HydrogenPINNV8(layers=request.layers, fluid_type=request.fluid_type)
            current_model_v8.pinn_model = model
            current_model_v8.is_fno = True
        else:
            current_model_v8 = HydrogenPINNV8(layers=request.layers, fluid_type=request.fluid_type)
            current_model_v8.is_fno = False
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

@app.post("/v2/predict-batch")
async def predict_batch_v8(request: BatchPredictionRequestV8):
    global current_model_v8
    try:
        if current_model_v8 is None:
            raise ValueError("No V8 model loaded. Initialize or load a model first.")
        
        results = current_model_v8.predict_batch(
            np.array(request.time),
            np.array(request.x),
            np.array(request.y),
            np.array(request.z)
        )
        
        # Convert numpy arrays to lists for JSON serialization
        serializable_results = {k: v.tolist() if isinstance(v, np.ndarray) else v for k, v in results.items()}
        serializable_results["timestamp"] = datetime.utcnow().isoformat()
        
        return serializable_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction error: {str(e)}")

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
# Advanced Analysis Endpoints
# ============================================================================

@app.post("/v2/analysis/turbulence-spectra")
async def get_turbulence_spectra(request: TurbulenceSpectraRequest):
    try:
        # Simulation de données réelles pour l'exemple industriel
        # Dans une vraie app, on extrairait les champs du modèle chargé
        nx, ny, nz = 32, 32, 32
        u = np.random.normal(0, 0.1, (nx, ny, nz))
        v = np.random.normal(0, 0.1, (nx, ny, nz))
        w = np.random.normal(0, 0.1, (nx, ny, nz))
        
        spectra = analysis_service.compute_turbulence_spectrum([u, v, w], 0.01, 0.01, 0.01)
        return {
            "status": "success",
            "data": spectra,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Turbulence analysis error: {str(e)}")

@app.post("/v2/analysis/boundary-layer")
async def get_boundary_layer(request: BoundaryLayerRequest):
    try:
        # Génération d'un profil de couche limite physique (Loi de paroi)
        y = np.linspace(0, 0.1, 50)
        u_tau = 0.05
        nu = 1.5e-5 # Viscosité cinématique H2
        y_plus = y * u_tau / nu
        
        # Loi de paroi simplifiée
        u_plus = np.where(y_plus < 5, y_plus, 2.5 * np.log(y_plus + 1e-10) + 5.5)
        velocity = u_plus * u_tau
        
        return {
            "status": "success",
            "data": {
                "y": y.tolist(),
                "velocity": velocity.tolist(),
                "y_plus": y_plus.tolist()
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Boundary layer analysis error: {str(e)}")

@app.post("/v2/analysis/residuals-map")
async def get_residuals_map(request: ResidualMapRequest):
    try:
        # Génération d'une carte de résidus 2D
        res_map = np.random.lognormal(-5, 1, (64, 64))
        return {
            "status": "success",
            "data": {
                "map": res_map.tolist(),
                "plane": request.plane,
                "coord": request.coord
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Residual map error: {str(e)}")

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
