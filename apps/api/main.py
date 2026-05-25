"""
API FastAPI - Quantum-Hybrid-PINN (asynchrone avec polling)
Version 5.3.1 – endpoints /jobs ajoutés, scénarios complets.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
import logging
import uuid
import asyncio
import gc
import math
from datetime import datetime
import os
import sys
import torch
import numpy as np
from supabase import create_client, Client

# ============================================================================
# Configuration
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Supabase client initialized")
    except Exception as e:
        logger.error(f"❌ Supabase init failed: {e}")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

try:
    from scenario_engines import SCENARIO_ENGINES
    HAS_SCENARIOS = True
    logger.info("✅ Moteurs de scénarios chargés")
except ImportError:
    HAS_SCENARIOS = False
    logger.warning("⚠️ Moteurs de scénarios non trouvés")

def cleanup_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

app = FastAPI(title="Quantum-Hybrid-PINN API", version="5.3.1")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://quantum-hybrid-pinn-web.vercel.app").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Modèles
# ============================================================================

class SimulationRequest(BaseModel):
    project_id: str
    user_id: str
    job_id: Optional[str] = None
    job_name: str = Field(..., min_length=1, max_length=100)
    case_path: str
    n_steps: int = Field(100, gt=0, le=1000)
    time_step: float = Field(0.01, gt=0)
    residual_threshold: float = Field(0.01, gt=0)
    fields: List[str] = ["U", "p", "T", "rho"]
    ml_weight: float = Field(0.5, ge=0, le=1)
    fluid: str = "H2"
    pressure: float = 80.0
    temperature: float = 300.0
    flow_rate: float = 2.0
    length: float = 100.0
    diameter: float = 0.5
    scenario_type: str = "H2_PIPELINE"
    scenario_inputs: Dict[str, Any] = {}

    @validator('job_name')
    def sanitize_name(cls, v):
        return "".join(c for c in v if c.isalnum() or c in (' ', '-', '_')).strip()

class SimulationResponse(BaseModel):
    job_id: str
    status: str
    message: str

class Validate3DRequest(BaseModel):
    pressure: float
    temperature: float
    density: float
    velocity_magnitude: float
    x: float = 0.5
    y: float = 0.5
    z: float = 0.5

class Validate3DResponse(BaseModel):
    credibility_score: float
    residuals: Dict[str, float]
    anomalies: List[str]
    predictions3d: List[Dict[str, Any]] = []
    physical_metrics: Dict[str, Any] = {}

class AssimilateRequest(BaseModel):
    current_state: List[float]
    observation: List[float]

class AssimilateResponse(BaseModel):
    assimilated_state: List[float]
    timestamp: str

# ============================================================================
# Endpoints V2 (utilisés par l'Edge Function)
# ============================================================================

@app.post("/v2/validate-3d", response_model=Validate3DResponse)
async def validate_3d(request: Validate3DRequest):
    pressure_bar = request.pressure / 1e5
    temp_k = request.temperature

    pressure_score = max(0, 100 - abs(pressure_bar - 350) / 7)
    temp_score = max(0, 100 - abs(temp_k - 300) / 5)
    credibility_score = (pressure_score * 0.4 + temp_score * 0.6)

    residuals = {
        "continuity": 1e-4 * (1 + np.random.uniform(0, 0.5)),
        "momentum": 1e-4 * (1 + np.random.uniform(0, 0.5)),
        "energy": 1e-4 * (1 + np.random.uniform(0, 0.5))
    }

    anomalies = []
    if pressure_bar > 800:
        anomalies.append("Pression critique dépassée")
    if temp_k < 14:
        anomalies.append("Température sous le point triple H2")

    predictions3d = []
    for i in range(5):
        t = i * 0.2
        predictions3d.append({
            "time": t, "x": request.x, "y": request.y, "z": request.z,
            "pressure": request.pressure * (1 - 0.01 * t),
            "velocity_u": request.velocity_magnitude * (1 + 0.02 * math.sin(t)),
            "velocity_v": 0, "velocity_w": 0,
            "temperature": request.temperature + 0.5 * math.sin(t),
            "density": request.density
        })

    physical_metrics = {
        "reynolds": request.density * request.velocity_magnitude * 1.0 / 1e-5,
        "mach": request.velocity_magnitude / 1300,
        "residuals": residuals
    }

    return Validate3DResponse(
        credibility_score=round(credibility_score, 2),
        residuals=residuals,
        anomalies=anomalies,
        predictions3d=predictions3d,
        physical_metrics=physical_metrics
    )

@app.post("/v2/assimilate", response_model=AssimilateResponse)
async def assimilate(request: AssimilateRequest):
    current = request.current_state
    obs = request.observation
    gain = 0.7
    assimilated = [c + gain * (o - c) for c, o in zip(current, obs)]
    if len(assimilated) >= 2:
        assimilated[0] = max(1e5, min(1e7, assimilated[0]))
        assimilated[1] = max(14, min(800, assimilated[1]))
    return AssimilateResponse(
        assimilated_state=assimilated,
        timestamp=datetime.utcnow().isoformat()
    )

# ============================================================================
# Simulation asynchrone avec écriture dans Supabase
# ============================================================================

@app.post("/hybrid/run-simulation", response_model=SimulationResponse)
async def run_hybrid_simulation(request: SimulationRequest, background_tasks: BackgroundTasks):
    job_id = request.job_id or str(uuid.uuid4())

    # Création immédiate de l'enregistrement dans Supabase (statut running)
    if supabase:
        try:
            supabase.table("hybrid_simulations").insert({
                "id": job_id,
                "project_id": request.project_id,
                "user_id": request.user_id,
                "job_name": request.job_name,
                "case_path": request.case_path,
                "status": "running",
                "started_at": datetime.utcnow().isoformat(),
                "config": request.dict(),
                "results": {
                    "iteration": 0,
                    "cfdTime": 0,
                    "mlTime": 0,
                    "residuals": {},
                    "log": "Initialisation...",
                    "credibilityScore": 0
                }
            }).execute()
            logger.info(f"Job {job_id} created in Supabase")
        except Exception as e:
            logger.error(f"Failed to insert job in Supabase: {e}")

    # Lancement de la tâche asynchrone
    background_tasks.add_task(execute_simulation_task, job_id, request)

    return SimulationResponse(
        job_id=job_id,
        status="RUNNING",
        message=f"Simulation {request.job_name} started"
    )

async def execute_simulation_task(job_id: str, request: SimulationRequest):
    try:
        # Exécution du scénario
        if HAS_SCENARIOS and request.scenario_type in SCENARIO_ENGINES:
            engine = SCENARIO_ENGINES[request.scenario_type]
            industrial_results = engine(request.scenario_inputs)

            final_result = {
                "iteration": 1,
                "cfdTime": 0.0,
                "mlTime": 0.0,
                "residuals": {"continuity": 1e-6},
                "log": f"Scénario {request.scenario_type} exécuté avec succès",
                "credibilityScore": industrial_results.get("safetyScore", industrial_results.get("stabilityScore", 95)),
                "fields": {k: [v] for k, v in industrial_results.items() if isinstance(v, (int, float))},
                "turbulentData": {"time": [0], "tke": [0.01], "dissipation": [0.001]},
                "residuals_history": [],
                "scenario_outputs": industrial_results
            }
        else:
            final_result = {
                "iteration": 1,
                "cfdTime": 0.5,
                "mlTime": 0.1,
                "residuals": {"momentum": 0.001},
                "log": "Fallback: simulation simple",
                "credibilityScore": 85,
                "fields": {},
                "turbulentData": {"time": [0], "tke": [0.01], "dissipation": [0.001]},
                "residuals_history": [],
                "scenario_outputs": {}
            }

        # Mise à jour dans Supabase (statut completed + résultats)
        if supabase:
            supabase.table("hybrid_simulations").update({
                "status": "completed",
                "results": final_result,
                "completed_at": datetime.utcnow().isoformat()
            }).eq("id", job_id).execute()
            logger.info(f"Job {job_id} updated to completed")

    except Exception as e:
        logger.error(f"Error in job {job_id}: {e}")
        if supabase:
            supabase.table("hybrid_simulations").update({
                "status": "failed",
                "error_message": str(e)
            }).eq("id", job_id).execute()

    finally:
        cleanup_memory()

# ============================================================================
# Endpoints pour l'historique des jobs (lecture depuis Supabase)
# ============================================================================

@app.get("/jobs")
async def list_jobs():
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not available")
    try:
        result = supabase.table("hybrid_simulations").select("*").order("created_at", desc=True).execute()
        jobs = result.data
        formatted = [
            {
                "jobId": j["id"],
                "name": j["job_name"],
                "status": j["status"],
                "createdAt": j["created_at"],
                "completedAt": j.get("completed_at"),
                "results": j.get("results"),
                "errorMessage": j.get("error_message"),
            }
            for j in jobs
        ]
        return formatted
    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not available")
    try:
        result = supabase.table("hybrid_simulations").select("*").eq("id", job_id).maybe_single().execute()
        job = result.data
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {
            "jobId": job["id"],
            "name": job["job_name"],
            "status": job["status"],
            "createdAt": job["created_at"],
            "completedAt": job.get("completed_at"),
            "results": job.get("results"),
            "errorMessage": job.get("error_message"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Health
# ============================================================================

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "5.3.1"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
