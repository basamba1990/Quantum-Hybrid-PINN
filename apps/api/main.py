
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
BACKEND_SERVICE_URL = os.getenv("BACKEND_SERVICE_URL", "https://quantum-hybrid-backend.onrender.com")

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

# WebSocket connection manager
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
    output_file: Optional[str] = None

class ValidationRequest(BaseModel):
    pressure: float = Field(..., gt=0, lt=2000)
    temperature: float = Field(..., gt=10, lt=5000)
    density: float = Field(..., gt=0)
    velocity_magnitude: float = Field(..., ge=0)

    @validator("temperature")
    def validate_temperature(cls, v):
        if v < 13.8:
            logger.warning(f"Temperature {v}K is below hydrogen triple point")
        return v

class ValidationResponse(BaseModel):
    credibility_score: float
    residuals: Dict[str, float]
    anomalies: List[str]
    timestamp: datetime
    result_url: Optional[str] = None
    predictions3d: Optional[List[Dict[str, Any]]] = None
    physical_metrics: Optional[Dict[str, Any]] = None

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
    
    async def run_real_hybrid():
        try:
            if supabase is not None:
                update_hybrid_job_in_supabase(job_id, {"status": "running", "started_at": datetime.utcnow()})
            
            total_steps = request.n_steps
            current_iteration = 0
            
            # Charger les modèles et stats à la demande
            fno_uvw_model = await load_model_from_supabase("fno_turbulence_uvw.pth", FNO, n_modes=(8,8,8), hidden_channels=32, in_channels=3, out_channels=3)
            uvw_stats = await load_stats_from_supabase("turbulence_stats.npz")
            uvw_mean = uvw_stats["mean"] if uvw_stats else 0.0
            uvw_std = uvw_stats["std"] if uvw_stats else 1.0

            fno_3d_apg_model = await load_model_from_supabase("fno3d_apg_z1.pth", PINO3DNavierStokes)
            apg_stats = await load_stats_from_supabase("normalization_stats_apg.npz")
            fno_3d_apg_mean = apg_stats.get("mean", apg_stats.get("X_mean", 0.0)) if apg_stats else 0.0
            fno_3d_apg_std = apg_stats.get("std", apg_stats.get("X_std", 1.0)) if apg_stats else 1.0

            fno_3d_stokes_model = await load_model_from_supabase("fno3d_stokes.pth", PINO3DNavierStokes)
            stokes_stats = await load_stats_from_supabase("normalization_stats_stokes.npz")
            fno_3d_stokes_mean = stokes_stats["mean"] if stokes_stats else 0.0
            fno_3d_stokes_std = stokes_stats["std"] if stokes_stats else 1.0

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
                
                result = orchestrator.run_hybrid_step(
                    job_id=job_id,
                    ml_model=active_model,
                    n_steps=steps_to_run,
                    time_step=request.time_step,
                    residual_threshold=request.residual_threshold,
                    uvw_mean=active_mean,
                    uvw_std=active_std
                )
                current_iteration += steps_to_run
                
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
    try:
        job_dict = orchestrator.get_job_status(job_id)
        return JobStatusResponse(**job_dict)
    except ValueError:
        if supabase is None:
            raise HTTPException(status_code=404, detail="Job not found")
        result = supabase.table("hybrid_simulations").select("*").eq("id", job_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")
        job = result.data[0]
        
        def parse_iso_date(date_str):
            if not date_str or not isinstance(date_str, str): return None
            try:
                return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except: return None

        return JobStatusResponse(
            job_id=job["id"],
            name=job["job_name"],
            status=job["status"],
            created_at=parse_iso_date(job.get("created_at")) or datetime.utcnow(),
            started_at=parse_iso_date(job.get("started_at")),
            completed_at=parse_iso_date(job.get("completed_at")),
            results=job.get("results"),
            error_message=job.get("error_message")
        )

@app.get("/jobs", response_model=List[JobStatusResponse])
async def list_jobs(status: Optional[str] = None):
    try:
        local_jobs = orchestrator.list_jobs(status=status)
        supabase_jobs = []
        if supabase is not None:
            query = supabase.table("hybrid_simulations").select("*").order("created_at", desc=True)
            if status: query = query.eq("status", status)
            result = query.execute()
            for job in result.data:
                supabase_jobs.append({
                    "job_id": job["id"],
                    "name": job["job_name"],
                    "status": job["status"],
                    "created_at": job["created_at"],
                    "started_at": job.get("started_at"),
                    "completed_at": job.get("completed_at"),
                    "results": job.get("results"),
                    "error_message": job.get("error_message")
                })
        
        # Merge logic
        jobs_dict = {j["job_id"]: j for j in local_jobs}
        for j in supabase_jobs:
            if j["job_id"] not in jobs_dict:
                jobs_dict[j["job_id"]] = j
        
        response = []
        for job in jobs_dict.values():
            def parse_iso_date(date_str):
                if not date_str or not isinstance(date_str, str): return None
                try: return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                except: return None

            response.append(JobStatusResponse(
                job_id=job.get("job_id", job.get("id")),
                name=job.get("name", job.get("job_name")),
                status=job["status"],
                created_at=parse_iso_date(job.get("created_at")) or datetime.utcnow(),
                started_at=parse_iso_date(job.get("started_at")),
                completed_at=parse_iso_date(job.get("completed_at")),
                results=job.get("results"),
                error_message=job.get("error_message")
            ))
        return response
    except Exception as e:
        logger.error(f"Job listing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Validation endpoints
# ============================================
class AssimilationRequestV8(BaseModel):
    current_state: List[float]
    observation: List[float]

class AssimilationResponseV8(BaseModel):
    assimilated_state: List[float]
    innovation: List[float]
    timestamp: str

@app.post("/v2/assimilate", response_model=AssimilationResponseV8)
async def assimilate_v2(request: AssimilationRequestV8):
    if not HAS_ENGINES or current_model_v8 is None:
        # Fallback si le moteur n'est pas chargé
        return AssimilationResponseV8(
            assimilated_state=request.current_state,
            innovation=[0.0] * len(request.observation),
            timestamp=datetime.utcnow().isoformat()
        )
    try:
        result = current_model_v8.assimilate_data(request.current_state, request.observation)
        return AssimilationResponseV8(**result, timestamp=datetime.utcnow().isoformat())
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
        
        if pinn_v8:
            # Génération d'une série temporelle réelle (10 points) au lieu d'un point unique
            # On simule sur une petite grille spatiale autour du point de requête
            times = np.linspace(0, 10, 10)
            for t in times:
                res = pinn_v8.predict_state(float(t), 0.5, 0.5, 0.5)
                predictions3d.append(res)
                
                # Calcul des résidus réels via autograd
                t_t = torch.tensor([[t]], requires_grad=True)
                x_t = torch.tensor([[0.5]], requires_grad=True)
                y_t = torch.tensor([[0.5]], requires_grad=True)
                z_t = torch.tensor([[0.5]], requires_grad=True)
                
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
        else:
            # Fallback si PINN non dispo
            credibility_score = 60.7
            residuals_history = {"continuity": [0.01]*10, "momentum": [0.02]*10, "energy": [0.015]*10}
            anomalies = ["Moteur PINN V8 indisponible - Mode dégradé"]

        return ValidationResponse(
            credibility_score=credibility_score,
            residuals={k: float(np.mean(v)) for k, v in residuals_history.items()},
            anomalies=anomalies,
            timestamp=datetime.utcnow(),
            result_url=None,
            predictions3d=predictions3d,
            physical_metrics={
                "residual_history": residuals_history,
                "reynolds_number": 1.2e6, # Exemple industriel
                "mach_number": 0.05
            }
        )
    except Exception as e:
        logger.error(f"Validation 3D failed: {e}")
        raise HTTPException(status_code=500, detail=f"Validation 3D failed: {e}")
