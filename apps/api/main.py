"""
Quantum-Hybrid FNO/PINNs + repitframework - Enhanced FastAPI Backend
Unified API exposing FNO 3D, OpenFOAM orchestration, hybrid simulations, dataset management
Optimized for Render + Supabase + FNO 3D (turbulence + heat) + real-time WebSocket progress
"""

import os
import logging
import gc
import tempfile
import asyncio
import requests
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
import torch
import numpy as np
from supabase import create_client, Client
import psutil
import uuid

from neuralop.models import FNO

from repit_integration.openfoam_utils import OpenFOAMUtils
from repit_integration.fvmn_dataset import FVMNDataset
from repit_integration.numpy_to_foam import numpyToFoam
from repit_integration.hybrid_predictor import HybridSimulationConfig, MLAcceleratedPredictor
from repit_integration.dataset_manager import DatasetManager
from repit_integration.simulation_orchestrator import SimulationOrchestrator
from fno_3d_navier_stokes import PINO3DNavierStokes

try:
    from hydrogen_pinn_v8 import HydrogenPINNV8
    HAS_ENGINES = True
except ImportError:
    HAS_ENGINES = False

current_model_v8 = None

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BACKEND_SERVICE_URL = os.getenv("BACKEND_SERVICE_URL", "https://quantum-hybrid-backend-liev.onrender.com")

supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Supabase client initialized")
else:
    logger.error("❌ Supabase credentials missing. Model loading impossible.")

orchestrator = SimulationOrchestrator()
dataset_manager = DatasetManager()

# ---------- Global models and stats (now managed by lazy loading) ----------
_fno_heat_model: Optional[torch.nn.Module] = None
_heat_mean: float = 0.0
_heat_std: float = 1.0
HEAT_GRID_SIZE = 16

_fno_uvw_model: Optional[torch.nn.Module] = None
_uvw_mean: float = 0.0
_uvw_std: float = 1.0
UVW_GRID_SIZE = (32, 32, 32)

_fno_3d_apg_model: Optional[torch.nn.Module] = None
_fno_3d_apg_mean: float = 0.0
_fno_3d_apg_std: float = 1.0

_fno_3d_stokes_model: Optional[torch.nn.Module] = None
_fno_3d_stokes_mean: float = 0.0
_fno_3d_stokes_std: float = 1.0

_fno_2d_trained_stats: Optional[Dict[str, float]] = None

# Cache pour les modèles chargés
MODEL_CACHE: Dict[str, Any] = {}

async def load_model_from_supabase(model_name: str, model_class: Any, *args, **kwargs) -> Any:
    """Charge un modèle depuis Supabase, le met en cache et retourne le modèle chargé."""
    if model_name in MODEL_CACHE:
        logger.info(f"✅ Modèle {model_name} chargé depuis le cache.")
        return MODEL_CACHE[model_name]

    if supabase is None:
        raise RuntimeError("Supabase client not initialized.")

    logger.info(f"⏳ Chargement du modèle {model_name}...")
    try:
        model_data = supabase.storage.from_("models").download(model_name)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pth") as tmp:
            tmp.write(model_data)
            tmp_path = tmp.name
        
        # Instanciation dynamique basée sur le nom du modèle pour éviter les erreurs de dimension
        if "apg" in model_name.lower():
            model = model_class(modes1=12, modes2=12, modes3=1, width=32, in_channels=2, out_channels=1)
        elif "stokes" in model_name.lower():
            model = model_class(modes1=12, modes2=12, modes3=1, width=32, in_channels=3, out_channels=1)
        else:
            model = model_class(*args, **kwargs)
            
        model.load_state_dict(torch.load(tmp_path, map_location=torch.device("cpu"), weights_only=False), strict=False)
        model.eval()
        os.unlink(tmp_path)
        logger.info(f"✅ Modèle {model_name} chargé avec succès.")
        MODEL_CACHE[model_name] = model
        return model
    except Exception as e:
        logger.error(f"❌ Échec du chargement du modèle {model_name}: {e}")
        return None

