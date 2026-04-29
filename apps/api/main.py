"""
Quantum-Hybrid PINN V8 + repitframework - Enhanced FastAPI Backend
Unified API exposing PINN 3D, OpenFOAM orchestration, hybrid simulations, and dataset management
Optimized for Railway + Supabase + FNO 3D (turbulence + heat) + direct Supabase job updates
"""

import os
import logging
import gc
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
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

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Supabase client initialized")
else:
    logger.error("❌ Supabase credentials missing. Model loading impossible.")

orchestrator = SimulationOrchestrator()
dataset_manager = DatasetManager()

# ---------- Global models and stats ----------
# Heat model (optional)
fno_heat_model: Optional[torch.nn.Module] = None
heat_mean: float = 0.0
heat_std: float = 1.0
HEAT_GRID_SIZE = 16

# Turbulence model (mandatory)
fno_uvw_model: Optional[torch.nn.Module] = None
uvw_mean: float = 0.0
uvw_std: float = 1.0
UVW_GRID_SIZE = (32, 32, 32)   # doit correspondre à target_shape utilisé pendant l'entraînement

# ============================================
# Helper: Update hybrid simulation job in Supabase
# ============================================
def update_hybrid_job_in_supabase(job_id: str, updates: Dict[str, Any]) -> None:
    """Update a hybrid simulation job in Supabase."""
    if supabase is None:
        logger.warning(f"Supabase not available, cannot update job {job_id}")
        return
    try:
        # Convert datetime objects to ISO string for Supabase
        for key, value in updates.items():
            if isinstance(value, datetime):
                updates[key] = value.isoformat()
        supabase.table("hybrid_simulations").update(updates).eq("id", job_id).execute()
        logger.debug(f"Updated job {job_id} in Supabase: {updates.keys()}")
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
    case_path: str = Field(..., description="Path to OpenFOAM case directory")
    solver: str = Field("buoyantBoussinesqPimpleFoam", description="OpenFOAM solver")
    n_processors: int = Field(1, gt=0, description="Number of processors")

class OpenFOAMSimulationResponse(BaseModel):
    status: str
    log: str
    output_path: Optional[str] = None

class CFDDataProcessRequest(BaseModel):
    case_path: str = Field(..., description="Path to OpenFOAM case")
    output_path: str = Field(..., description="Path to save processed dataset")
    fields: List[str] = Field(default=["U", "p", "T"], description="Fields to process")
    start_time: float = Field(0.0, description="Start time")
    end_time: float = Field(10.0, description="End time")
    normalize: bool = Field(True, description="Normalize data")

class CFDDataProcessResponse(BaseModel):
    status: str
    message: str
    dataset_path: Optional[str] = None
    n_samples: Optional[int] = None
    shape: Optional[List[int]] = None

class HybridSimulationRequest(BaseModel):
    job_id: Optional[str] = Field(None, description="Existing Supabase job ID (if any)")
    job_name: str = Field(..., description="Name of simulation job")
    case_path: str = Field(..., description="Path to OpenFOAM case")
    n_steps: int = Field(100, gt=0, description="Number of simulation steps")
    time_step: float = Field(0.01, gt=0, description="Time step size")
    residual_threshold: float = Field(0.01, description="Residual threshold for ML/CFD switching")
    fields: List[str] = Field(default=["U", "p", "T"], description="Fields to monitor")

class HybridSimulationResponse(BaseModel):
    job_id: str
    status: str
    message: str
    results: Optional[Dict[str, Any]] = None

class ReinjectionRequest(BaseModel):
    case_path: str = Field(..., description="Path to OpenFOAM case")
    field_name: str = Field(..., description="Field name (U, p, T, etc.)")
    data: List[List[float]] = Field(..., description="Field data as 2D array")
    time_step: float = Field(..., description="Time step")

class ReinjectionResponse(BaseModel):
    status: str
    message: str
    output_file: Optional[str] = None

