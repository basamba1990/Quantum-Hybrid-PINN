import os
import uvicorn
import numpy as np
import gc
import torch
import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, List, Dict, Optional
from datetime import datetime
from supabase import create_client, Client

try:
    from cao.gates import evaluate_all_gates
except ImportError:
    from .cao.gates import evaluate_all_gates

# Global instances (Lazy Loaded)
current_model_v8 = None
risk_manager = None
fno_orchestrator = None
kalman_filter = None
model_path = os.getenv("MODEL_PATH", "models/pinn_model.pt")

def get_eos(*args, **kwargs):
    from fluid_properties import get_eos as _eos
    return _eos(*args, **kwargs)

# Lazy imports for heavy modules - imported on first request
# This ensures port binding happens fast on Render

def _get_device():
    from hydrogen_pinn_tfc_v8 import get_device as _gd
    return _gd()

# Lightweight modules loaded at startup (needed for root endpoints)
from scenario_engines import SCENARIO_ENGINES
from analysis_processor import router as analysis_router, init_processor
from pgd_pinn_api import router as pgd_pinn_router
from export_router import router as export_router

# Sweet Spot Analyzer — Lazy import (Industrial Grade Stability Analysis)
def _get_sweet_spot_analyzer():
    from sweet_spot_analyzer import run_sweet_spot_analysis as _ssa
    return _ssa

# IMPORT V2 APP LAZILY to avoid blocking port binding
# This prevents Render timeout when heavy modules take too long to import
hydrogen_api_v2_app = None
def _import_hydrogen_api_v2():
    global hydrogen_api_v2_app
    if hydrogen_api_v2_app is None:
        from hydrogen_api_v2 import app as v2
        hydrogen_api_v2_app = v2
    return hydrogen_api_v2_app

def clean_float(value: float, fallback: float = 0.0) -> float:
    if value is None or not np.isfinite(value):
        return fallback
    return float(value)

def clean_json(obj):
    if isinstance(obj, float):
        return float(obj) if np.isfinite(obj) else None
    elif isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json(i) for i in obj]
    elif isinstance(obj, (np.float32, np.float64)):
        return float(obj) if np.isfinite(obj) else None
    elif isinstance(obj, (np.int32, np.int64)):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return clean_json(obj.tolist())
    elif isinstance(obj, torch.Tensor):
        return clean_json(obj.detach().cpu().tolist())
    else:
        return obj