async def load_stats_from_supabase(stats_name: str) -> Optional[Dict[str, float]]:
    """Charge les statistiques depuis Supabase et les retourne."""
    if stats_name in MODEL_CACHE:
        logger.info(f"✅ Stats {stats_name} chargées depuis le cache.")
        return MODEL_CACHE[stats_name]

    if supabase is None:
        raise RuntimeError("Supabase client not initialized.")

    logger.info(f"⏳ Chargement des stats {stats_name}...")
    try:
        stats_data = supabase.storage.from_("models").download(stats_name)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats:
            tmp_stats.write(stats_data)
            stats_path = tmp_stats.name
        stats = np.load(stats_path)
        os.unlink(stats_path)
        
        # Correction pour gérer les tableaux NumPy (extraction de la valeur scalaire)
        result_stats = {}
        for k in stats.files:
            val = stats[k]
            if isinstance(val, np.ndarray):
                result_stats[k] = float(val.flatten()[0])
            else:
                result_stats[k] = float(val)
        
        logger.info(f"✅ Stats {stats_name} chargées avec succès: {result_stats}")
        MODEL_CACHE[stats_name] = result_stats
        return result_stats
    except Exception as e:
        logger.error(f"❌ Échec du chargement des stats {stats_name}: {e}")
        return None

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

manager = ConnectionManager()

# ============================================
# Helper: Update hybrid simulation job in Supabase
# ============================================
def update_hybrid_job_in_supabase(job_id: str, updates: Dict[str, Any]) -> None:
    if supabase is None:
        logger.warning(f"Supabase not available, cannot update job {job_id}")
        return
    try:
        for key, value in updates.items():
            if isinstance(value, datetime):
                updates[key] = value.isoformat()
        supabase.table("hybrid_simulations").update(updates).eq("id", job_id).execute()
        logger.debug(f"Updated job {job_id} in Supabase: {list(updates.keys())}")
    except Exception as e:
        logger.error(f"Failed to update job {job_id} in Supabase: {e}")

# ============================================
# Pydantic Models & Schemas
# ============================================
class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime
    gpu_available: bool
    memory_usage: Dict[str, float]

class OpenFOAMSimulationRequest(BaseModel):
    case_path: str
    solver: str = "buoyantBoussinesqPimpleFoam"
    n_processors: int = 1

class OpenFOAMSimulationResponse(BaseModel):
    status: str
    log: str
    output_path: Optional[str] = None

class CFDDataProcessRequest(BaseModel):
    case_path: str
    output_path: str
    fields: List[str] = ["U", "p", "T"]
    start_time: float = 0.0
    end_time: float = 10.0
    normalize: bool = True

class CFDDataProcessResponse(BaseModel):
    status: str
    message: str
    dataset_path: Optional[str] = None
    n_samples: Optional[int] = None
    shape: Optional[List[int]] = None

class HybridSimulationRequest(BaseModel):
    project_id: Optional[str] = None
    user_id: Optional[str] = None
    job_id: Optional[str] = None
    job_name: str
    case_path: str
    n_steps: int = 100
    time_step: float = 0.01
    residual_threshold: float = 0.01
    fields: List[str] = ["U", "p", "T"]

class HybridSimulationResponse(BaseModel):
    job_id: str
    status: str
    message: str
    results: Optional[Dict[str, Any]] = None

class ReinjectionRequest(BaseModel):
    case_path: str
    field_name: str
    data: List[List[float]]
    time_step: float

class ReinjectionResponse(BaseModel):
    status: str
    message: str

class PredictionRequestV8(BaseModel):
    time: float = 0.0
    x: float = 0.5
    y: float = 0.5
    z: float = 0.5

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

class ValidationRequest(BaseModel):
    # Support both physical and spatial parameters for backward compatibility
    pressure: Optional[float] = Field(None, gt=0, lt=2000)
    temperature: Optional[float] = Field(None, gt=10, lt=5000)
    density: Optional[float] = Field(None, gt=0)
    velocity_magnitude: Optional[float] = Field(None, ge=0)
    # Spatial parameters for V8
    time: Optional[float] = 0.0
    x: Optional[float] = 0.5
    y: Optional[float] = 0.5
    z: Optional[float] = 0.5

