"""
API FastAPI pour le système Quantum-Hybrid-PINN.
Fournit des endpoints pour la validation des cas OpenFOAM et l'exécution des simulations hybrides.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
import uuid
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

# Modèles globaux
current_model_v8 = None
fno_3d_apg_model: Optional[torch.nn.Module] = None
fno_3d_apg_mean: float = 0.0
fno_3d_apg_std: float = 1.0

fno_3d_stokes_model: Optional[torch.nn.Module] = None
fno_3d_stokes_mean: float = 0.0
fno_3d_stokes_std: float = 1.0

fno_2d_trained_stats: Optional[Dict[str, float]] = None

# Initialisation des modèles au démarrage
def load_user_models():
    global fno_3d_apg_model, fno_3d_apg_mean, fno_3d_apg_std
    global fno_3d_stokes_model, fno_3d_stokes_mean, fno_3d_stokes_std
    global fno_2d_trained_stats
    
    if supabase is None:
        return

    # FNO 3D APG
    try:
        logger.info("⏳ Loading User Trained FNO 3D APG model...")
        model_data = supabase.storage.from_("models").download("fno3d_apg_z1.pth")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pth") as tmp:
            tmp.write(model_data)
            tmp_path = tmp.name
        
        fno_3d_apg_model = PINO3DNavierStokes(modes1=8, modes2=8, modes3=8, width=32, fluid_type='H2')
        fno_3d_apg_model.load_state_dict(torch.load(tmp_path, map_location=torch.device('cpu'), weights_only=False))
        fno_3d_apg_model.eval()
        logger.info("✅ User FNO 3D APG model loaded")
        os.unlink(tmp_path)

        stats_data = supabase.storage.from_("models").download("normalization_stats_apg.npz")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats:
            tmp_stats.write(stats_data)
            stats_path = tmp_stats.name
        stats = np.load(stats_path)
        fno_3d_apg_mean = float(stats['mean'])
        fno_3d_apg_std = float(stats['std'])
        logger.info(f"APG stats: mean={fno_3d_apg_mean:.3f}, std={fno_3d_apg_std:.3f}")
        os.unlink(stats_path)
    except Exception as e:
        logger.warning(f"Failed to load User FNO 3D APG model: {e}")

    # FNO 3D Stokes
    try:
        logger.info("⏳ Loading User Trained FNO 3D Stokes model...")
        # On vérifie si le fichier existe avant de tenter le téléchargement pour éviter les logs d'erreur HTTP 400/404
        res = supabase.storage.from_("models").list()
        file_names = [f['name'] for f in res]
        
        if "fno3d_stokes.pth" in file_names:
            model_data_stokes = supabase.storage.from_("models").download("fno3d_stokes.pth")
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pth") as tmp_stokes:
                tmp_stokes.write(model_data_stokes)
                tmp_path_stokes = tmp_stokes.name
            
            fno_3d_stokes_model = PINO3DNavierStokes(modes1=8, modes2=8, modes3=8, width=32, fluid_type='H2')
            fno_3d_stokes_model.load_state_dict(torch.load(tmp_path_stokes, map_location=torch.device('cpu'), weights_only=False))
            fno_3d_stokes_model.eval()
            logger.info("✅ User FNO 3D Stokes model loaded")
            os.unlink(tmp_path_stokes)

            if "normalization_stats_stokes.npz" in file_names:
                stats_data_stokes = supabase.storage.from_("models").download("normalization_stats_stokes.npz")
                with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats_stokes:
                    tmp_stats_stokes.write(stats_data_stokes)
                    stats_path_stokes = tmp_stats_stokes.name
                stats_stokes = np.load(stats_path_stokes)
                fno_3d_stokes_mean = float(stats_stokes['mean'])
                fno_3d_stokes_std = float(stats_stokes['std'])
                logger.info(f"Stokes stats: mean={fno_3d_stokes_mean:.3f}, std={fno_3d_stokes_std:.3f}")
                os.unlink(stats_path_stokes)
        else:
            logger.warning("User FNO 3D Stokes model file not found in Supabase storage.")
    except Exception as e:
        logger.warning(f"Failed to load User FNO 3D Stokes model: {e}")

    # 2D Model Stats
    try:
        logger.info("⏳ Loading User Trained 2D model stats...")
        stats_data_2d = supabase.storage.from_("models").download("modele_fno_entraine.npz")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats_2d:
            tmp_stats_2d.write(stats_data_2d)
            stats_path_2d = tmp_stats_2d.name
        stats_2d = np.load(stats_path_2d)
        fno_2d_trained_stats = {k: stats_2d[k] for k in stats_2d.files}
        logger.info(f"✅ User 2D model stats loaded")
        os.unlink(stats_path_2d)
    except Exception as e:
        logger.warning(f"Failed to load User 2D model stats: {e}")

# Initialiser l'application FastAPI
app = FastAPI(
    title="Quantum-Hybrid-PINN API",
    description="API pour l'exécution de simulations hybrides CFD-ML avec validation robuste des chemins",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    global current_model_v8
    if HAS_ENGINES:
        try:
            current_model_v8 = HydrogenPINNV8()
            logger.info("✅ Modèle V8 initialisé par défaut.")
        except Exception as e:
            logger.error(f"❌ Erreur initialisation V8: {e}")
    load_user_models()

# Initialiser le validateur de chemins
CASES_BASE_PATH = os.getenv("CASES_BASE_PATH", "/home/ubuntu/cases")
os.makedirs(CASES_BASE_PATH, exist_ok=True)
from path_validator import PathValidator
path_validator = PathValidator(base_path=CASES_BASE_PATH)

# Stockage en mémoire des jobs
jobs_store: Dict[str, Dict[str, Any]] = {}

# ============================================================================
# Modèles Pydantic
# ============================================================================

class CasePathRequest(BaseModel):
    case_name: str = Field(..., description="Nom du cas OpenFOAM")

class AbsolutePathRequest(BaseModel):
    absolute_path: str = Field(..., description="Chemin absolu complet")

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

class AssimilationRequestV8(BaseModel):
    current_state: List[float]
    observation: List[float]

class AssimilationResponseV8(BaseModel):
    assimilated_state: List[float]
    timestamp: str

# ============================================================================
# Endpoints
# ============================================================================

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Quantum-Hybrid-PINN API is running", "engines_loaded": HAS_ENGINES}

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
        message="Simulation hybride lancée avec succès"
    )

async def execute_simulation_task(job_id: str):
    if job_id not in jobs_store: return
    job_info = jobs_store[job_id]
    try:
        job_info["status"] = "RUNNING"
        orchestrator = FNOPipelineOrchestrator(fluid_type="H2")
        
        # Priority: Stokes > APG > Default
        active_model = None
        if fno_3d_stokes_model is not None:
            active_model = fno_3d_stokes_model
            logger.info("Using User Trained Stokes model for simulation task")
        elif fno_3d_apg_model is not None:
            active_model = fno_3d_apg_model
            logger.info("Using User Trained APG model for simulation task")
        
        n_steps = job_info["config"].get("n_steps", 100)
        for i in range(1, n_steps + 1):
            results = orchestrator.run_pipeline({"pressure": 1.0e5, "temperature": 300, "velocity": 1.0})
            job_info["results"] = {"iteration": i, "metrics": results["metrics"], "credibilityScore": results["final_credibility_score"]}
            await asyncio.sleep(0.01)
            
        job_info["status"] = "COMPLETED"
    except Exception as e:
        job_info["status"] = "FAILED"
        job_info["error_message"] = str(e)

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
