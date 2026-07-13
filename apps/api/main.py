import os
import uvicorn
import numpy as np
import gc
import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
from supabase import create_client, Client

# Import des nouveaux composants industriels
try:
    from generic_pinn_solver import GenericPINNSolver
    from geometry_manager import GeometryManager
    from salt_cavern_engine import SaltCavernEngine
    from scenario_engines import SCENARIO_ENGINES
    from analysis_processor import router as analysis_router, init_processor
    from pgd_pinn_api import router as pgd_pinn_router
    from fluid_properties import get_eos, FLUID_CONFIGS
except ImportError:
    from .generic_pinn_solver import GenericPINNSolver
    from .geometry_manager import GeometryManager
    from .salt_cavern_engine import SaltCavernEngine
    from .scenario_engines import SCENARIO_ENGINES
    from .analysis_processor import router as analysis_router, init_processor
    from .pgd_pinn_api import router as pgd_pinn_router
    from .fluid_properties import get_eos, FLUID_CONFIGS

app = FastAPI(
    title="Quantum-Hybrid PINN API (V8 Industrial Upgrade)",
    version="8.5.0",
    description="API Industrielle Mondiale pour la simulation physique par IA (PINN) - Navier-Stokes Complets & Géométries Arbitraires."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analysis_router)
app.include_router(pgd_pinn_router)

# Initialize analysis processor
supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://ivhxnaxhgfbiqlhgfkik.supabase.co')
supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
if supabase_url and supabase_key:
    try:
        init_processor(supabase_url, supabase_key)
        print('✅ Industrial Analysis processor initialized')
    except Exception as e:
        print(f'⚠️ Analysis processor initialization error: {e}')

@app.get("/")
async def root():
    return {
        "message": "Quantum-Hybrid PINN Industrial API is running",
        "status": "operational",
        "version": "8.5.0",
        "capabilities": [
            "Generic 3D Navier-Stokes Solver",
            "Complex Geometry Mapping",
            "Salt Cavern Creep Modeling",
            "Rigorous Physical Conservation Validation"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "gpu_available": torch.cuda.is_available()
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