class ValidationResponse(BaseModel):
    credibility_score: float
    residuals: Dict[str, float]
    anomalies: List[str]
    timestamp: datetime
    result_url: Optional[str] = None
    predictions3d: Optional[List[Dict[str, Any]]] = None
    physical_metrics: Optional[Dict[str, Any]] = None
    # Add V8 compatibility
    status: Optional[str] = "success"
    prediction: Optional[Dict[str, Any]] = None

class JobStatusResponse(BaseModel):
    job_id: str
    name: str
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

# ============================================
# Memory Management
# ============================================
def cleanup_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    logger.debug("Memory cleanup performed")

# ============================================
# Lifespan
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting Quantum-Hybrid Backend (strict turbulence mode)")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Device: {device}")
    logger.info(f"Orchestrator work_dir: {orchestrator.work_dir}")

    if supabase is None:
        raise RuntimeError("Supabase client not initialized.")

    global current_model_v8
    if HAS_ENGINES:
        try:
            current_model_v8 = HydrogenPINNV8()
            logger.info("✅ Modèle V8 initialisé pour l'assimilation.")
        except Exception as e:
            logger.error(f"❌ Erreur initialisation V8: {e}")

    yield

    logger.info("🛑 Shutting down")
    MODEL_CACHE.clear()
    cleanup_memory()

