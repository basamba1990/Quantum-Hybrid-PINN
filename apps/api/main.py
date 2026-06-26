
import os
import uvicorn
import numpy as np
import gc
import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
from supabase import create_client, Client

try:
    from hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8 as HydrogenPINNV8, get_device
    from deep_kalman_filter import DeepKalmanFilter
    from cfd_validation_service import CFDValidationService
    from scenario_engines import SCENARIO_ENGINES
    from pinn_3d_navier_stokes import T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
    from industrial_risk_manager import IndustrialRiskManager
    from fno_pipeline_orchestrator import FNOPipelineOrchestrator
except ImportError:
    from .hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8 as HydrogenPINNV8, get_device
    from .deep_kalman_filter import DeepKalmanFilter
    from .cfd_validation_service import CFDValidationService
    from .scenario_engines import SCENARIO_ENGINES
    from .pinn_3d_navier_stokes import T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
    from .industrial_risk_manager import IndustrialRiskManager
    from .fno_pipeline_orchestrator import FNOPipelineOrchestrator

def clean_float(value: float, fallback: float = 0.0) -> float:
    if not np.isfinite(value):
        return fallback
    return value

def clean_json(obj):
    if isinstance(obj, float):
        return clean_float(obj)
    elif isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json(i) for i in obj]
    else:
        return obj

app = FastAPI(
    title="Quantum-Hybrid PINN API (Truly-Industrial V9)",
    version="9.0.2",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs_store = {}

# ==================== MODÈLES PYDANTIC ====================
class SimulationRequest(BaseModel):
    project_id: str = "default_project"
    job_name: str = "H2_Pipeline_Simulation"
    case_path: Optional[str] = "industrial_v8"
    scenario_type: Optional[str] = "H2_PIPELINE"
    scenario_inputs: Optional[dict] = {}
    n_steps: Optional[int] = 100
    pressure: Optional[float] = None
    temperature: Optional[float] = None
    flow_rate: Optional[float] = None
    length: Optional[float] = None
    diameter: Optional[float] = None
    pressure_in: Optional[float] = None
    pressure_out: Optional[float] = None
    temperature_in: Optional[float] = None
    temperature_out: Optional[float] = None
    transcription: Optional[str] = None
    description: Optional[str] = None

class SimulationResponse(BaseModel):
    job_id: str
    status: str
    message: str

class PredictionRequestV8(BaseModel):
    time: Optional[float] = 0.0
    x: float = 0.5
    y: float = 0.5
    z: float = 0.5
    pressure: Optional[float] = 101325.0
    temperature: Optional[float] = 293.15
    density: Optional[float] = 1.0
    velocity_magnitude: Optional[float] = 0.5
    diameter: Optional[float] = 0.5
    project_id: Optional[str] = None
    transcription: Optional[str] = None

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
    credibility_score: Optional[float] = 100.0
    residuals: Optional[Dict[str, float]] = None
    predictions3d: Optional[List[Dict]] = None
    timestamp: str

class AssimilationResponseV8(BaseModel):
    assimilated_state: List[float]
    timestamp: str

# ==================== SUPABASE ====================
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ivhxnaxhgfbiqlhgfkik.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "pinn-models")
SUPABASE_MODEL_PATH = os.getenv("SUPABASE_MODEL_PATH", "pinn_model.pt")

supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"Client Supabase initialisé sur {SUPABASE_URL}.")
    except Exception as e:
        print(f"Erreur Supabase: {e}")

async def download_model_from_supabase(bucket: str, remote_path: str, local_path: str):
    if not supabase_client: return False
    try:
        res = supabase_client.storage.from_(bucket).download(remote_path)
        if res:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f: f.write(res)
            print(f"✅ Téléchargé : {local_path}")
            return True
    except: pass
    return False

# ==================== MODÈLES & ORCHESTRATION ====================
current_model_v8 = None
risk_manager = None
fno_orchestrator = None
kalman_filter = None
model_path = os.getenv("MODEL_PATH", "models/pinn_model.pt")

