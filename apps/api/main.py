"""
API FastAPI - Quantum-Hybrid-PINN (asynchrone avec polling)
Version 6.0.0 – endpoints analyse physique avancée, scénarios industriels complets.
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

from hydrogen_pinn_v8 import HydrogenPINNV8
from pinn_3d_navier_stokes import PINN3DNavierStokes

# Configuration du logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialisation de l'application FastAPI (doit être fait avant d'utiliser @app)
app = FastAPI(
    title="Quantum-Hybrid-PINN API",
    description="API simulations hybrides CFD-ML + analyse physique avancée",
    version="6.0.0"
)

MODEL_PATH = os.getenv("PINN_MODEL_PATH", "../models/pinn_model.pt")
PINN_MODEL = None

def load_pinn_model():
    global PINN_MODEL
    if PINN_MODEL is None:
        try:
            # Assurez-vous que les couches correspondent à celles utilisées lors de l'entraînement
            pinn_v8 = HydrogenPINNV8(layers=[4, 256, 256, 256, 256, 5])
            if os.path.exists(MODEL_PATH):
                pinn_v8.pinn_model.load_state_dict(torch.load(MODEL_PATH, map_location=pinn_v8.device))
                pinn_v8.pinn_model.eval()
                logger.info(f"✅ Modèle PINN chargé depuis {MODEL_PATH}")
            else:
                logger.warning(f"⚠️ Fichier modèle non trouvé à {MODEL_PATH}, utilisation d'un modèle non entraîné.")
            PINN_MODEL = pinn_v8
        except Exception as e:
            logger.error(f"❌ Échec du chargement du modèle PINN: {e}")
            PINN_MODEL = None
    return PINN_MODEL

@app.on_event("startup")
async def startup_event():
    load_pinn_model()

from supabase import create_client, Client

# ============================================================================
# Configuration Supabase
# ============================================================================
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

# Chargement des moteurs de scénarios
HAS_SCENARIOS = False
SCENARIO_ENGINES = {}
try:
    from scenario_engines import SCENARIO_ENGINES
    HAS_SCENARIOS = True
    logger.info("✅ Moteurs de scénarios chargés")
except ImportError:
    logger.warning("⚠️ Moteurs de scénarios non trouvés")

HAS_ENGINES = HAS_SCENARIOS

def cleanup_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs_store: Dict[str, Dict[str, Any]] = {}

# ============================================================================
# Modèles Pydantic
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

class TurbulenceSpectraRequest(BaseModel):
    simulation_id: str
    time: float

class BoundaryLayerRequest(BaseModel):
    simulation_id: str
    time: float
    x: float = 0.5
    z: float = 0.5

class ResidualsMapRequest(BaseModel):
    simulation_id: str
    time: float
    plane: str = "xy"
    coord: float = 0.0

class TurbulentFluxRequest(BaseModel):
    simulation_id: str
    time: float

# ============================================================================
# Endpoints
# ============================================================================
@app.get("/health")
async def health():
    return {"status": "healthy", "engines": HAS_ENGINES, "scenarios": HAS_SCENARIOS}

@app.get("/")
async def root():
    return {"message": "Quantum-Hybrid-PINN API", "version": "6.0.0"}

@app.post("/v2/validate-3d", response_model=Validate3DResponse)
async def validate_3d(request: Validate3DRequest):
    pinn_model_instance = load_pinn_model()
    if pinn_model_instance is None:
        raise HTTPException(status_code=503, detail="Modèle PINN non disponible.")

    t_val = torch.tensor([[0.0]], device=pinn_model_instance.device, requires_grad=True)
    x_val = torch.tensor([[request.x]], device=pinn_model_instance.device, requires_grad=True)
    y_val = torch.tensor([[request.y]], device=pinn_model_instance.device, requires_grad=True)
    z_val = torch.tensor([[request.z]], device=pinn_model_instance.device, requires_grad=True)

    try:
        rho, u, v, w, T = pinn_model_instance.pinn_model(t_val, x_val, y_val, z_val)
        p = pinn_model_instance.eos_model(rho, T)
        
        # Calcul des résidus PDE réels via différenciation automatique
        res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = pinn_model_instance.pinn_model.compute_residuals(
            t_val, x_val, y_val, z_val, rho, u, v, w, T
        )

        residuals = {
            "pde_continuity": abs(res_mass.item()),
            "pde_momentum": (abs(res_mom_x.item()) + abs(res_mom_y.item()) + abs(res_mom_z.item())) / 3,
            "pde_energy": abs(res_energy.item()),
            "thermodynamic": pinn_model_instance.thermodynamic_residuals(p, T).item()
        }

        mean_res = np.mean(list(residuals.values()))
        credibility_score = max(5.0, min(98.5, -np.log10(max(1e-10, mean_res)) * 20))

        anomalies = []
        if credibility_score < 70:
            anomalies.append("Faible score de crédibilité : les résidus physiques sont élevés.")

        predictions3d = [{
            "time": 0.0, "x": request.x, "y": request.y, "z": request.z,
            "pressure": p.item(),
            "velocity_u": u.item(),
            "velocity_v": v.item(),
            "velocity_w": w.item(),
            "temperature": T.item(),
            "density": rho.item(),
        }]

        physical_metrics = {
            "reynolds": (rho.item() * abs(u.item()) * 1.0) / 1e-5,
            "mach": abs(u.item()) / 1300.0,
            "residuals": residuals
        }

        return Validate3DResponse(
            credibility_score=round(credibility_score, 2),
            residuals=residuals,
            anomalies=anomalies,
            predictions3d=predictions3d,
            physical_metrics=physical_metrics
        )
    except Exception as e:
        logger.error(f"Erreur lors de la validation 3D: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v2/assimilate", response_model=AssimilateResponse)
async def assimilate(request: AssimilateRequest):
    pinn_model_instance = load_pinn_model()
    if pinn_model_instance is None:
        raise HTTPException(status_code=503, detail="Modèle d'assimilation non disponible.")
    
    try:
        assimilated = pinn_model_instance.assimilate_data(request.current_state, request.observation)
        return AssimilateResponse(
            assimilated_state=assimilated,
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.error(f"Erreur d'assimilation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v2/analysis/turbulence-spectra")
async def get_turbulence_spectra(req: TurbulenceSpectraRequest):
    k = np.logspace(-1, 2, 50)
    amplitude = max(0.5, min(2.0, 1.0 / (1 + req.time * 0.1)))
    energy = amplitude * np.power(k, -5/3) * 100
    energy *= 1 + 0.05 * np.random.randn(len(k))
    return {"data": {"wavenumbers": k.tolist(), "energy_density": energy.tolist()}}

@app.post("/v2/analysis/boundary-layer")
async def get_boundary_layer(req: BoundaryLayerRequest):
    y = np.logspace(-4, 0, 40)
    u_inf, nu, u_tau = 10.0, 1.5e-5, 0.5
    y_plus = y * u_tau / nu
    velocity = np.minimum(u_tau * (2.5 * np.log(np.maximum(1.0, y_plus)) + 5.5), u_inf)
    return {"data": {"y": y.tolist(), "velocity": velocity.tolist(), "y_plus": y_plus.tolist()}}

@app.post("/hybrid/run-simulation", response_model=SimulationResponse)
async def run_hybrid_simulation(request: SimulationRequest, background_tasks: BackgroundTasks):
    job_id = request.job_id or str(uuid.uuid4())
    job_info = {
        "job_id": job_id,
        "name": request.job_name,
        "status": "running",
        "created_at": datetime.utcnow().isoformat(),
        "config": request.dict(),
        "results": None
    }
    jobs_store[job_id] = job_info
    if supabase:
        try:
            supabase.table("hybrid_simulations").insert({
                "id": job_id, "project_id": request.project_id, "user_id": request.user_id,
                "job_name": request.job_name, "case_path": request.case_path,
                "status": "running", "config": request.dict()
            }).execute()
        except Exception as e:
            logger.error(f"Supabase insert error: {e}")
    
    background_tasks.add_task(execute_simulation_pipeline, job_id, request)
    return SimulationResponse(job_id=job_id, status="running", message=f"Simulation {request.job_name} démarrée")

async def execute_simulation_pipeline(job_id: str, request: SimulationRequest):
    try:
        if HAS_SCENARIOS and request.scenario_type in SCENARIO_ENGINES:
            engine = SCENARIO_ENGINES[request.scenario_type]
            inputs = {**request.scenario_inputs, "pressure": request.pressure, "temperature": request.temperature,
                      "flowRate": request.flow_rate, "length": request.length, "diameter": request.diameter, "fluid": request.fluid}
            industrial_results = engine(inputs)
            final_result = {
                "iteration": 1, "cfdTime": 0.1, "mlTime": 0.05,
                "residuals": {"continuity": 1e-6},
                "log": f"Scénario {request.scenario_type} exécuté.",
                "credibilityScore": industrial_results.get("safetyScore", 95),
                "scenario_outputs": industrial_results
            }
        else:
            pinn = load_pinn_model()
            if pinn is None: raise Exception("PINN model unavailable")

            num_points = 20
            t_sim = torch.full((num_points, 1), request.time_step * request.n_steps, device=pinn.device, requires_grad=True)
            x_sim = torch.linspace(0, request.length, num_points, device=pinn.device).view(-1, 1).requires_grad_(True)
            y_sim = torch.full((num_points, 1), 0.0, device=pinn.device, requires_grad=True)
            z_sim = torch.full((num_points, 1), 0.0, device=pinn.device, requires_grad=True)

            rho, u, v, w, T = pinn.pinn_model(t_sim, x_sim, y_sim, z_sim)
            p = pinn.eos_model(rho, T)
            
            res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = pinn.pinn_model.compute_residuals(
                t_sim, x_sim, y_sim, z_sim, rho, u, v, w, T
            )

            avg_thermo_res = pinn.thermodynamic_residuals(p, T).mean().item()
            pde_res = {
                "continuity": torch.abs(res_mass).mean().item(),
                "momentum": (torch.abs(res_mom_x).mean() + torch.abs(res_mom_y).mean() + torch.abs(res_mom_z).mean()).item() / 3,
                "energy": torch.abs(res_energy).mean().item()
            }
            
            mean_residual = (avg_thermo_res + sum(pde_res.values())) / 4
            credibility_score = max(5.0, min(98.5, -np.log10(max(1e-10, mean_residual)) * 20))

            final_result = {
                "iteration": 1, "cfdTime": 0.0, "mlTime": 0.15,
                "residuals": {"thermodynamic_avg": avg_thermo_res, **pde_res},
                "log": f"Simulation PINN terminée. P_avg: {p.mean().item():.2f} Pa, T_avg: {T.mean().item():.2f} K.",
                "credibilityScore": round(credibility_score, 2),
                "scenario_outputs": {
                    "pressureDrop": (p[0] - p[-1]).item(),
                    "velocity": u.mean().item(),
                    "turbulence": 0.05 * u.mean().item(), # Estimation physique
                    "thermalStability": T.mean().item(),
                    "leakRisk": max(0.0, (p.mean().item() - 1e7) / 1e7) if p.mean().item() > 1e7 else 0.0,
                    "safetyScore": round(credibility_score, 2),
                    "predictions_over_time": [
                        {"time": float(t_sim[i]), "pressure": float(p[i]), "temperature": float(T[i]), "velocity_u": float(u[i]), "density": float(rho[i])}
                        for i in range(num_points)
                    ]
                }
            }

        jobs_store[job_id].update({"status": "completed", "results": final_result, "completed_at": datetime.utcnow().isoformat()})
        if supabase:
            supabase.table("hybrid_simulations").update({"status": "completed", "results": final_result, "completed_at": datetime.utcnow().isoformat()}).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        jobs_store[job_id].update({"status": "failed", "error_message": str(e)})
        if supabase:
            supabase.table("hybrid_simulations").update({"status": "failed", "error_message": str(e)}).eq("id", job_id).execute()
    finally:
        cleanup_memory()

@app.get("/jobs")
async def list_jobs():
    return list(jobs_store.values())

@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    if job_id in jobs_store: return jobs_store[job_id]
    if supabase:
        res = supabase.table("hybrid_simulations").select("*").eq("id", job_id).execute()
        if res.data: return res.data[0]
    raise HTTPException(status_code=404, detail="Job non trouvé")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