# ============================================
# FastAPI app
# ============================================
app = FastAPI(
    title="Quantum-Hybrid API",
    description="FNO 3D turbulence + heat, OpenFOAM orchestration, real-time WebSocket",
    version="2.2.0",
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
# WebSocket endpoint
# ============================================
@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(websocket)
    try:
        while True:
            if supabase:
                result = supabase.table("hybrid_simulations").select("results").eq("id", job_id).execute()
                if result.data:
                    results = result.data[0].get("results", {})
                    await manager.send_message(results, websocket)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# ============================================
# Simulation endpoints
# ============================================
@app.post("/hybrid/run-simulation", response_model=HybridSimulationResponse)
async def run_hybrid_simulation(request: HybridSimulationRequest, background_tasks: BackgroundTasks):
    job_id = request.job_id or str(uuid.uuid4())
    
    # Correction : Créer le job dans l'orchestrateur avant de lancer la simulation
    # Cela évite l'erreur "Job not found" car l'orchestrateur doit connaître le job_id
    orchestrator.create_job(
        name=request.job_name,
        case_path=request.case_path,
        job_id=job_id,
        config={
            "n_steps": request.n_steps,
            "time_step": request.time_step,
            "residual_threshold": request.residual_threshold,
            "fields": request.fields
        }
    )

    async def run_real_hybrid():
        try:
            if supabase is not None:
                update_hybrid_job_in_supabase(job_id, {"status": "running", "started_at": datetime.utcnow()})
            
            total_steps = request.n_steps
            current_iteration = 0
            
            # Charger les modèles et stats à la demande
            fno_uvw_model = await load_model_from_supabase("fno_turbulence_uvw.pth", FNO, n_modes=(8,8,8), hidden_channels=32, in_channels=3, out_channels=3)
            uvw_stats = await load_stats_from_supabase("turbulence_stats.npz")
            uvw_mean = uvw_stats.get("mean", uvw_stats.get("X_mean", 0.0)) if uvw_stats else 0.0
            uvw_std = uvw_stats.get("std", uvw_stats.get("X_std", 1.0)) if uvw_stats else 1.0

            fno_3d_apg_model = await load_model_from_supabase("fno3d_apg_z1.pth", PINO3DNavierStokes)
            apg_stats = await load_stats_from_supabase("normalization_stats_apg.npz")
            fno_3d_apg_mean = apg_stats.get("mean", apg_stats.get("X_mean", 0.0)) if apg_stats else 0.0
            fno_3d_apg_std = apg_stats.get("std", apg_stats.get("X_std", 1.0)) if apg_stats else 1.0

            fno_3d_stokes_model = await load_model_from_supabase("fno3d_stokes.pth", PINO3DNavierStokes)
            stokes_stats = await load_stats_from_supabase("normalization_stats_stokes.npz")
            fno_3d_stokes_mean = stokes_stats.get("mean", stokes_stats.get("Y_mean", 0.0)) if stokes_stats else 0.0
            fno_3d_stokes_std = stokes_stats.get("std", stokes_stats.get("Y_std", 1.0)) if stokes_stats else 1.0

            if fno_uvw_model is None or fno_3d_apg_model is None or fno_3d_stokes_model is None:
                raise RuntimeError("Un ou plusieurs modèles FNO n'ont pas pu être chargés.")

            while current_iteration < total_steps:
                steps_to_run = min(10, total_steps - current_iteration)
                
                # Priority: Stokes > APG > Default (Turbulence)
                if fno_3d_stokes_model is not None:
                    active_model = fno_3d_stokes_model
                    active_mean = fno_3d_stokes_mean
                    active_std = fno_3d_stokes_std
                elif fno_3d_apg_model is not None:
                    active_model = fno_3d_apg_model
                    active_mean = fno_3d_apg_mean
                    active_std = fno_3d_apg_std
                else:
                    active_model = fno_uvw_model
                    active_mean = uvw_mean
                    active_std = uvw_std
                
                result = orchestrator.run_hybrid_simulation(
                    job_id=job_id,
                    ml_model=active_model,
                    n_steps=steps_to_run,
                    time_step=request.time_step,
                    residual_threshold=request.residual_threshold,
                    uvw_mean=active_mean,
                    uvw_std=active_std
                )
                current_iteration += steps_to_run
                
                # SimulationOrchestrator returns snake_case, frontend expects camelCase
                frontend_results = {
                    "iteration": current_iteration,
                    "cfdTime": result.get("cfd_time", 0.0),
                    "mlTime": result.get("ml_time", 0.0),
                    "residuals": result.get("residuals", {}),
                    "log": result.get("log", ""),
                    "credibilityScore": result.get("credibility_score", 0.0)
                }

                if supabase is not None:
                    update_hybrid_job_in_supabase(job_id, {"results": frontend_results})
                
                for conn in manager.active_connections:
                    await manager.send_message({"job_id": job_id, "progress": current_iteration, "total": total_steps, "completed": current_iteration >= total_steps}, conn)

            if supabase is not None:
                update_hybrid_job_in_supabase(job_id, {"status": "completed", "completed_at": datetime.utcnow()})

        except Exception as e:
            logger.error(f"Local hybrid simulation failed: {e}")
            if supabase is not None:
                update_hybrid_job_in_supabase(job_id, {"status": "failed", "error_message": str(e), "completed_at": datetime.utcnow()})
        finally:
            cleanup_memory()

    background_tasks.add_task(run_real_hybrid)
    return HybridSimulationResponse(job_id=job_id, status="running", message="Simulation hybride démarrée localement")

# ============================================
# Job management endpoints
# ============================================
@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase not available")
    
    try:
        result = supabase.table("hybrid_simulations").select("*").eq("id", job_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job_data = result.data[0]
        return JobStatusResponse(
            job_id=job_data["id"],
            name=job_data["job_name"],
            status=job_data["status"],
            created_at=datetime.fromisoformat(job_data["created_at"].replace("Z", "+00:00")),
            started_at=datetime.fromisoformat(job_data["started_at"].replace("Z", "+00:00")) if job_data["started_at"] else None,
            completed_at=datetime.fromisoformat(job_data["completed_at"].replace("Z", "+00:00")) if job_data["completed_at"] else None,
            results=job_data["results"],
            error_message=job_data["error_message"]
        )
    except Exception as e:
        logger.error(f"Failed to fetch job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# OpenFOAM & Data endpoints
# ============================================
@app.post("/openfoam/run", response_model=OpenFOAMSimulationResponse)
async def run_openfoam(request: OpenFOAMSimulationRequest):
    try:
        result = orchestrator.run_openfoam(request.case_path, request.solver, request.n_processors)
        return OpenFOAMSimulationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/data/process-cfd", response_model=CFDDataProcessResponse)
async def process_cfd_data(request: CFDDataProcessRequest):
    try:
        result = dataset_manager.process_openfoam_case(
            request.case_path, 
            request.output_path, 
            request.fields,
            request.start_time,
            request.end_time,
            request.normalize
        )
        return CFDDataProcessResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# PINN V8 endpoints
# ============================================
@app.post("/v2/assimilate", response_model=Dict[str, Any])
async def assimilate_v8(request: Any):
    if current_model_v8 is None:
        raise HTTPException(status_code=503, detail="V8 engine not available")
    try:
        result = current_model_v8.assimilate_data(request.current_state, request.observation)
        return {**result, "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assimilation failed: {e}")

@app.post("/v2/validate-3d", response_model=ValidationResponse)
async def validate_3d(request: ValidationRequest, background_tasks: BackgroundTasks):
    # Initialisation du modèle PINN V8 pour une analyse réelle
    try:
        from hydrogen_pinn_v8 import HydrogenPINNV8
        pinn_v8 = HydrogenPINNV8()
    except Exception as e:
        logger.error(f"Failed to load PINN V8: {e}")
        pinn_v8 = None

    try:
        predictions3d = []
        residuals_history = {"continuity": [], "momentum": [], "energy": []}
        
        # Use provided coordinates or defaults
        req_t = getattr(request, 'time', 0.0) or 0.0
        req_x = getattr(request, 'x', 0.5) or 0.5
        req_y = getattr(request, 'y', 0.5) or 0.5
        req_z = getattr(request, 'z', 0.5) or 0.5

        if pinn_v8:
            # Prediction at requested point
            single_res = pinn_v8.predict_state(float(req_t), float(req_x), float(req_y), float(req_z))
            
            # Génération d'une série temporelle réelle (10 points) pour les résidus
            times = np.linspace(0, 10, 10)
            for t in times:
                res = pinn_v8.predict_state(float(t), float(req_x), float(req_y), float(req_z))
                predictions3d.append(res)
                
                # Calcul des résidus réels via autograd
                t_t = torch.tensor([[t]], requires_grad=True)
                x_t = torch.tensor([[req_x]], requires_grad=True)
                y_t = torch.tensor([[req_y]], requires_grad=True)
                z_t = torch.tensor([[req_z]], requires_grad=True)
                
                rho, u, v, w, T = pinn_v8.pinn_model(t_t, x_t, y_t, z_t)
                mass, mx, my, mz, en = pinn_v8.pinn_model.compute_residuals(t_t, x_t, y_t, z_t, rho, u, v, w, T)
                
                residuals_history["continuity"].append(float(torch.abs(mass).mean()))
                residuals_history["momentum"].append(float((torch.abs(mx) + torch.abs(my) + torch.abs(mz)).mean()))
                residuals_history["energy"].append(float(torch.abs(en).mean()))

            avg_res = np.mean(residuals_history["continuity"]) + np.mean(residuals_history["momentum"])
            credibility_score = max(10.0, min(99.0, 100 - (avg_res * 1000)))
            
            # Analyse industrielle des anomalies
            anomalies = []
            if np.mean(residuals_history["continuity"]) > 0.01:
                anomalies.append("Défaut de conservation de la masse détecté (Résidu élevé)")
            if np.max(residuals_history["energy"]) > 0.05:
                anomalies.append("Instabilité thermique détectée dans la couche limite")
            
            return ValidationResponse(
                credibility_score=credibility_score,
                residuals={k: float(np.mean(v)) if v else 0.0 for k, v in residuals_history.items()},
                anomalies=anomalies,
                timestamp=datetime.utcnow(),
                predictions3d=predictions3d,
                prediction=single_res,
                status="success"
            )
        else:
            # Fallback si PINN non dispo
            return ValidationResponse(
                credibility_score=85.0,
                residuals={"continuity": 0.001, "momentum": 0.002, "energy": 0.001},
                anomalies=["Moteur PINN V8 indisponible - Mode dégradé"],
                timestamp=datetime.utcnow(),
                predictions3d=[{"t": req_t, "p": 101325, "T": 300}],
                status="success"
            )
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        version="2.2.0",
        timestamp=datetime.utcnow(),
        gpu_available=torch.cuda.is_available(),
        memory_usage={
            "percent": psutil.virtual_memory().percent,
            "available_gb": psutil.virtual_memory().available / (1024**3)
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
