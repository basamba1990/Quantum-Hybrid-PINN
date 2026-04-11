"""
Quantum-Hybrid PINN V8 - FastAPI Backend (Updated)
Main application entry point for physics simulation and validation
Optimized for Railway + Supabase
"""

import os
import logging
import gc
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
import torch
from supabase import create_client, Client
import psutil

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Supabase client initialized")
else:
    logger.warning("⚠️ Supabase credentials missing. Storage and DB features will be limited.")

# ============================================
# Models & Schemas
# ============================================

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime
    gpu_available: bool
    memory_usage: Dict[str, float]

class ValidationRequest(BaseModel):
    pressure: float = Field(..., gt=0, lt=2000, description="Pressure in bar (0-2000)")
    temperature: float = Field(..., gt=10, lt=5000, description="Temperature in K (10-5000)")
    density: float = Field(..., gt=0, description="Density in kg/m³")
    velocity_magnitude: float = Field(..., ge=0, description="Velocity magnitude in m/s")

    @validator('temperature')
    def validate_temperature(cls, v):
        if v < 13.8: # Triple point of Hydrogen
            logger.warning(f"Temperature {v}K is below hydrogen triple point")
        return v

class ValidationResponse(BaseModel):
    credibility_score: float
    residuals: Dict[str, float]
    anomalies: List[str]
    timestamp: datetime
    result_url: Optional[str] = None

# ============================================
# Memory Management Utilities
# ============================================

def cleanup_memory():
    """Force garbage collection and clear CUDA cache"""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    logger.debug("Memory cleanup performed")

# ============================================
# Lifespan Events
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Quantum-Hybrid PINN V8 Backend")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Device: {device}")
    
    # Pre-load models here if needed using absolute paths
    # model_path = os.path.join(os.path.dirname(__file__), "models", "pinn_v8.pth")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Quantum-Hybrid PINN V8 Backend")
    cleanup_memory()

# ============================================
# FastAPI Application
# ============================================

app = FastAPI(
    title="Quantum-Hybrid PINN V8 API",
    description="Physics-Informed Neural Network for Hydrogen Simulation",
    version="1.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Endpoints
# ============================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    
    return HealthResponse(
        status="healthy",
        version="1.1.0",
        timestamp=datetime.utcnow(),
        gpu_available=torch.cuda.is_available(),
        memory_usage={
            "rss": mem_info.rss / (1024 * 1024), # MB
            "vms": mem_info.vms / (1024 * 1024)  # MB
        }
    )

@app.post("/v2/validate-3d", response_model=ValidationResponse)
async def validate_3d(request: ValidationRequest, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Validating 3D PINN: P={request.pressure}bar, T={request.temperature}K")
        
        # PINN Logic Placeholder
        # In a real scenario, we would call the model here
        # with torch.no_grad():
        #     result = model(inputs)
        
        credibility_score = 88.2
        residuals = {
            "continuity": 0.0008,
            "momentum": 0.0012,
            "energy": 0.0009
        }
        anomalies = []
        
        # Memory cleanup after heavy computation
        background_tasks.add_task(cleanup_memory)
        
        return ValidationResponse(
            credibility_score=credibility_score,
            residuals=residuals,
            anomalies=anomalies,
            timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        cleanup_memory()
        raise HTTPException(status_code=500, detail="Internal physics engine error")

@app.get("/")
async def root():
    return {
        "name": "Quantum-Hybrid PINN V8 API",
        "status": "online",
        "infrastructure": "Railway + Supabase"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080)