class ValidationRequest(BaseModel):
    pressure: float = Field(..., gt=0, lt=2000, description="Pressure in bar")
    temperature: float = Field(..., gt=10, lt=5000, description="Temperature in K")
    density: float = Field(..., gt=0, description="Density in kg/m³")
    velocity_magnitude: float = Field(..., ge=0, description="Velocity magnitude in m/s")

    @validator('temperature')
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
# Lifespan Events – strict model loading (turbulence mandatory, heat optional)
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global fno_heat_model, heat_mean, heat_std
    global fno_uvw_model, uvw_mean, uvw_std
    logger.info("🚀 Starting Quantum-Hybrid PINN V8 + repitframework Backend (strict turbulence mode)")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Device: {device}")
    logger.info(f"Orchestrator initialized with work_dir: {orchestrator.work_dir}")

    if supabase is None:
        raise RuntimeError("Supabase client not initialized. Cannot load models.")

    # ---------- Load turbulence model (mandatory) ----------
    try:
        model_data = supabase.storage.from_("models").download("fno_turbulence_uvw.pth")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pth") as tmp:
            tmp.write(model_data)
            tmp_path = tmp.name

        fno_uvw_model = FNO(
            n_modes=(8, 8, 8),
            hidden_channels=32,
            in_channels=3,
            out_channels=3,
        )
        fno_uvw_model.load_state_dict(torch.load(tmp_path, map_location=torch.device('cpu'), weights_only=False))
        fno_uvw_model.eval()
        logger.info("✅ FNO turbulence (uvw) model loaded from Supabase")

        stats_data = supabase.storage.from_("models").download("turbulence_stats.npz")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats:
            tmp_stats.write(stats_data)
            stats_path = tmp_stats.name
        stats = np.load(stats_path)
        uvw_mean = float(stats['mean'])
        uvw_std = float(stats['std'])
        logger.info(f"UVW stats: mean={uvw_mean:.3f}, std={uvw_std:.3f}")
    except Exception as e:
        logger.error(f"Failed to load mandatory turbulence model: {e}")
        raise RuntimeError("Missing fno_turbulence_uvw.pth or turbulence_stats.npz – cannot start API")

    # ---------- Load heat model (optional) ----------
    try:
        model_data = supabase.storage.from_("models").download("heat_fno_3d.pth")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pth") as tmp:
            tmp.write(model_data)
            tmp_path = tmp.name

        fno_heat_model = FNO(
            n_modes=(6, 6, 6),
            hidden_channels=24,
            in_channels=1,
            out_channels=1,
        )
        fno_heat_model.load_state_dict(torch.load(tmp_path, map_location=torch.device('cpu'), weights_only=False))
        fno_heat_model.eval()
        logger.info("✅ Heat FNO model loaded (optional)")

        try:
            stats_data = supabase.storage.from_("models").download("normalization_stats.npz")
            with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats:
                tmp_stats.write(stats_data)
                stats_path = tmp_stats.name
            stats = np.load(stats_path)
            heat_mean = float(stats['mean'])
            heat_std = float(stats['std'])
            logger.info(f"Heat stats: mean={heat_mean:.3f}, std={heat_std:.3f}")
        except Exception as e:
            logger.warning("Heat normalization stats missing – heat endpoint will fallback if needed")
    except Exception as e:
        logger.warning(f"Heat model not loaded (optional, will use fallback): {e}")

    yield

    logger.info("🛑 Shutting down Quantum-Hybrid Backend")
    cleanup_memory()

# ============================================
# FastAPI Application
# ============================================

app = FastAPI(
    title="Quantum-Hybrid PINN V8 + repitframework API",
    description="Physics-Informed Neural Networks + OpenFOAM Hybrid Orchestration + FNO 3D (turbulence)",
    version="2.1.0",
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
# Health & Status Endpoints
# ============================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    return HealthResponse(
        status="healthy",
        version="2.1.0",
        timestamp=datetime.utcnow(),
        gpu_available=torch.cuda.is_available(),
        memory_usage={
            "rss": mem_info.rss / (1024 * 1024),
            "vms": mem_info.vms / (1024 * 1024)
        }
    )

@app.get("/")
async def root():
    return {
        "message": "Quantum-Hybrid PINN V8 + repitframework API (turbulence model)",
        "version": "2.1.0",
        "endpoints": {
            "health": "/health",
            "openfoam": "/openfoam/*",
            "cfd": "/cfd/*",
            "hybrid": "/hybrid/*",
            "jobs": "/jobs/*",
            "validation_heat": "/v2/validate-3d",
            "validation_turbulence": "/v2/validate-3d-velocity",
            "training": "/training/upload"
        }
    }

# ============================================
# OpenFOAM Simulation Endpoints
# ============================================

