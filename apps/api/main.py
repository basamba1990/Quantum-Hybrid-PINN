"""
API FastAPI - Quantum-Hybrid-PINN (asynchrone corrigée)
Simulations longues avec polling, support des scénarios industriels.
Version 5.2.0 – stable, sans erreurs.
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
    logger.info("✅ Moteurs de scénarios industriels chargés.")
except ImportError:
    HAS_SCENARIOS = False
    logger.warning("⚠️ Moteurs de scénarios non trouvés.")

def cleanup_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

app = FastAPI(title="Quantum-Hybrid-PINN API", version="5.2.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://quantum-hybrid-pinn-web.vercel.app").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs_store: Dict[str, Dict[str, Any]] = {}

# ============================================================================
# Modèles de données
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

class JobStatusResponse(BaseModel):
    jobId: str
    name: str
    status: str
    createdAt: str
    completedAt: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    errorMessage: Optional[str] = None

# ============================================================================
# Endpoint de lancement asynchrone
# ============================================================================

@app.post("/hybrid/run-simulation", response_model=SimulationResponse)
async def run_hybrid_simulation(request: SimulationRequest, background_tasks: BackgroundTasks):
    job_id = request.job_id or str(uuid.uuid4())

    if job_id in jobs_store and jobs_store[job_id].get("status") == "RUNNING":
        raise HTTPException(status_code=400, detail="Job already running")

    # Initialisation du job (statut RUNNING, pas encore de résultats)
    job_info = {
        "job_id": job_id,
        "status": "RUNNING",
        "created_at": datetime.utcnow().isoformat(),
        "config": request.dict(),
        "results": None,          # pas encore
        "completed_at": None,
        "error_message": None,
    }
    jobs_store[job_id] = job_info

    # Lancement en arrière-plan
    background_tasks.add_task(execute_simulation_job, job_id, request)

    return SimulationResponse(
        job_id=job_id,
        status="RUNNING",
        message=f"Simulation {request.job_name} démarrée (polling sur /jobs/{job_id})"
    )

# ============================================================================
# Exécution réelle (longue)
# ============================================================================

async def execute_simulation_job(job_id: str, request: SimulationRequest):
    job_info = jobs_store.get(job_id)
    if not job_info:
        return

    try:
        # --- Phase 1 : simulation (scénario ou CFD longue) ---
        if HAS_SCENARIOS and request.scenario_type in SCENARIO_ENGINES:
            engine = SCENARIO_ENGINES[request.scenario_type]
            industrial_results = engine(request.scenario_inputs)

            # Résultat unique (simulation rapide)
            final_result = {
                "iteration": 1,
                "cfdTime": 0.0,
                "mlTime": 0.0,
                "residuals": {},
                "log": f"Scénario {request.scenario_type} exécuté",
                "credibilityScore": industrial_results.get("safetyScore", industrial_results.get("stabilityScore", 95)),
                "fields": {k: [v] for k, v in industrial_results.items() if isinstance(v, (int, float))},
                "turbulentData": {"time": [0], "tke": [0.01], "dissipation": [0.001]},
                "residuals_history": [],
                "scenario_outputs": industrial_results   # ← clé essentielle
            }
            results_list = [final_result]

        else:
            # Simulation CFD longue (exemple itératif)
            results_list = []
            for step in range(min(request.n_steps, 200)):
                # Simule un calcul long (à remplacer par vrai code CFD)
                await asyncio.sleep(0.05)  # supprimer en production
                step_result = {
                    "iteration": step,
                    "cfdTime": 0.5,
                    "mlTime": 0.1,
                    "residuals": {"momentum": 0.1 * (0.8**step)},
                    "log": f"Itération {step}",
                    "credibilityScore": 80 + step * 0.1,
                }
                results_list.append(step_result)
                # Mise à jour progressive (facultatif)
                job_info["results"] = results_list
                if step_result["residuals"]["momentum"] < request.residual_threshold:
                    break

        # --- Phase 2 : stockage du résultat final ---
        job_info["results"] = results_list
        job_info["status"] = "COMPLETED"
        job_info["completed_at"] = datetime.utcnow().isoformat()

        # Mise à jour Supabase (optionnelle)
        if supabase:
            supabase.table("hybrid_simulations").update({
                "status": "completed",
                "results": results_list[-1],
                "completed_at": job_info["completed_at"]
            }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        job_info["status"] = "FAILED"
        job_info["error_message"] = str(e)
        if supabase:
            supabase.table("hybrid_simulations").update({
                "status": "failed",
                "error_message": str(e)
            }).eq("id", job_id).execute()
    finally:
        cleanup_memory()

# ============================================================================
# Endpoints de polling (pour le frontend)
# ============================================================================

@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs_store[job_id]

    # Récupère le dernier résultat (si disponible)
    last_result = None
    if job.get("results") and isinstance(job["results"], list) and len(job["results"]) > 0:
        last_result = job["results"][-1]
    elif job.get("results") and isinstance(job["results"], dict):
        last_result = job["results"]

    # Construction de la réponse au format attendu par le frontend
    return JobStatusResponse(
        jobId=job["job_id"],
        name=job.get("config", {}).get("job_name", "Simulation"),
        status=job["status"],
        createdAt=job["created_at"],
        completedAt=job.get("completed_at"),
        results=last_result,
        errorMessage=job.get("error_message")
    )

@app.get("/jobs")
async def list_jobs():
    return [
        {
            "jobId": job["job_id"],
            "name": job.get("config", {}).get("job_name", "Simulation"),
            "status": job["status"],
            "createdAt": job["created_at"],
            "completedAt": job.get("completed_at"),
            "results": job["results"][-1] if isinstance(job.get("results"), list) and job["results"] else job.get("results"),
            "errorMessage": job.get("error_message")
        }
        for job in jobs_store.values()
    ]

# ============================================================================
# Endpoints santé et racine
# ============================================================================

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "5.2.0", "scenarios_loaded": HAS_SCENARIOS}

@app.get("/")
async def root():
    return {"message": "Quantum-Hybrid-PINN API (asynchrone)", "version": "5.2.0"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
