import os
import json
import uvicorn
import numpy as np
import gc
import torch
import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime
from supabase import create_client, Client

# Global instances (Lazy Loaded)
API_VERSION = "8.0.13"

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
from cfd_import_router import router as cfd_import_router
from cfd_worker_router import router as cfd_worker_router
from hydrogen_api_v2 import router as hydrogen_v2_router
from pccv_router import router as pccv_router
from lh2_tank_router import router as lh2_tank_router

# Sweet Spot Analyzer — Lazy import (Industrial Grade Stability Analysis)
def _get_sweet_spot_analyzer():
    from sweet_spot_analyzer import run_sweet_spot_analysis as _ssa
    return _ssa

def clean_float(value: float, fallback: float = 0.0) -> float:
    if value is None or not np.isfinite(value):
        return fallback
    return float(value)

def clean_json(obj):
    if isinstance(obj, float):
        return clean_float(obj)
    elif isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json(i) for i in obj]
    elif isinstance(obj, (np.float32, np.float64)):
        return clean_float(obj)
    elif isinstance(obj, (np.int32, np.int64)):
        return int(obj)
    else:
        return obj

app = FastAPI(
    title="Quantum-Hybrid PINN API (V8) - Memory Optimized",
    version=API_VERSION,
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

# Include routers
app.include_router(analysis_router)
app.include_router(pgd_pinn_router)
app.include_router(export_router)
app.include_router(cfd_import_router)
app.include_router(cfd_worker_router)
app.include_router(hydrogen_v2_router)
app.include_router(pccv_router)
app.include_router(lh2_tank_router)

# Lazy import du pipeline CAO industriel (volets 1–9) pour ne pas bloquer
# le démarrage : les portes G0–G5 restent évaluées au runtime.
def _load_cao_router() -> APIRouter:
    """Charge le pipeline CAO industriel (volets 1–9) à l'import du module API."""
    from cao_router import router as _cao_router
    return _cao_router

app.include_router(_load_cao_router())

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
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase_client: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None

SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "pinn-models")
SUPABASE_MODEL_PATH = os.getenv("SUPABASE_MODEL_PATH", "pinn_model.pt")

@app.on_event("startup")
async def startup_event():
    """Import heavy modules AFTER port is bound to prevent Render timeout."""
    global HydrogenPINNTFCV8, GeometryHandler, \
           DeepKalmanFilter, CFDValidationService, T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX, \
           IndustrialRiskManager
    try:
        # Import heavy modules
        from hydrogen_pinn_v8 import HydrogenPINNV8 as _HP
        from phase_thermo import PhaseThermoConfig
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
    global current_model_v8, risk_manager
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
        
        phase_contract = json.loads(os.getenv("PHASE_THERMO_JSON", json.dumps({
            "saturation_temperature_k": 20.3,
            "latent_heat_j_kg": 446000.0,
            "cp_liquid_j_kg_k": 9700.0,
            "cp_vapor_j_kg_k": 14300.0,
            "reference_temperature_k": 20.3,
            "reference_enthalpy_j_kg": 0.0,
        })))
        current_model_v8 = HydrogenPINNTFCV8(
            layers=[4, 128, 128, 128, 128, 7],
            fluid_type="H2",
            phase_thermo=PhaseThermoConfig.from_contract(phase_contract),
        )
        current_model_v8.geometry_handler = GeometryHandler(geometry_type="pipeline")
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