def _to_artifact_dict(value: Any) -> Any:
    """Sérialise un artefact CAO/mesh/contrat sans perdre sa provenance."""
    if value is None:
        return None
    if hasattr(value, "to_contract"):
        return _to_artifact_dict(value.to_contract())
    if hasattr(value, "to_dict"):
        return _to_artifact_dict(value.to_dict())
    if isinstance(value, dict):
        return {key: _to_artifact_dict(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_artifact_dict(item) for item in value]
    if isinstance(value, np.ndarray):
        return {"shape": list(value.shape), "dtype": str(value.dtype)}
    if isinstance(value, torch.Tensor):
        return {"shape": list(value.shape), "dtype": str(value.dtype)}
    if isinstance(value, (np.generic,)):
        return value.item()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _get_certification_artifacts(request: "SimulationRequest") -> Dict[str, Any]:
    """Récupère uniquement un paquet d’artefacts explicitement fourni ou créé par CAO."""
    inputs = request.scenario_inputs or {}
    provided = inputs.get("certification_artifacts")
    if isinstance(provided, dict):
        return provided

    revision_id = inputs.get("geometry_revision_id") or inputs.get("cao_geometry_revision_id")
    if not revision_id:
        return {}
    try:
        try:
            from cao_router import _PIPELINE_REGISTRY
        except ImportError:
            from .cao_router import _PIPELINE_REGISTRY
        entry = _PIPELINE_REGISTRY.get(str(revision_id))
    except Exception:
        entry = None
    if not entry:
        return {}
    return {
        "cad_import": entry.get("import"),
        "topology": entry.get("topology"),
        "mesh": entry.get("mesh"),
        "physics": entry.get("physics"),
        "boundary_conditions": entry.get("boundary_conditions"),
        "pinn_model": entry.get("pinn_model"),
        "case_contract": entry.get("case_contract"),
        "execution": entry.get("execution"),
    }


def _field_provenance_is_valid(fields: Any) -> bool:
    """Vérifie que chaque champ persisté possède unité et provenance non sentinelles."""
    if not isinstance(fields, dict) or not fields:
        return False
    for field in fields.values():
        if not isinstance(field, dict):
            return False
        unit = field.get("unit") or field.get("units")
        provenance = field.get("provenance") or field.get("source")
        if not isinstance(unit, str) or unit.strip().upper() in {"", "N/D", "REQUIRED_INPUT", "UNIT_REQUIRED", "UNVALIDATED"}:
            return False
        if not isinstance(provenance, str) or provenance.strip().upper() in {"", "REQUIRED_INPUT", "UNVALIDATED"}:
            return False
    return True


def _calculate_autograd_residuals(x_values: torch.Tensor, y_values: torch.Tensor,
                                   z_values: torch.Tensor, time_value: float) -> Optional[Dict[str, Any]]:
    """Calcule les normes L2 des résidus PDE par la méthode Autograd du PINN chargé."""
    if current_model_v8 is None or not hasattr(current_model_v8, "pinn_model"):
        return None
    model = current_model_v8.pinn_model
    if not hasattr(model, "compute_residuals"):
        return None
    try:
        device = current_model_v8.device
        t = torch.full_like(x_values, float(time_value), device=device, requires_grad=True)
        x = x_values.to(device).detach().clone().requires_grad_(True)
        y = y_values.to(device).detach().clone().requires_grad_(True)
        z = z_values.to(device).detach().clone().requires_grad_(True)
        rho, u, v, w, temperature = model(t, x, y, z)
        raw = model.compute_residuals(t, x, y, z, rho, u, v, w, temperature, scale_dict=None)
        mass, momentum_x, momentum_y, momentum_z, energy, scales = raw
        momentum = torch.cat([momentum_x.reshape(-1), momentum_y.reshape(-1), momentum_z.reshape(-1)])
        norm = lambda tensor: float(torch.sqrt(torch.mean(tensor.detach() ** 2)).cpu().item())
        residual_values = {"mass": norm(mass), "momentum": norm(momentum), "energy": norm(energy)}
        if not all(np.isfinite(value) for value in residual_values.values()):
            print("[AUTOGRAD] Non-finite residual detected; G5 remains UNVALIDATED.")
            return None
        return {
            "mass": residual_values["mass"],
            "momentum": residual_values["momentum"],
            "energy": residual_values["energy"],
            "momentum_components": {
                "x": norm(momentum_x),
                "y": norm(momentum_y),
                "z": norm(momentum_z),
            },
            "sample_count": int(x.numel()),
            "time_s": float(time_value),
            "computed_from": "PyTorch torch.autograd via GenericPINNSolver.compute_residuals",
            "normalization_scales": _to_artifact_dict(scales),
        }
    except Exception as exc:
        print(f"[AUTOGRAD] Residual calculation unavailable: {exc}")
        return None


def _gate_value(gate_report: Dict[str, Any], gate_name: str) -> bool:
    return any(g.get("gate") == gate_name and g.get("satisfied") is True for g in gate_report.get("gates", []))

app = FastAPI(
    title="Quantum-Hybrid PINN API (V8) - Memory Optimized",
    version="8.0.13",
    description="API Industrielle optimisée pour Render Free (RAM < 512MB)."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store (Capped to prevent OOM)
jobs_store = {}
MAX_JOBS_IN_MEMORY = 5

def trim_jobs_store():
    global jobs_store
    if len(jobs_store) > MAX_JOBS_IN_MEMORY:
        # Sort by creation time and keep newest
        sorted_jobs = sorted(jobs_store.items(), key=lambda x: x[1].get('created_at', ''), reverse=True)
        jobs_store = dict(sorted_jobs[:MAX_JOBS_IN_MEMORY])
        gc.collect()

# Include lightweight routers first
app.include_router(analysis_router)
app.include_router(export_router)

# LAZY LOADING FOR HEAVY ROUTERS (Kelly Senecal Gold V2.1.8)
# We use a custom wrapper to defer imports until the first request
# This ensures the port binds in < 5 seconds on Render.

@app.on_event("startup")
async def include_heavy_routers():
    """Include heavy routers AFTER the app has started to ensure fast port binding."""
    try:
        # PGD PINN Router
        from pgd_pinn_api import router as _pgd_router
        app.include_router(_pgd_router)
        
        # Transient Router
        from transient_router import router as _transient_router
        app.include_router(_transient_router)
        
        # CAO Router
        from cao_router import router as _cao_router
        app.include_router(_cao_router)
        
        print("✅ Heavy routers included successfully.")
    except Exception as e:
        print(f"⚠️ Error loading heavy routers: {e}")

# Lazy imports for heavy modules - will be available after startup
HydrogenPINNTFCV8 = None
GeometryHandler = None
DeepKalmanFilter = None
CFDValidationService = None
T_MIN = 273.15
T_MAX = 500.0
X_MIN = 0.0
X_MAX = 2.0
Y_MIN = -0.5
Y_MAX = 0.5
Z_MIN = -0.5
Z_MAX = 0.5
IndustrialRiskManager = None
current_model_v8 = None
risk_manager = None
fno_orchestrator = None
kalman_filter = None
# TRULY-INDUSTRIAL SUPABASE INITIALIZATION (Kelly Senecal V2.1.7)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ivhxnaxhgfbiqlhgfkik.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase_client: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None

SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "pinn-models")
SUPABASE_MODEL_PATH = os.getenv("SUPABASE_MODEL_PATH", "pinn_model.pt")

@app.on_event("startup")
async def startup_event():
    """Import heavy modules AFTER port is bound to prevent Render timeout."""
    global hydrogen_api_v2_app, HydrogenPINNTFCV8, GeometryHandler, \
           DeepKalmanFilter, CFDValidationService, T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX, \
           IndustrialRiskManager, supabase_client, SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET_NAME, SUPABASE_MODEL_PATH
    try:
        # Import heavy modules
        from hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8 as _HP
        from geometry_handler import GeometryHandler as _GH
        from deep_kalman_filter import DeepKalmanFilter as _DKF
        from cfd_validation_service import CFDValidationService as _CFD
        from pinn_3d_navier_stokes import T_MIN as _TMIN, T_MAX as _TMAX, X_MIN as _XMIN, X_MAX as _XMAX, Y_MIN as _YMIN, Y_MAX as _YMAX, Z_MIN as _ZMIN, Z_MAX as _ZMAX
        from salt_cavern_physics import SaltCavernPhysics
        from industrial_risk_manager import IndustrialRiskManager as _IRM
        
        HydrogenPINNTFCV8 = _HP
        GeometryHandler = _GH
        DeepKalmanFilter = _DKF
        CFDValidationService = _CFD
        T_MIN = _TMIN
        T_MAX = _TMAX
        X_MIN = _XMIN
        X_MAX = _XMAX
        Y_MIN = _YMIN
        Y_MAX = _YMAX
        Z_MIN = _ZMIN
        Z_MAX = _ZMAX
        IndustrialRiskManager = _IRM
        
        # Mount V2 app
        v2_app = _import_hydrogen_api_v2()
        # The v2_app already has /v2 prefixes in its routes, so we mount at root
        # or we should strip the prefixes from v2_app. 
        # Given the frontend calls /v2/analysis, and v2_app has /v2/analysis, 
        # mounting at / works better.
        app.mount("/", v2_app)
        print("✅ V2 API mounted successfully")
        
        # Initialize Supabase
        SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ivhxnaxhgfbiqlhgfkik.supabase.co")
        SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "pinn-models")
        SUPABASE_MODEL_PATH = os.getenv("SUPABASE_MODEL_PATH", "pinn_model.pt")
        
        if SUPABASE_URL and SUPABASE_KEY:
            supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            init_processor(SUPABASE_URL, SUPABASE_KEY)
            print(f"✅ Supabase & Analysis processor initialisés.")
        
        print("✅ All modules loaded successfully")
    except Exception as e:
        print(f"⚠️ Startup error (modules will load on demand): {e}")

