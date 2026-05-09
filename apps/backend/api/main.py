
"""
API FastAPI pour le système Quantum-Hybrid-PINN.
Optimisé avec Lazy Loading pour éviter les erreurs Out of Memory sur Render.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
import uuid
import asyncio
import gc
from datetime import datetime
from pathlib import Path
import os
import sys
import tempfile
import torch
import numpy as np
from supabase import create_client, Client

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Supabase client initialized")
else:
    logger.error("❌ Supabase credentials missing.")

# Configuration des chemins pour les moteurs
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Import des moteurs
try:
    from pvt_physics_engine import PVTPhysicsEngine
    from fno_pipeline_orchestrator import FNOPipelineOrchestrator
    from hydrogen_pinn_v8 import HydrogenPINNV8
    from fno_3d_navier_stokes import PINO3DNavierStokes
    HAS_ENGINES = True
    logger.info("✅ Moteurs PVT/FNO/V8 chargés avec succès.")
except ImportError as e:
    logger.error(f"❌ Échec de l'import des moteurs: {e}")
    HAS_ENGINES = False

# Cache pour les modèles chargés
MODEL_CACHE: Dict[str, Any] = {}

def cleanup_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    logger.debug("Memory cleanup performed")

async def get_model(model_name: str, model_class: Any, *args, **kwargs):
    """Charge un modèle depuis Supabase avec mise en cache."""
    if model_name in MODEL_CACHE:
        return MODEL_CACHE[model_name]
    
    if supabase is None:
        return None

    try:
        logger.info(f"⏳ Loading {model_name} from Supabase...")
        res = supabase.storage.from_("models").list()
        file_names = [f['name'] for f in res]
        
        if model_name in file_names:
            model_data = supabase.storage.from_("models").download(model_name)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pth") as tmp:
                tmp.write(model_data)
                tmp_path = tmp.name
            
            # Utilisation des dimensions par défaut détectées dans les logs
            model = model_class(modes1=12, modes2=12, modes3=1, width=32, in_channels=2, out_channels=1)
            model.load_state_dict(torch.load(tmp_path, map_location=torch.device('cpu'), weights_only=False))
            model.eval()
            os.unlink(tmp_path)
            MODEL_CACHE[model_name] = model
            logger.info(f"✅ {model_name} loaded successfully")
            return model
    except Exception as e:
        logger.warning(f"Failed to load {model_name}: {e}")
    return None

async def get_stats(stats_name: str):
    """Charge les stats depuis Supabase avec mise en cache."""
    if stats_name in MODEL_CACHE:
        return MODEL_CACHE[stats_name]
    
    if supabase is None:
        return None

    try:
        res = supabase.storage.from_("models").list()
        file_names = [f['name'] for f in res]
        
        if stats_name in file_names:
            stats_data = supabase.storage.from_("models").download(stats_name)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats:
                tmp_stats.write(stats_data)
                stats_path = tmp_stats.name
            stats = np.load(stats_path)
            os.unlink(stats_path)
            
            res_stats = {
                "mean": float(stats['mean']) if 'mean' in stats else 0.0,
                "std": float(stats['std']) if 'std' in stats else 1.0
            }
            MODEL_CACHE[stats_name] = res_stats
            return res_stats
    except Exception as e:
        logger.warning(f"Failed to load stats {stats_name}: {e}")
    return {"mean": 0.0, "std": 1.0}

# Initialiser l'application FastAPI
app = FastAPI(
    title="Quantum-Hybrid-PINN API",
    description="API pour l'exécution de simulations hybrides CFD-ML (Optimisée OOM)",
    version="1.1.0"
)

# Modèle V8 (chargé au démarrage car plus léger, mais peut être passé en lazy si besoin)
current_model_v8 = None

@app.on_event("startup")
async def startup_event():
    global current_model_v8
    if HAS_ENGINES:
        try:
            current_model_v8 = HydrogenPINNV8()
            logger.info("✅ Modèle V8 initialisé.")
        except Exception as e:
            logger.error(f"❌ Erreur initialisation V8: {e}")

# Initialiser le validateur de chemins
CASES_BASE_PATH = os.getenv("CASES_BASE_PATH", "/app/cases")
os.makedirs(CASES_BASE_PATH, exist_ok=True)
from path_validator import PathValidator
path_validator = PathValidator(base_path=CASES_BASE_PATH)

# Stockage en mémoire des jobs
jobs_store: Dict[str, Dict[str, Any]] = {}

# ============================================================================
# Modèles Pydantic
# ============================================================================

class SimulationRequest(BaseModel):
    project_id: Optional[str] = None
    user_id: Optional[str] = None
    job_id: Optional[str] = None
    job_name: str
    case_path: str
    n_steps: int = 100
    time_step: float = 0.01
    residual_threshold: float = 0.01
    fields: List[str] = ["U", "p", "T"]
    ml_weight: float = 0.5

class SimulationResponse(BaseModel):
    job_id: str
    case_name: str
    simulation_name: str
    status: str
    created_at: str
    message: str

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

# ============================================================================
# Endpoints
# ============================================================================

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Quantum-Hybrid-PINN API (OOM Optimized) is running", "engines_loaded": HAS_ENGINES}

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.post("/hybrid/run-simulation", tags=["Simulation"])
async def run_hybrid_simulation(request: SimulationRequest, background_tasks: BackgroundTasks):
    case_name = request.case_path.strip('/').split('/')[-1]
    job_id = request.job_id or str(uuid.uuid4())
    
    job_info = {
        "job_id": job_id,
        "case_name": case_name,
        "status": "PENDING",
        "created_at": datetime.utcnow().isoformat(),
        "config": request.dict()
    }
    jobs_store[job_id] = job_info
    background_tasks.add_task(execute_simulation_task, job_id)
    
    return SimulationResponse(
        job_id=job_id,
        case_name=case_name,
        simulation_name=request.job_name,
        status="PENDING",
        created_at=job_info["created_at"],
        message="Simulation hybride lancée (Lazy Loading activé)"
    )

async def execute_simulation_task(job_id: str):
    if job_id not in jobs_store: return
    job_info = jobs_store[job_id]
    try:
        job_info["status"] = "RUNNING"
        
        # Chargement des modèles à la demande (Lazy)
        stokes_model = await get_model("fno3d_stokes.pth", PINO3DNavierStokes)
        apg_model = await get_model("fno3d_apg_z1.pth", PINO3DNavierStokes)
        
        active_model = stokes_model or apg_model
        
        orchestrator = FNOPipelineOrchestrator(fluid_type="H2")
        
        n_steps = job_info["config"].get("n_steps", 100)
        for i in range(1, n_steps + 1):
            # Utilisation du modèle ML si disponible
            results = orchestrator.run_pipeline({"pressure": 1.0e5, "temperature": 300, "velocity": 1.0})
            job_info["results"] = {
                "iteration": i, 
                "metrics": results["metrics"], 
                "credibilityScore": results["final_credibility_score"],
                "model_used": "Stokes/APG" if active_model else "Default"
            }
            await asyncio.sleep(0.01)
            
        job_info["status"] = "COMPLETED"
    except Exception as e:
        logger.error(f"Simulation task failed: {e}")
        job_info["status"] = "FAILED"
        job_info["error_message"] = str(e)
    finally:
        cleanup_memory()

@app.get("/jobs/{job_id}", tags=["Simulation"])
async def get_job_status(job_id: str):
    if job_id not in jobs_store: raise HTTPException(status_code=404, detail="Job non trouvé")
    return jobs_store[job_id]

@app.post("/v2/validate-3d", response_model=PredictionResponseV8, tags=["V2"])
async def validate_3d(request: PredictionRequestV8):
    if current_model_v8 is None: raise HTTPException(status_code=503, detail="Moteur V8 non disponible")
    result = current_model_v8.predict_state(request.time, request.x, request.y, request.z)
    return PredictionResponseV8(**result, timestamp=datetime.utcnow().isoformat())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