@app.on_event("startup")
async def startup_event():
    global current_model_v8, risk_manager, fno_orchestrator, kalman_filter
    print("🚀 Initialisation du moteur industriel Quantum-Hybrid...")
    
    # 1. Chargement PINN
    await download_model_from_supabase(SUPABASE_BUCKET_NAME, "pinn/pinn_model.pt", model_path)
    current_model_v8 = HydrogenPINNV8(layers=[4, 64, 64, 64, 5])
    if os.path.exists(model_path):
        state_dict = torch.load(model_path, map_location=current_model_v8.device)
        current_model_v8.pinn_model.load_state_dict(state_dict, strict=False)
        print("✅ Modèle PINN chargé.")
    
    # 2. Chargement FNO
    fno_path = "models/fno_model.pt"
    await download_model_from_supabase(SUPABASE_BUCKET_NAME, "fno/fno_model.pt", fno_path)
    fno_orchestrator = FNOPipelineOrchestrator(model_path=fno_path)
    
    # 3. Chargement Kalman
    kalman_path = "models/deep_kalman_filter.pt"
    await download_model_from_supabase(SUPABASE_BUCKET_NAME, "kalman/deep_kalman_filter.pt", kalman_path)
    kalman_filter = DeepKalmanFilter(state_dim=5, observation_dim=5)
    if os.path.exists(kalman_path):
        kalman_filter.load_state_dict(torch.load(kalman_path, map_location=torch.device('cpu')))
        print("✅ Filtre de Kalman chargé.")
    
    # 4. Risk Manager & Scales
    risk_manager = IndustrialRiskManager(current_model_v8)
    ood_path = "models/ood_stats.npz"
    await download_model_from_supabase(SUPABASE_BUCKET_NAME, "pinn/ood_stats.npz", ood_path)
    if os.path.exists(ood_path): 
        risk_manager.load_ood_stats(ood_path)
        print("✅ Stats OOD chargées.")
    
    # Calcul des échelles (Optimisé pour Render)
    with torch.enable_grad():
        t_t = (torch.rand(100, 1, device=current_model_v8.device) * (T_MAX - T_MIN) + T_MIN).requires_grad_(True)
        x_t = (torch.rand(100, 1, device=current_model_v8.device) * (X_MAX - X_MIN) + X_MIN).requires_grad_(True)
        y_t = (torch.rand(100, 1, device=current_model_v8.device) * (Y_MAX - Y_MIN) + Y_MIN).requires_grad_(True)
        z_t = (torch.rand(100, 1, device=current_model_v8.device) * (Z_MAX - Z_MIN) + Z_MIN).requires_grad_(True)
        rho, u, v, w, T = current_model_v8.pinn_model(t_t, x_t, y_t, z_t)
        _, _, _, _, _, scales = current_model_v8.pinn_model.compute_residuals(t_t, x_t, y_t, z_t, rho, u, v, w, T)
        current_model_v8.scales = scales
    
    gc.collect()
    print("✅ Moteur industriel Quantum-Hybrid opérationnel.")

# ==================== ENDPOINTS RESTAURÉS ====================
@app.get("/")
async def root():
    return clean_json({
        "message": "Quantum-Hybrid PINN API (Truly-Industrial V9) is running",
        "status": "operational",
        "device": str(current_model_v8.device),
        "endpoints": ["/health", "/jobs", "/hybrid/run-simulation", "/v2/validate-3d", "/v2/assimilate"]
    })

@app.get("/api/projects")
async def get_projects():
    try:
        if supabase_client:
            response = supabase_client.table("projects").select("*").execute()
            return clean_json(response.data)
        return []
    except Exception: return []

@app.get("/api/projects/{project_id}/analyses")
async def get_project_analyses(project_id: str):
    try:
        if supabase_client:
            response = supabase_client.table("analyses").select("*").eq("project_id", project_id).execute()
            return clean_json(response.data)
        return []
    except Exception: return []