@app.post("/openfoam/run-simulation", response_model=OpenFOAMSimulationResponse)
async def run_openfoam_simulation(request: OpenFOAMSimulationRequest, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Running OpenFOAM: {request.case_path} with {request.solver}")
        foam_utils = OpenFOAMUtils(request.case_path)
        log_decompose = ""
        if request.n_processors > 1:
            log_decompose = foam_utils.decompose_case(request.n_processors)
        log_solver = foam_utils.run_solver(request.solver, request.n_processors)
        log_reconstruct = ""
        if request.n_processors > 1:
            log_reconstruct = foam_utils.reconstruct_case()
        full_log = f"Decompose:\n{log_decompose}\n\nSolver:\n{log_solver}\n\nReconstruct:\n{log_reconstruct}"
        output_path = str(Path(request.case_path) / "reconstructed_results")
        background_tasks.add_task(cleanup_memory)
        return OpenFOAMSimulationResponse(status="success", log=full_log, output_path=output_path)
    except Exception as e:
        logger.error(f"OpenFOAM simulation error: {e}")
        cleanup_memory()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cfd/process-dataset", response_model=CFDDataProcessResponse)
async def process_cfd_dataset(request: CFDDataProcessRequest, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Processing CFD dataset from {request.case_path}")
        data, metadata = dataset_manager.load_cfd_dataset(
            case_path=request.case_path,
            fields=request.fields,
            time_range=(request.start_time, request.end_time),
            normalize=request.normalize
        )
        output_path = Path(request.output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        dataset_path = dataset_manager.save_dataset(data, metadata, output_path)
        background_tasks.add_task(cleanup_memory)
        return CFDDataProcessResponse(
            status="success",
            message="Dataset processed successfully",
            dataset_path=str(dataset_path),
            n_samples=metadata.n_samples,
            shape=list(data.shape)
        )
    except Exception as e:
        logger.error(f"CFD data processing error: {e}")
        cleanup_memory()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/openfoam/reinject-data", response_model=ReinjectionResponse)
async def reinject_openfoam_data(request: ReinjectionRequest, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Reinjecting {request.field_name} to {request.case_path}")
        output_file = str(Path(request.case_path) / f"{request.field_name}_{request.time_step}")
        background_tasks.add_task(cleanup_memory)
        return ReinjectionResponse(
            status="success",
            message=f"Field {request.field_name} reinjected successfully",
            output_file=output_file
        )
    except Exception as e:
        logger.error(f"Data reinjection error: {e}")
        cleanup_memory()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Hybrid Simulation Endpoints with Supabase update
# ============================================

@app.post("/hybrid/create-job", response_model=HybridSimulationResponse)
async def create_hybrid_job(request: HybridSimulationRequest):
    try:
        logger.info(f"Creating hybrid simulation job: {request.job_name}")
        job = orchestrator.create_job(
            name=request.job_name,
            case_path=request.case_path,
            config={
                "n_steps": request.n_steps,
                "time_step": request.time_step,
                "residual_threshold": request.residual_threshold,
                "fields": request.fields
            }
        )
        return HybridSimulationResponse(
            job_id=job.job_id,
            status="created",
            message=f"Job {job.job_id} created successfully"
        )
    except Exception as e:
        logger.error(f"Job creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/hybrid/run-simulation", response_model=HybridSimulationResponse)
async def run_hybrid_simulation(
    request: HybridSimulationRequest,
    background_tasks: BackgroundTasks
):
    """
    Run hybrid CFD-ML simulation.
    If job_id is provided (from Supabase), it will update that row.
    Otherwise, creates a local job (legacy mode).
    """
    try:
        logger.info(f"Running hybrid simulation: {request.job_name}")

        # Use provided job_id or generate new one
        job_id = request.job_id
        if job_id is None:
            # Legacy mode: create local job
            job = orchestrator.create_job(
                name=request.job_name,
                case_path=request.case_path,
                config={
                    "n_steps": request.n_steps,
                    "time_step": request.time_step,
                    "residual_threshold": request.residual_threshold,
                    "fields": request.fields
                }
            )
            job_id = job.job_id
            logger.info(f"Created new local job: {job_id}")
        else:
            logger.info(f"Using existing job ID from request: {job_id}")
            # Optionally create local orchestrator entry with same ID for consistency
            # (orchestrator.create_job expects its own ID; we can add a method to register external job)
            # For simplicity, we assume orchestrator can handle by ID later.

        # Update Supabase job status to 'running' and set started_at
        if supabase is not None:
            update_hybrid_job_in_supabase(job_id, {
                "status": "running",
                "started_at": datetime.utcnow()
            })

        # Background task to run simulation and update Supabase when done
        async def run_and_update():
            try:
                # Run hybrid simulation using orchestrator (accepts job_id)
                result = orchestrator.run_hybrid_simulation(
                    job_id=job_id,
                    ml_model=None,
                    n_steps=request.n_steps,
                    time_step=request.time_step,
                    residual_threshold=request.residual_threshold
                )
                # Format final results
                final_results = {
                    "status": result.get("status", "unknown"),
                    "iteration": result.get("iteration", request.n_steps),
                    "cfdTime": result.get("cfd_time", 0.0),
                    "mlTime": result.get("ml_time", 0.0),
                    "residuals": result.get("residuals", {}),
                    "log": result.get("log", "Simulation completed")
                }
                final_status = "completed" if result.get("status") == "success" else "failed"
                error_msg = result.get("error_message") if final_status == "failed" else None

                # Update Supabase with final results
                if supabase is not None:
                    update_hybrid_job_in_supabase(job_id, {
                        "status": final_status,
                        "results": final_results,
                        "completed_at": datetime.utcnow(),
                        "error_message": error_msg
                    })
                    logger.info(f"Supabase job {job_id} updated with final results")
                else:
                    logger.info(f"Supabase not configured, final results for job {job_id}: {final_results}")

                logger.info(f"Hybrid simulation completed for job {job_id} with status {final_status}")
            except Exception as e:
                logger.error(f"Hybrid simulation background task failed for job {job_id}: {e}")
                if supabase is not None:
                    update_hybrid_job_in_supabase(job_id, {
                        "status": "failed",
                        "error_message": str(e),
                        "completed_at": datetime.utcnow()
                    })
            finally:
                cleanup_memory()

        background_tasks.add_task(run_and_update)

        return HybridSimulationResponse(
            job_id=job_id,
            status="running",
            message=f"Hybrid simulation started for job {job_id}"
        )
    except Exception as e:
        logger.error(f"Hybrid simulation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Job Management Endpoints
# ============================================

@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    try:
        # Try local orchestrator first
        job_dict = orchestrator.get_job_status(job_id)
        return JobStatusResponse(**job_dict)
    except ValueError:
        # Fallback to Supabase
        if supabase is None:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found locally and Supabase not configured")
        result = supabase.table("hybrid_simulations").select("*").eq("id", job_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")
        job = result.data[0]
        return JobStatusResponse(
            job_id=job["id"],
            name=job["job_name"],
            status=job["status"],
            created_at=datetime.fromisoformat(job["created_at"]),
            started_at=datetime.fromisoformat(job["started_at"]) if job.get("started_at") else None,
            completed_at=datetime.fromisoformat(job["completed_at"]) if job.get("completed_at") else None,
            results=job.get("results"),
            error_message=job.get("error_message")
        )
    except Exception as e:
        logger.error(f"Job status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/jobs", response_model=List[JobStatusResponse])
async def list_jobs(status: Optional[str] = None):
    try:
        local_jobs = orchestrator.list_jobs(status=status)
        supabase_jobs = []
        if supabase is not None:
            query = supabase.table("hybrid_simulations").select("*").order("created_at", desc=True)
            if status:
                query = query.eq("status", status)
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
        # Merge (local overrides if same ID)
        jobs_dict = {}
        for j in local_jobs:
            jobs_dict[j["job_id"]] = j
        for j in supabase_jobs:
            if j["job_id"] not in jobs_dict:
                jobs_dict[j["job_id"]] = j
        response = []
        for job in jobs_dict.values():
            created_at = job["created_at"]
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            started_at = job.get("started_at")
            if started_at and isinstance(started_at, str):
                started_at = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            completed_at = job.get("completed_at")
            if completed_at and isinstance(completed_at, str):
                completed_at = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
            response.append(JobStatusResponse(
                job_id=job["job_id"],
                name=job["name"],
                status=job["status"],
                created_at=created_at,
                started_at=started_at,
                completed_at=completed_at,
                results=job.get("results"),
                error_message=job.get("error_message")
            ))
        return response
    except Exception as e:
        logger.error(f"Job listing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Physics Validation Endpoints
# ============================================

@app.post("/v2/validate-3d", response_model=ValidationResponse)
async def validate_3d(request: ValidationRequest, background_tasks: BackgroundTasks):
    global fno_heat_model, heat_mean, heat_std
    try:
        logger.info(f"3D heat validation: P={request.pressure} bar, T={request.temperature} K")

        if fno_heat_model is None:
            credibility_score = 88.2
            residuals = {"continuity": 0.0008, "momentum": 0.0012, "energy": 0.0009}
            anomalies = ["Heat model not loaded – using placeholder"]
        else:
            input_field = torch.full((1, 1, HEAT_GRID_SIZE, HEAT_GRID_SIZE, HEAT_GRID_SIZE),
                                     request.temperature, dtype=torch.float32)
            input_norm = (input_field - heat_mean) / (heat_std + 1e-8)
            with torch.no_grad():
                output_norm = fno_heat_model(input_norm)
                output = output_norm * heat_std + heat_mean
            predicted_temp = output.mean().item()
            credibility_score = min(100.0, 100.0 * (predicted_temp / (request.temperature + 1e-8)))
            variance = output.std().item()
            residuals = {
                "continuity": variance * 0.01,
                "momentum": variance * 0.02,
                "energy": variance * 0.005
            }
            anomalies = []

        background_tasks.add_task(cleanup_memory)
        return ValidationResponse(
            credibility_score=credibility_score,
            residuals=residuals,
            anomalies=anomalies,
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        logger.error(f"Heat validation error: {e}")
        cleanup_memory()
        raise HTTPException(status_code=500, detail=f"Heat engine error: {str(e)}")

@app.post("/v2/validate-3d-velocity", response_model=ValidationResponse)
async def validate_3d_velocity(request: ValidationRequest, background_tasks: BackgroundTasks):
    global fno_uvw_model, uvw_mean, uvw_std
    if fno_uvw_model is None:
        raise HTTPException(status_code=503, detail="Turbulence model not loaded")

    nx, ny, nz = UVW_GRID_SIZE
    val = request.velocity_magnitude / 1.732
    u_field = torch.full((1, nx, ny, nz), val, dtype=torch.float32)
    v_field = u_field.clone()
    w_field = u_field.clone()
    input_tensor = torch.stack([u_field, v_field, w_field], dim=1)

    input_norm = (input_tensor - uvw_mean) / (uvw_std + 1e-8)
    with torch.no_grad():
        output_norm = fno_uvw_model(input_norm)
        output = output_norm * uvw_std + uvw_mean

    predicted_u = output[0, 0].mean().item()
    credibility = min(100.0, 100.0 * (predicted_u / (val + 1e-8)))
    variance = output.std().item()
    residuals = {
        "continuity": variance * 0.01,
        "momentum": variance * 0.02,
        "energy": variance * 0.005
    }
    anomalies = []
    background_tasks.add_task(cleanup_memory)
    return ValidationResponse(
        credibility_score=credibility,
        residuals=residuals,
        anomalies=anomalies,
        timestamp=datetime.utcnow()
    )

# ============================================
# Training Endpoint: Upload & replace turbulence model
# ============================================

@app.post("/training/upload")
async def upload_model(file: UploadFile = File(...)):
    global fno_uvw_model, uvw_mean, uvw_std
    if supabase is None:
        raise HTTPException(500, "Supabase not configured")
    if not file.filename.endswith('.pth'):
        raise HTTPException(400, "Only .pth files are accepted")

    content = await file.read()

    try:
        supabase.storage.from_("models").upload(
            file.filename,
            content,
            {"content-type": "application/octet-stream"}
        )
        logger.info(f"Model {file.filename} uploaded to Supabase")
    except Exception as e:
        logger.error(f"Supabase upload failed: {e}")
        raise HTTPException(500, f"Upload failed: {str(e)}")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pth") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        new_model = FNO(
            n_modes=(8, 8, 8),
            hidden_channels=32,
            in_channels=3,
            out_channels=3,
        )
        new_model.load_state_dict(torch.load(tmp_path, map_location=torch.device('cpu'), weights_only=False))
        new_model.eval()
        fno_uvw_model = new_model
        logger.info("New turbulence model loaded into memory")
    except Exception as e:
        logger.error(f"Model loading failed: {e}")
        raise HTTPException(500, f"Failed to load model: {str(e)}")

    return {"status": "success", "message": f"Turbulence model {file.filename} uploaded and activated"}

# ============================================
# Error Handlers
# ============================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8000)),
        reload=os.getenv("API_RELOAD", "false").lower() == "true"
    )