# ==================== LAZY LOADING HELPERS ====================
async def ensure_pinn_loaded():
    global current_model_v8, risk_manager, HydrogenPINNTFCV8, IndustrialRiskManager
    if current_model_v8 is not None:
        return True
    
    print("📦 Lazy Loading PINN Model...")
    gc.collect()
    
    try:
        # Download if needed
        model_local_path = os.getenv("MODEL_PATH", "models/pinn_model.pt")
        if supabase_client and not os.path.exists(model_local_path):
            res = supabase_client.storage.from_(SUPABASE_BUCKET_NAME).download(SUPABASE_MODEL_PATH)
            if res:
                os.makedirs(os.path.dirname(model_local_path), exist_ok=True)
                with open(model_local_path, "wb") as f:
                    f.write(res)
        
        if HydrogenPINNTFCV8 is None or IndustrialRiskManager is None:
            from hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8 as _HP
            from industrial_risk_manager import IndustrialRiskManager as _IRM
            HydrogenPINNTFCV8 = _HP
            IndustrialRiskManager = _IRM
        current_model_v8 = HydrogenPINNTFCV8(layers=[4, 128, 128, 128, 128, 5], fluid_type="H2", geometry_type="pipeline")
        if os.path.exists(model_local_path):
            state_dict = torch.load(model_local_path, map_location=current_model_v8.device)
            current_model_v8.pinn_model.load_state_dict(state_dict, strict=False)
            print("✅ PINN Weights loaded.")
        
        risk_manager = IndustrialRiskManager(current_model_v8)
        current_model_v8.scales = {'mass': 1.0, 'mom': 1.0, 'energy': 1.0}
        gc.collect()
        return True
    except Exception as e:
        print(f"❌ PINN Load Error: {e}")
        return False

async def ensure_fno_loaded():
    global fno_orchestrator
    if fno_orchestrator is not None:
        return True
    
    print("📦 Lazy Loading FNO Model...")
    try:
        from fno_pipeline_orchestrator import FNOPipelineOrchestrator
        fno_model_path = "models/fno_model.pt"
        fno_orchestrator = FNOPipelineOrchestrator(model_path=fno_model_path)
        gc.collect()
        return True
    except Exception as e:
        print(f"⚠️ FNO Load Error: {e}")
        return False

# ==================== MODÈLES PYDANTIC ====================
class SimulationRequest(BaseModel):
    project_id: str = "default_project"
    job_name: str = "H2_Pipeline_Simulation"
    case_path: Optional[str] = "industrial_v8"
    scenario_type: Optional[str] = "H2_PIPELINE"
    scenario_inputs: Optional[dict] = {}
    n_steps: Optional[int] = 50 # Reduced default
    pressure: Optional[float] = None
    temperature: Optional[float] = None
    analysis_id: Optional[str] = None
    user_id: Optional[str] = None

class SimulationResponse(BaseModel):
    job_id: str
    status: str
    message: str

class PredictionRequestV8(BaseModel):
    time: Optional[float] = 0.0
    x: Optional[float] = 0.0
    y: Optional[float] = 0.0
    z: Optional[float] = 0.0
    scenario_type: Optional[str] = "H2_PIPELINE"
    fluid_type: Optional[str] = "H2"
    n_points: Optional[int] = 10

class PredictionResponseV8(BaseModel):
    pressure: float
    velocity_u: float
    velocity_v: float
    velocity_w: float
    temperature: float
    density: float
    credibility_score: Optional[float] = 100.0
    residuals: Optional[Dict[str, float]] = None
    predictions3d: Optional[List[Dict]] = None
    timestamp: str