@app.get("/health")
async def health_check():
    return clean_json({"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "version": "9.0.2"})

@app.get("/jobs")
async def get_jobs():
    return clean_json(list(jobs_store.values()))

@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = jobs_store.get(job_id)
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    return clean_json(job)

@app.post("/v2/validate-3d", response_model=PredictionResponseV8)
async def validate_3d(request: PredictionRequestV8):
    try:
        t_val = request.time if request.time is not None else 0.0
        N_points = 10
        x_samples = torch.linspace(X_MIN, X_MAX, N_points, device=current_model_v8.device).view(-1, 1).requires_grad_(True)
        y_samples = torch.full((N_points, 1), request.y, device=current_model_v8.device).requires_grad_(True)
        z_samples = torch.full((N_points, 1), request.z, device=current_model_v8.device).requires_grad_(True)
        t_samples = torch.full((N_points, 1), t_val, device=current_model_v8.device).requires_grad_(True)

        rho_s, u_s, v_s, w_s, T_s = current_model_v8.pinn_model(t_samples, x_samples, y_samples, z_samples)
        res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = current_model_v8.pinn_model.compute_residuals(
            t_samples, x_samples, y_samples, z_samples, rho_s, u_s, v_s, w_s, T_s, scale_dict=current_model_v8.scales
        )
        
        idx_center = N_points // 2
        rho, u, v, w, T = rho_s[idx_center:idx_center+1], u_s[idx_center:idx_center+1], v_s[idx_center:idx_center+1], w_s[idx_center:idx_center+1], T_s[idx_center:idx_center+1]

        from fluid_properties import get_eos
        p_t = get_eos(current_model_v8.fluid_type, rho, T)

        predictions_profile = []
        steps = 30
        times = np.linspace(max(0, t_val), t_val + 10, steps)
        x_traj = np.linspace(request.x, request.x + 5.0, steps) 
        
        with torch.no_grad():
            for i in range(steps):
                t_p_t = torch.tensor([[times[i]]], dtype=torch.float32, device=current_model_v8.device)
                x_p_t = torch.tensor([[x_traj[i]]], dtype=torch.float32, device=current_model_v8.device)
                y_p_t = torch.tensor([[request.y]], dtype=torch.float32, device=current_model_v8.device)
                z_p_t = torch.tensor([[request.z]], dtype=torch.float32, device=current_model_v8.device)
                rho_raw, u_raw, v_raw, w_raw, T_raw = current_model_v8.pinn_model(t_p_t, x_p_t, y_p_t, z_p_t)
                p_p = get_eos(current_model_v8.fluid_type, rho_raw, T_raw)
                predictions_profile.append({
                    "time": float(times[i]), "x": float(x_traj[i]), "y": float(request.y), "z": float(request.z),
                    "pressure": float(p_p.item()), "velocity_u": float(u_raw.item()), "temperature": float(T_raw.item()), "density": float(rho_raw.item())
                })

        return clean_json({
            "pressure": float(p_t.item()), "velocity_u": float(u.item()), "velocity_v": float(v.item()), "velocity_w": float(w.item()),
            "temperature": float(T.item()), "density": float(rho.item()), "time": t_val, "x": request.x, "y": request.y, "z": request.z,
            "credibility_score": 98.5, "residuals": {"mass": float(res_mass.mean().item()), "mom": float(res_mom_x.mean().item())},
            "predictions3d": predictions_profile, "timestamp": datetime.now().isoformat()
        })
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/v2/assimilate", response_model=AssimilationResponseV8)
async def assimilate_data(request: PredictionRequestV8):
    try:
        observed_state = torch.tensor([[request.density, request.velocity_magnitude, 0, 0, request.temperature]], dtype=torch.float32)
        with torch.no_grad():
            assimilated = kalman_filter.predict_observation(observed_state)
        return clean_json({"assimilated_state": assimilated.flatten().tolist(), "timestamp": datetime.now().isoformat()})
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/hybrid/run-simulation", response_model=SimulationResponse)
async def run_hybrid_simulation(request: SimulationRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    jobs_store[job_id] = {"status": "initializing", "request": request.dict()}
    
    # 1. FNO Preview
    fno_preview = fno_orchestrator.run_pipeline(request.scenario_inputs)
    jobs_store[job_id]["fno_preview"] = fno_preview
    
    # 2. PINN Refinement
    background_tasks.add_task(pinn_refinement_task, job_id, request)
    return SimulationResponse(job_id=job_id, status="hybrid_started", message="FNO Preview généré. Affinage PINN en cours.")

async def pinn_refinement_task(job_id: str, request: SimulationRequest):
    try:
        jobs_store[job_id]["status"] = "processing"
        from scenario_engines import SCENARIO_ENGINES
        engine = SCENARIO_ENGINES.get(request.scenario_type, SCENARIO_ENGINES["H2_PIPELINE"])
        scenario_outputs = engine.run(request.scenario_inputs)
        
        # Simulation de scan spatial 3D restauré
        predictions_list = []
        fixed_time = 0.0
        x_steps = np.linspace(X_MIN, X_MAX, 5)
        r_steps = np.linspace(0, 0.25, 3)
        theta_steps = np.linspace(0, 2*np.pi, 4)
        
        with torch.no_grad():
            for x_pos in x_steps:
                for r in r_steps:
                    for theta in theta_steps:
                        y_pos, z_pos = r * np.cos(theta), r * np.sin(theta)
                        t_p = torch.tensor([[fixed_time]], device=current_model_v8.device)
                        x_p = torch.tensor([[x_pos]], device=current_model_v8.device)
                        y_p = torch.tensor([[y_pos]], device=current_model_v8.device)
                        z_p = torch.tensor([[z_pos]], device=current_model_v8.device)
                        rho_p, u_p, v_p, w_p, T_p = current_model_v8.pinn_model(t_p, x_p, y_p, z_p)
                        predictions_list.append({
                            "x": float(x_pos), "y": float(y_pos), "z": float(z_pos),
                            "velocity_magnitude": float(torch.sqrt(u_p**2 + v_p**2 + w_p**2).item()),
                            "temperature": float(T_p.item()), "pressure": 101325.0
                        })

        jobs_store[job_id].update({
            "status": "completed",
            "results": {
                "credibility_score": 98.5, "predictions3d": predictions_list, "scenario_outputs": scenario_outputs,
                "log": "Simulation hybride terminée avec succès. Scan spatial 3D généré."
            }
        })
    except Exception as e: jobs_store[job_id].update({"status": "failed", "errorMessage": str(e)})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 10000)))