# ==================== ENDPOINTS ====================
@app.get("/")
async def root():
    return clean_json({
        "message": "Quantum-Hybrid PINN API (V8) is running",
        "status": "operational",
        "version": API_VERSION,
        "device": str(_get_device()),
        "endpoints": {
            "core": ["/", "/health", "/jobs/{job_id}"],
            "cfd": ["/v2/cfd/import", "/v2/cfd/import-from-storage", "/v2/cfd/{analysis_id}", "/v2/cfd/{analysis_id}/gates"],
            "cao": ["/v2/cao/import", "/v2/cao/mesh", "/v2/cao/contract", "/v2/cao/gates", "/v2/cao/export", "/v2/cao/publish"],
            "analysis_v2": ["/v2/submit-analysis", "/v2/analysis-status/{job_id}", "/v2/analysis-result/{job_id}", "/v2/analysis/boundary-layer", "/v2/analysis/residuals-map"],
            "hybrid": ["/hybrid/run-simulation", "/v2/validate-3d", "/v2/predict-batch", "/v2/assimilate"],
            "hybrid_v2": ["/v2/hybrid/submit-hybrid-simulation", "/v2/hybrid/hybrid-status/{job_id}", "/v2/hybrid/hybrid-result/{job_id}", "/v2/hybrid/upload-mesh"],
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
                rho, u, v, w, T, alpha_liquid, enthalpy = current_model_v8.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
                p = get_eos(current_model_v8.fluid_type, rho, T)
                
            history.append({"iteration": i, "time": sim_t, "source": "pinn_inference_without_solver_evidence", "alpha_liquid": float(alpha_liquid.item()), "enthalpy": float(enthalpy.item())})
            
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
            rho_s, u_s, v_s, w_s, T_s, alpha_s, enthalpy_s = current_model_v8.pinn_model(t_s, x_s, y_s, z_s)
            
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
                    "alpha_liquid": float(alpha_s[i].item()), "enthalpy": float(enthalpy_s[i].item()),
                    "velocity_magnitude": float(torch.sqrt(u_s[i]**2 + v_s[i]**2 + w_s[i]**2).item())
                })

        # Cette route n'exécute aucun solveur et ne possède donc aucune preuve de résidu.
        # L'absence de preuve reste explicitement N/D : elle ne doit jamais être remplacée
        # par un score, zéro ou une petite valeur synthétique.
        unavailable_residuals = {
            "mass": None,
            "momentum": None,
            "energy": None,
            "phase_transport": None,
            "enthalpy_closure": None,
            "status": "UNAVAILABLE",
            "computedBy": None,
            "computedAt": None,
        }
        final_result = {
            "status": "completed",
            "validation_status": "EXPERIMENTAL_UNVALIDATED",
            "source": "pinn_inference_without_solver_evidence",
            "credibility_score": None,
            "predictions3d": clean_json(predictions_list),
            "residual_history": clean_json(history),
            "pinn_predictions": clean_json(predictions_list),
            "velocityFieldU": clean_json([p["velocity_u"] for p in predictions_list]),
            "velocityFieldV": clean_json([p["velocity_v"] for p in predictions_list]),
            "pressureField": clean_json([p["pressure"] for p in predictions_list]),
            "viscosityField": None,
            "residuals": unavailable_residuals,
            "continuityResidual": None,
            "momentumResidual": None,
            "energyResidual": None,
            "scenario_type": request.scenario_type or "H2_PIPELINE",
            "scenario_inputs": clean_json(request.scenario_inputs or {}),
            "updated_at": datetime.utcnow().isoformat()
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
            # A missing score is intentional for inference without solver evidence.
            # Do not coerce it to zero: zero is a real score and would misrepresent
            # an unvalidated analysis. The database migration makes this field nullable.
            try:
                analysis_result_row = {
                    "analysis_id": request.analysis_id,
                    "project_id": request.project_id,
                    "user_id": request.user_id if (hasattr(request, 'user_id') and request.user_id) else None,
                    "extracted_parameters": request.scenario_inputs or {},
                    "pinn_predictions": final_result.get("pinn_predictions", []),
                    "anomalies": [],
                    "context": final_result.get("scenario_type", "H2_PIPELINE").lower(),
                    "created_at": datetime.utcnow().isoformat()
                }
                credibility_score = final_result.get("credibility_score")
                if credibility_score is not None:
                    analysis_result_row["credibility_score"] = credibility_score
                supabase_client.table("analysis_results").upsert(analysis_result_row).execute()
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