# ==================== ENDPOINTS ====================
@app.get("/")
async def root():
    return clean_json({
        "message": "Quantum-Hybrid PINN API (V8) is running",
        "status": "operational",
        "version": "8.0.12",
        "device": str(_get_device()),
        "endpoints": {
            "core": ["/health", "/jobs", "/jobs/{job_id}"],
            "hybrid": ["/hybrid/run-simulation", "/v2/validate-3d", "/v2/assimilate"],
            "analysis_v2": ["/v2/submit-analysis", "/v2/analysis-status/{job_id}", "/v2/analysis-result/{job_id}"],
            "pgd_v2": ["/v2/hybrid/submit-hybrid-simulation", "/v2/hybrid/hybrid-status/{job_id}", "/v2/hybrid/hybrid-result/{job_id}", "/v2/hybrid/upload-mesh"],
            "export_v2": ["/v2/export/predictions/csv", "/v2/export/predictions/json", "/v2/export/residuals/csv", "/v2/export/audit/csv", "/v2/export/simulation/json", "/v2/export/simulation/csv", "/v2/export/validation-report/json", "/v2/export/formats"]
        }
    })

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found in memory (Trimmed or Expired)")
    return clean_json(job)

@app.post("/v2/validate-3d", response_model=PredictionResponseV8)
async def validate_3d(request: PredictionRequestV8):
    await ensure_pinn_loaded()
    try:
        t = request.time or 0.0
        N_points = min(request.n_points or 10, 100)
        
        t_samples, x_samples, y_samples, z_samples = current_model_v8.geometry_handler.get_sampling_points(N_points)
        t_samples = torch.full_like(x_samples, t)
        
        with torch.no_grad():
            rho_s, u_s, v_s, w_s, T_s = current_model_v8.pinn_model(
                t_samples.to(current_model_v8.device), 
                x_samples.to(current_model_v8.device), 
                y_samples.to(current_model_v8.device), 
                z_samples.to(current_model_v8.device)
            )
            
        predictions_list = []
        for i in range(N_points):
            rho_val = rho_s[i].view(1, 1)
            T_val = T_s[i].view(1, 1)
            p_val = get_eos(current_model_v8.fluid_type, rho_val, T_val)
            
            predictions_list.append({
                "time": t, "x": float(x_samples[i].item()), "y": float(y_samples[i].item()), "z": float(z_samples[i].item()),
                "pressure": float(p_val.item()), "velocity_u": float(u_s[i].item()),
                "velocity_v": float(v_s[i].item()), "velocity_w": float(w_s[i].item()),
                "temperature": float(T_s[i].item()), "density": float(rho_s[i].item()),
                "velocity_magnitude": float(torch.sqrt(u_s[i]**2 + v_s[i]**2 + w_s[i]**2).item())
            })

        idx = N_points // 2
        residuals = _calculate_autograd_residuals(
            x_samples.detach().cpu(),
            y_samples.detach().cpu(),
            z_samples.detach().cpu(),
            t,
        )
        return PredictionResponseV8(
            pressure=float(get_eos(current_model_v8.fluid_type, rho_s[idx].view(1,1), T_s[idx].view(1,1)).item()),
            velocity_u=float(u_s[idx].item()),
            velocity_v=float(v_s[idx].item()),
            velocity_w=float(w_s[idx].item()),
            temperature=float(T_s[idx].item()),
            density=float(rho_s[idx].item()),
            credibility_score=None,
            residuals=clean_json(residuals),
            predictions3d=clean_json(predictions_list),
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/hybrid/run-simulation", response_model=SimulationResponse)
async def run_hybrid_simulation_endpoint(request: SimulationRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    trim_jobs_store()
    jobs_store[job_id] = {
        "job_id": job_id,
        "status": "initializing", 
        "created_at": datetime.now().isoformat()
    }
    background_tasks.add_task(hybrid_simulation_task, job_id, request)
    return SimulationResponse(job_id=job_id, status="accepted", message="Simulation lancée.")

async def hybrid_simulation_task(job_id: str, request: SimulationRequest):
    global current_model_v8, fno_orchestrator
    jobs_store[job_id]["status"] = "running"
    
    try:
        await ensure_fno_loaded()
        await ensure_pinn_loaded()
        
        # Points de contrôle pour la visualisation
        req_x, req_y, req_z = 0.0, 0.0, 0.0
        num_steps = min(request.n_steps or 50, 100)
        predictions_list = []
        history = []

        # 1. Simulation temporelle (pour les graphiques 2D)
        for i in range(num_steps):
            sim_t = i * 0.1
            t_tensor = torch.tensor([[float(sim_t)]], dtype=torch.float32, device=current_model_v8.device)
            x_tensor = torch.tensor([[float(req_x)]], dtype=torch.float32, device=current_model_v8.device)
            y_tensor = torch.tensor([[float(req_y)]], dtype=torch.float32, device=current_model_v8.device)
            z_tensor = torch.tensor([[float(req_z)]], dtype=torch.float32, device=current_model_v8.device)

            with torch.no_grad():
                rho, u, v, w, T = current_model_v8.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
                p = get_eos(current_model_v8.fluid_type, rho, T)
                
            history.append({"iteration": i, "time": sim_t})
            
        # 2. Échantillonnage spatial haute densité (Truly-Industrial Volume Plein)
        # On utilise une grille structurée pour garantir la continuité volumétrique
        res_grid = 24 # Grille structurée haute densité pour le rendu volumétrique plein
        t_final = num_steps * 0.1
        
        # Génération d'une grille structurée dans le domaine physique
        x_range = torch.linspace(X_MIN, X_MAX, res_grid)
        y_range = torch.linspace(Y_MIN, Y_MAX, res_grid)
        z_range = torch.linspace(Z_MIN, Z_MAX, res_grid)
        grid_x, grid_y, grid_z = torch.meshgrid(x_range, y_range, z_range, indexing='ij')
        
        x_s = grid_x.flatten().to(current_model_v8.device)
        y_s = grid_y.flatten().to(current_model_v8.device)
        z_s = grid_z.flatten().to(current_model_v8.device)
        t_s = torch.full_like(x_s, t_final)
        
        with torch.no_grad():
            # Inférence par batch pour économiser la RAM
            rho_s, u_s, v_s, w_s, T_s = current_model_v8.pinn_model(t_s, x_s, y_s, z_s)
            
            for i in range(len(x_s)):
                # Filtre pour ne garder que les points à l'intérieur de la géométrie (ex: cylindre/sphère)
                if not current_model_v8.geometry_handler.is_inside(x_s[i].item(), y_s[i].item(), z_s[i].item()):
                    continue
                    
                rho_val = rho_s[i].view(1, 1)
                T_val = T_s[i].view(1, 1)
                p_val = get_eos(current_model_v8.fluid_type, rho_val, T_val)
                
                predictions_list.append({
                    "time": t_final, 
                    "x": float(x_s[i].item()), "y": float(y_s[i].item()), "z": float(z_s[i].item()),
                    "pressure": float(p_val.item()), "velocity_u": float(u_s[i].item()),
                    "velocity_v": float(v_s[i].item()), "velocity_w": float(w_s[i].item()),
                    "temperature": float(T_s[i].item()), "density": float(rho_s[i].item()),
                    "velocity_magnitude": float(torch.sqrt(u_s[i]**2 + v_s[i]**2 + w_s[i]**2).item())
                })

        x_pts = [p["x"] for p in predictions_list]
        y_pts = [p["y"] for p in predictions_list]
        z_pts = [p["z"] for p in predictions_list]
        autograd_residuals = None
        if predictions_list:
            autograd_residuals = _calculate_autograd_residuals(
                torch.tensor(x_pts, dtype=torch.float32),
                torch.tensor(y_pts, dtype=torch.float32),
                torch.tensor(z_pts, dtype=torch.float32),
                t_final,
            )
        if autograd_residuals is not None:
            history.append({"iteration": num_steps, "time": t_final, "residuals": autograd_residuals})

        # Une série transitoire n’est générée que si le contrat physique temporel
        # est fourni par l’appelant. Aucune onde ou propriété n’est inventée ici.
        physics_contract = (request.scenario_inputs or {}).get("physics_contract")
        if isinstance(physics_contract, dict) and physics_contract:
            try:
                from h2_sciml_engine import SciMLEngine
                engine = SciMLEngine(api_base_url=f"http://localhost:{os.getenv('PORT', 8080)}")
                transient_series = engine.generate_transient_series(
                    scenario_type=request.scenario_type or "H2_PIPELINE",
                    x_coords=x_pts,
                    y_coords=y_pts,
                    z_coords=z_pts,
                    time_steps=(request.scenario_inputs or {}).get("time_steps", []),
                    physics=physics_contract,
                )
            except Exception as trans_err:
                print(f"[TRANSIENT] Generation failed: {trans_err}")
                transient_series = {"is_true_transient": False, "status": "UNVALIDATED", "reason": str(trans_err)}
        else:
            transient_series = {
                "is_true_transient": False,
                "status": "REQUIRED_INPUT",
                "reason": "physics_contract et time_steps absents de la requête; aucune transition n’est simulée.",
            }

        artifacts = _get_certification_artifacts(request)
        artifact_execution = artifacts.get("execution") if isinstance(artifacts, dict) else None
        artifact_execution = artifact_execution if isinstance(artifact_execution, dict) else _to_artifact_dict(artifact_execution) or {}
        execution = dict(artifact_execution)
        if autograd_residuals is not None:
            autograd_residuals = dict(autograd_residuals)
            autograd_residuals["units"] = {
                "mass": "kg/(m^3*s)",
                "momentum": "N/m^3",
                "energy": "W/m^3",
            }
            execution["residuals"] = autograd_residuals
        requested_tolerance = (request.scenario_inputs or {}).get("residual_tolerance")
        if isinstance(requested_tolerance, (int, float)):
            execution["residual_tolerance"] = float(requested_tolerance)
        requested_reference = (request.scenario_inputs or {}).get("reference_comparison")
        if isinstance(requested_reference, dict) and requested_reference:
            execution["reference_comparison"] = requested_reference
        fields = (request.scenario_inputs or {}).get("fields")
        if fields is None:
            fields = (request.scenario_inputs or {}).get("field_provenance")
        fields = fields if isinstance(fields, dict) else {}
        artifacts_for_gates = dict(artifacts) if isinstance(artifacts, dict) else {}
        artifacts_for_gates["execution"] = execution if execution else None
        gate_report = evaluate_all_gates(artifacts_for_gates).to_dict()

        residual_tolerance = (request.scenario_inputs or {}).get("residual_tolerance")
        residuals_passed = False
        if isinstance(residual_tolerance, (int, float)) and autograd_residuals is not None:
            residuals_passed = all(
                isinstance(autograd_residuals.get(key), (int, float)) and
                np.isfinite(autograd_residuals[key]) and
                autograd_residuals[key] <= float(residual_tolerance)
                for key in ("mass", "momentum", "energy")
            )
        reference = execution.get("reference_comparison") if isinstance(execution, dict) else None
        reference_passed = isinstance(reference, dict) and (
            reference.get("validated") is True or reference.get("passed") is True
        )
        uncertainty = (request.scenario_inputs or {}).get("uncertainty_report")
        uncertainty_reported = isinstance(uncertainty, dict) and uncertainty.get("validated") is True
        gate_checks = {
            "residuals_passed": residuals_passed,
            "boundary_conditions_passed": _gate_value(gate_report, "G3_PHYSICS"),
            "conservation_passed": residuals_passed,
            "reference_comparison_passed": reference_passed,
            "uncertainty_reported": uncertainty_reported,
        }
        certification_evidence = {
            "contract_present": _gate_value(gate_report, "G4_NUMERICAL"),
            "geometry_validated": _gate_value(gate_report, "G0_SOURCE"),
            "mesh_validated": _gate_value(gate_report, "G2_MESH"),
            "field_provenance_validated": _field_provenance_is_valid(fields),
            "autograd_verified": autograd_residuals is not None,
            "reference_validated": reference_passed,
            "gate_report": gate_report,
        }
        all_certified = bool(gate_report.get("all_satisfied") and all(gate_checks.values()) and all(
            certification_evidence[key] for key in (
                "contract_present", "geometry_validated", "mesh_validated",
                "field_provenance_validated", "autograd_verified", "reference_validated",
            )
        ))
        credibility_score = None
        if autograd_residuals is not None and isinstance(residual_tolerance, (int, float)) and float(residual_tolerance) > 0:
            max_ratio = max(autograd_residuals[key] / float(residual_tolerance) for key in ("mass", "momentum", "energy"))
            credibility_score = max(0.0, min(100.0, 100.0 / (1.0 + max_ratio)))

        final_result = {
            "status": "completed",
            "validation_status": "VALIDATED" if all_certified else "UNVALIDATED",
            "credibility_score": credibility_score,
            "predictions3d": clean_json(predictions_list),
            "residual_history": clean_json(history),
            "pinn_predictions": clean_json(predictions_list),
            "transient_series": clean_json(transient_series),
            "gate_report": clean_json(gate_report),
            "validation_checks": clean_json(gate_checks),
            "certification_evidence": clean_json(certification_evidence),
            "geometry": _to_artifact_dict(artifacts_for_gates.get("cad_import")),
            "topology": _to_artifact_dict(artifacts_for_gates.get("topology")),
            "mesh": _to_artifact_dict(artifacts_for_gates.get("mesh")),
            "fields": clean_json(fields),
            "execution": clean_json(execution),
            "residuals": clean_json(autograd_residuals or {}),
            "velocityFieldU": clean_json([p["velocity_u"] for p in predictions_list]),
            "velocityFieldV": clean_json([p["velocity_v"] for p in predictions_list]),
            "pressureField": clean_json([p["pressure"] for p in predictions_list]),
            "temperatureField": clean_json([p["temperature"] for p in predictions_list]),
            "scenario_type": request.scenario_type or "H2_PIPELINE",
            "scenario_inputs": clean_json(request.scenario_inputs or {}),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # ====================================================================
        # SWEET SPOT ANALYSIS — Analyse automatique de stabilité thermodynamique
        # S'exécute à CHAQUE simulation pour identifier le point idéal de stabilité
        # sans transition de phase non désirée (Peng-Robinson EoS, ANSYS-level)
        # ====================================================================
        try:
            _ssa = _get_sweet_spot_analyzer()
            fluid_type = "H2"  # Par défaut H2, configurable via scenario_inputs
            if request.scenario_inputs and 'fluid_type' in request.scenario_inputs:
                fluid_type = request.scenario_inputs['fluid_type']
            sweet_spot_result = _ssa(
                scenario_inputs=request.scenario_inputs or {},
                fluid_type=fluid_type,
            )
            final_result["sweet_spot_analysis"] = sweet_spot_result.get("sweet_spot_analysis", {})
            print(f"[SWEET SPOT] Analysis completed for scenario={request.scenario_type}")
        except Exception as ss_error:
            print(f"[SWEET SPOT] Analysis skipped (non-critical): {ss_error}")
            final_result["sweet_spot_analysis"] = {
                "status": "SKIPPED",
                "reason": str(ss_error)
            }
        
        # KELLY SENECAL TRULY-INDUSTRIAL PERSISTENCE V2.1.7
        if supabase_client and request.analysis_id:
            # 1. Update main analysis record with unified schema
            supabase_client.table("analyses").update({
                "status": "completed",
                "results": final_result,
                "scenario_type": request.scenario_type or "H2_PIPELINE"
            }).eq("id", request.analysis_id).execute()
            
            # 2. Persist to analysis_results (priority table for volumetric rendering)
            # Use unified schema from final_result
            try:
                supabase_client.table("analysis_results").upsert({
                    "analysis_id": request.analysis_id,
                    "project_id": request.project_id,
                    "user_id": request.user_id if (hasattr(request, 'user_id') and request.user_id) else None,
                    "extracted_parameters": request.scenario_inputs or {},
                    "pinn_predictions": final_result.get("pinn_predictions", []),
                    "credibility_score": final_result.get("credibility_score"),
                    "anomalies": [],
                    "context": final_result.get("scenario_type", "H2_PIPELINE").lower(),
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
            except Exception as inner_e:
                print(f"Failed to persist to analysis_results: {inner_e}")

        jobs_store[job_id].update({"status": "completed", "results": final_result})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        jobs_store[job_id].update({"status": "failed", "errorMessage": str(e)})
    finally:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="warning")

# Build tag: 2026-08-18 13:20 - Samba Ba identity verification

# Build tag: 2026-08-19 20:15 - Truly-Operational V8.2 (Spatial Alignment & G0-G5 Evidence)
