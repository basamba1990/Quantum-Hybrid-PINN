"""
FastAPI server for Hydrogen PINN Model
Provides REST endpoints for training and inference
Fixed for Render deployment with proper module imports
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
# This ensures that local modules can be imported correctly
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

# Initialize FastAPI app
app = FastAPI(
    title="H2-Inference Systems API",
    description="Physics-Informed Neural Network for Hydrogen Storage Analysis",
    version="1.0.0",
)

# CORS middleware - Allow requests from Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://spotbulle-science-verify.vercel.app",
        "http://localhost:3000",
        "*",  # Allow all origins (can be restricted later)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model storage
models: Dict[str, HydrogenPINN] = {}
current_model: Optional[HydrogenPINN] = None
models_dir = "models"
os.makedirs(models_dir, exist_ok=True)


# ============================================================================
# Pydantic Models (Request/Response schemas)
# ============================================================================

class InitializeRequest(BaseModel):
    """Request to initialize a new PINN model"""
    layers: List[int] = [2, 64, 64, 64, 3]


class TrainRequest(BaseModel):
    """Request to train the PINN model"""
    N_pde: int = 5000
    N_ic: int = 500
    N_bc: int = 500
    epochs: int = 5000
    learning_rate: float = 0.001
    model_name: str = "hydrogen_pinn_default"


class LoadRequest(BaseModel):
    """Request to load a pre-trained model"""
    model_path: str


class PredictionRequest(BaseModel):
    """Request for a single prediction"""
    time: float
    position: float


class BatchPredictionRequest(BaseModel):
    """Request for batch predictions"""
    batch: List[PredictionRequest]


class PredictionResponse(BaseModel):
    """Response with prediction results"""
    pressure: float
    velocity: float
    temperature: float
    time: float
    position: float
    timestamp: str


class ModelStatusResponse(BaseModel):
    """Response with model status"""
    model_loaded: bool
    model_name: Optional[str]
    device: str
    timestamp: str


# ============================================================================
# Health Check Endpoint
# ============================================================================

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    Returns: {"status": "healthy", "timestamp": "..."}
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "H2-Inference API",
        "version": "1.0.0"
    }


# ============================================================================
# Model Management Endpoints
# ============================================================================

@app.post("/model/initialize")
async def initialize_model(request: InitializeRequest):
    """
    Initialize a new PINN model with specified architecture
    
    Args:
        request: InitializeRequest with layers configuration
    
    Returns:
        {"status": "success", "message": "...", "layers": [...], "device": "..."}
    """
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
    """
    Train the PINN model on physics-informed data
    
    Args:
        request: TrainRequest with training parameters
    
    Returns:
        {"status": "success", "message": "...", "model_name": "...", "final_loss": ...}
    """
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

        # Save model
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


@app.post("/model/load")
async def load_model(request: LoadRequest):
    """
    Load a pre-trained model from file
    
    Args:
        request: LoadRequest with model_path
    
    Returns:
        {"status": "success", "message": "...", "model_path": "...", "model_name": "..."}
    """
    global current_model
    try:
        if not os.path.exists(request.model_path):
            raise FileNotFoundError(f"Model file not found: {request.model_path}")

        current_model = HydrogenPINN()
        current_model.load_state_dict(torch.load(request.model_path))
        model_name = os.path.basename(request.model_path).replace(".pt", "")
        models[model_name] = current_model

        return {
            "status": "success",
            "message": "Model loaded successfully",
            "model_path": request.model_path,
            "model_name": model_name,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Load error: {str(e)}")


@app.get("/model/status", response_model=ModelStatusResponse)
async def model_status():
    """
    Get current model status
    
    Returns:
        ModelStatusResponse with model information
    """
    global current_model
    return ModelStatusResponse(
        model_loaded=current_model is not None,
        model_name="default" if current_model else None,
        device="cuda" if torch.cuda.is_available() else "cpu",
        timestamp=datetime.utcnow().isoformat(),
    )


@app.get("/models/list")
async def list_models():
    """
    List all available models
    
    Returns:
        {"status": "success", "models": [...], "current_model": "..."}
    """
    return {
        "status": "success",
        "models": list(models.keys()),
        "current_model": "default" if current_model else None,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================================
# Prediction Endpoints
# ============================================================================

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Make a single prediction using the current model
    
    Args:
        request: PredictionRequest with time and position
    
    Returns:
        PredictionResponse with pressure, velocity, temperature
    """
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


@app.post("/predict/batch")
async def predict_batch(request: BatchPredictionRequest):
    """
    Make batch predictions (up to 100 points)
    
    Args:
        request: BatchPredictionRequest with list of predictions
    
    Returns:
        {"status": "success", "count": N, "predictions": [...]}
    """
    global current_model
    try:
        if current_model is None:
            raise ValueError("No model loaded. Initialize or load a model first.")

        if len(request.batch) > 100:
            raise ValueError("Batch size limited to 100 predictions")

        results = []
        for pred_req in request.batch:
            result = predict_hydrogen_state(
                current_model, pred_req.time, pred_req.position
            )
            results.append(
                PredictionResponse(
                    **result,
                    timestamp=datetime.utcnow().isoformat(),
                ).model_dump()
            )

        return {
            "status": "success",
            "count": len(results),
            "predictions": results,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction error: {str(e)}")


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    # Get port from environment variable (Render sets this)
    port = int(os.getenv("PORT", 8000))
    
    # Get host from environment variable (default to 0.0.0.0 for external access)
    host = os.getenv("HOST", "0.0.0.0")
    
    # Get reload setting from environment (disable in production)
    reload = os.getenv("RELOAD", "false").lower() == "true"
    
    print(f"Starting H2-Inference API on {host}:{port}")
    print(f"Swagger UI: http://{host}:{port}/docs")
    print(f"ReDoc: http://{host}:{port}/redoc")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )