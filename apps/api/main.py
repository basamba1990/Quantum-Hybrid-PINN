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
    from fluid_properties import get_eos
    from industrial_risk_manager import IndustrialRiskManager
    from analysis_processor import router as analysis_router, init_processor
    from pgd_pinn_api import router as pgd_pinn_router
except ImportError:
    from .hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8 as HydrogenPINNV8, get_device
    from .deep_kalman_filter import DeepKalmanFilter
    from .cfd_validation_service import CFDValidationService
    from .scenario_engines import SCENARIO_ENGINES
    from .pinn_3d_navier_stokes import T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
    from .fluid_properties import get_eos
    from .industrial_risk_manager import IndustrialRiskManager
    from .analysis_processor import router as analysis_router, init_processor

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
    title="Quantum-Hybrid PINN API (V8)",
    version="8.0.10",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs_store = {}

# Include analysis processor router
try:
    app.include_router(analysis_router)
    app.include_router(pgd_pinn_router)
    supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
    if supabase_url and supabase_key:
        init_processor(supabase_url, supabase_key)
        print('Analysis processor initialized')
except Exception as e:
    print(f'Analysis processor initialization warning: {e}')

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
    analysis_id: Optional[str] = None # Link to Supabase analysis record

class SimulationResponse(BaseModel):
    job_id: str
    status: str
    message: str

class PredictionRequestV8(BaseModel):
    time: Optional[float] = 0.0
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    pressure: Optional[float] = 101325.0
    temperature: Optional[float] = 293.15
    density: Optional[float] = 1.0
    velocity_u: Optional[float] = 0.0
    velocity_v: Optional[float] = 0.0
    velocity_w: Optional[float] = 0.0
    velocity_magnitude: Optional[float] = 0.5
    diameter: Optional[float] = 0.5
    project_id: Optional[str] = None
    transcription: Optional[str] = None
    scenario_type: Optional[str] = "H2_PIPELINE"

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
    uncertainty_score: Optional[float] = 0.0
    residuals: Optional[Dict[str, float]] = None
    predictions3d: Optional[List[Dict]] = None
    scenario_outputs: Optional[Dict] = None
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

async def download_file_from_supabase(remote_path: str, local_path: str):
    if not supabase_client:
        return False
    try:
        res = supabase_client.storage.from_(SUPABASE_BUCKET_NAME).download(remote_path)
        if res:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(res)
            print(f"Fichier téléchargé: {local_path} depuis {remote_path}")
            return True
    except Exception as e:
        print(f"Erreur téléchargement {remote_path}: {e}")
    return False

async def download_model_from_supabase(model_local_path: str):
    return await download_file_from_supabase(SUPABASE_MODEL_PATH, model_local_path)

current_model_v8 = None
risk_manager = None
fno_orchestrator = None
kalman_filter = None
model_path = os.getenv("MODEL_PATH", "models/pinn_model.pt")

@app.on_event("startup")
async def load_pinn_model():
    global current_model_v8, risk_manager, fno_orchestrator, kalman_filter
    print("Chargement des orchestrateurs industriels...")
    
    try:
        from fno_pipeline_orchestrator import FNOPipelineOrchestrator
        fno_model_path = "models/fno_model.pt"
        await download_file_from_supabase("fno_model.pt", fno_model_path)
        fno_orchestrator = FNOPipelineOrchestrator(model_path=fno_model_path)
        print("✅ FNO Orchestrator initialisé.")
    except Exception as e:
        print(f"⚠️ Erreur initialisation FNO: {e}")
    
    try:
        kalman_filter = DeepKalmanFilter(state_dim=5, observation_dim=3)
        print("✅ Filtre de Kalman initialisé.")
    except Exception as e:
        print(f"⚠️ Erreur initialisation Kalman: {e}")

    print("Chargement modèle PINN...")
    try:
        downloaded = await download_model_from_supabase(model_path)
        if downloaded and os.path.exists(model_path):
            current_model_v8 = HydrogenPINNV8(layers=[4, 128, 128, 128, 5], geometry_type="pipeline")
            state_dict = torch.load(model_path, map_location=current_model_v8.device)
            current_model_v8.pinn_model.load_state_dict(state_dict, strict=False)
            print("Modèle chargé depuis Supabase (strict=False).")
        elif os.path.exists(model_path):
            current_model_v8 = HydrogenPINNV8(layers=[4, 128, 128, 128, 5], geometry_type="pipeline")
            state_dict = torch.load(model_path, map_location=current_model_v8.device)
            current_model_v8.pinn_model.load_state_dict(state_dict, strict=False)
            print("Modèle chargé localement (strict=False).")
        else:
            current_model_v8 = HydrogenPINNV8()
            print("Modèle initialisé par défaut (poids aléatoires).")
    except Exception as e:
        print(f"Erreur: {e}, utilisation modèle par défaut.")
        current_model_v8 = HydrogenPINNV8()

    print("Calcul des échelles de normalisation...")
    device = current_model_v8.device
    N_samples = 200
    with torch.enable_grad():
        t_temp = (torch.rand(N_samples, 1, device=device) * (T_MAX - T_MIN) + T_MIN).requires_grad_(True)
        x_temp = (torch.rand(N_samples, 1, device=device) * (X_MAX - X_MIN) + X_MIN).requires_grad_(True)
        y_temp = (torch.rand(N_samples, 1, device=device) * (Y_MAX - Y_MIN) + Y_MIN).requires_grad_(True)
        z_temp = (torch.rand(N_samples, 1, device=device) * (Z_MAX - Z_MIN) + Z_MIN).requires_grad_(True)
        rho_t, u_t, v_t, w_t, T_t = current_model_v8.pinn_model(t_temp, x_temp, y_temp, z_temp)
        _, _, _, _, _, scales = current_model_v8.pinn_model.compute_residuals(
            t_temp, x_temp, y_temp, z_temp, rho_t, u_t, v_t, w_t, T_t, scale_dict=None
        )
        current_model_v8.scales = scales
        print(f"✅ Échelles calculées : mass={scales['mass']:.2e}, mom={scales['mom']:.2e}, energy={scales['energy']:.2e}")
        del t_temp, x_temp, y_temp, z_temp, rho_t, u_t, v_t, w_t, T_t
        gc.collect()

        risk_manager = IndustrialRiskManager(current_model_v8)
        ood_stats_path = os.path.join(os.path.dirname(model_path), "ood_stats.npz")
        await download_file_from_supabase("ood_stats.npz", ood_stats_path)
        if os.path.exists(ood_stats_path):
            risk_manager.load_ood_stats(ood_stats_path)
            print(f"✅ Statistiques OOD chargées depuis {ood_stats_path}")
        else:
            print("⚠️ Statistiques OOD non trouvées, initialisation OOD par défaut...")
            dummy_features = np.random.randn(10, 6)
            risk_manager.fit_ood(dummy_features)
            print("✅ Détecteur OOD initialisé en mode fallback.")
            
        print("✅ Industrial Risk Manager initialisé.")
    gc.collect()

analysis_service = CFDValidationService()

# ==================== ENDPOINTS ====================
@app.get("/")
async def root():
    return clean_json({
        "message": "Quantum-Hybrid PINN API (V8) is running",
        "status": "operational",
        "device": str(get_device()),
        "endpoints": ["/health", "/jobs", "/hybrid/run-simulation", "/v2/validate-3d", "/v2/assimilate"]
    })

@app.get("/api/projects")
async def get_projects():
    try:
        if supabase_client:
            response = supabase_client.table("projects").select("*").execute()
            return clean_json(response.data)
        return []
    except Exception:
        return []

@app.get("/api/projects/{project_id}/analyses")
async def get_project_analyses(project_id: str):
    try:
        if supabase_client:
            response = supabase_client.table("analyses").select("*").eq("project_id", project_id).execute()
            return clean_json(response.data)
        return []
    except Exception:
        return []

@app.get("/health")
async def health_check():
    return clean_json({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Quantum-Hybrid PINN API (V8)",
        "version": "8.0.10"
    })

@app.get("/jobs")
async def get_jobs():
    return clean_json(list(jobs_store.values()))

@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return clean_json(job)

@app.post("/v2/validate-3d", response_model=PredictionResponseV8)
async def validate_3d(request: PredictionRequestV8):
    try:
        t = request.time if request.time is not None else 0.0
        N_points = 10
        x_samples = torch.linspace(X_MIN, X_MAX, N_points, device=current_model_v8.device).view(-1, 1).requires_grad_(True)
        y_samples = torch.full((N_points, 1), request.y, device=current_model_v8.device).requires_grad_(True)
        z_samples = torch.full((N_points, 1), request.z, device=current_model_v8.device).requires_grad_(True)
        t_samples = torch.full((N_points, 1), t, device=current_model_v8.device).requires_grad_(True)

        rho_s, u_s, v_s, w_s, T_s = current_model_v8.pinn_model(t_samples, x_samples, y_samples, z_samples)
        res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = current_model_v8.pinn_model.compute_residuals(
            t_samples, x_samples, y_samples, z_samples, rho_s, u_s, v_s, w_s, T_s, scale_dict=current_model_v8.scales
        )
        
        res_mass_avg = torch.abs(res_mass).mean()
        res_mom_avg = torch.sqrt(res_mom_x**2 + res_mom_y**2 + res_mom_z**2).mean()
        res_energy_avg = torch.abs(res_energy).mean()

        idx_center = N_points // 2
        rho, u, v, w, T = rho_s[idx_center:idx_center+1], u_s[idx_center:idx_center+1], v_s[idx_center:idx_center+1], w_s[idx_center:idx_center+1], T_s[idx_center:idx_center+1]
        p_t_center = get_eos(current_model_v8.fluid_type, rho, T)

        residuals = {
            "continuity": float(res_mass_avg.item()),
            "momentum": float(res_mom_avg.item()),
            "energy": float(res_energy_avg.item())
        }
        
        weighted_res = (residuals["continuity"] / 1e-4 + residuals["momentum"] / 1e-4 + residuals["energy"] / 1e-3) / 3.0
        credibility_score = float(100.0 / (1.0 + 0.05 * weighted_res))
        credibility_score = min(100.0, max(0.0, clean_float(credibility_score, 85.0)))

        result = {
            "pressure": p_t_center.item(),
            "velocity_u": u.item(),
            "velocity_v": v.item(),
            "velocity_w": w.item(),
            "temperature": T.item(),
            "density": rho.item(),
            "time": t, "x": request.x, "y": request.y, "z": request.z
        }

        predictions_profile = []
        for i in range(N_points):
            u_raw, v_raw, w_raw, T_raw, rho_raw = u_s[i], v_s[i], w_s[i], T_s[i], rho_s[i]
            p_raw = get_eos(current_model_v8.fluid_type, rho_raw.unsqueeze(0), T_raw.unsqueeze(0))
            raw_p, raw_t = p_raw.item(), T_raw.item()
            predictions_profile.append({
                "time": float(t), "x": float(x_samples[i].item()), "y": float(request.y), "z": float(request.z),
                "pressure": clean_float(raw_p), "velocity_u": clean_float(u_raw.item()),
                "velocity_v": clean_float(v_raw.item()), "velocity_w": clean_float(w_raw.item()),
                "temperature": clean_float(raw_t), "density": clean_float(rho_raw.item()),
                "velocity_magnitude": clean_float(torch.sqrt(u_raw**2 + v_raw**2 + w_raw**2).item())
            })

        return PredictionResponseV8(
            pressure=clean_float(result["pressure"]),
            velocity_u=clean_float(result["velocity_u"]),
            velocity_v=clean_float(result["velocity_v"]),
            velocity_w=clean_float(result["velocity_w"]),
            temperature=clean_float(result["temperature"]),
            density=clean_float(result["density"]),
            time=clean_float(result["time"]),
            x=clean_float(result["x"]),
            y=clean_float(result["y"]),
            z=clean_float(result["z"]),
            credibility_score=credibility_score,
            residuals=residuals,
            predictions3d=predictions_profile,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la validation 3D: {str(e)}")

@app.post("/v2/assimilate", response_model=AssimilationResponseV8)
async def assimilate_data(request: PredictionRequestV8):
    try:
        if current_model_v8 is None or current_model_v8.pinn_model is None:
            raise HTTPException(status_code=500, detail="Modèle PINN non chargé.")
        observed_state_tensor = torch.tensor(
            [request.density, request.velocity_u, request.velocity_v, request.velocity_w, request.temperature],
            dtype=torch.float32, device=current_model_v8.device
        ).unsqueeze(0)
        if kalman_filter:
            with torch.no_grad():
                assimilated_state = kalman_filter.assimilate_batch(observed_state_tensor, observed_state_tensor)
                final_assimilated_state = assimilated_state.flatten().tolist()
        else:
            final_assimilated_state = observed_state_tensor.flatten().tolist()
        return AssimilationResponseV8(assimilated_state=final_assimilated_state, timestamp=datetime.now().isoformat())
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'assimilation des données: {str(e)}")

@app.post("/hybrid/run-simulation", response_model=SimulationResponse)
async def run_hybrid_simulation(request: SimulationRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    jobs_store[job_id] = {
        "job_id": job_id,
        "status": "initializing", 
        "request": request.dict(), 
        "results": None, 
        "fno_preview": None,
        "created_at": datetime.now().isoformat()
    }
    background_tasks.add_task(hybrid_simulation_task, job_id, request)
    return SimulationResponse(job_id=job_id, status="accepted", message="Simulation hybride lancée en arrière-plan.")

async def hybrid_simulation_task(job_id: str, request: SimulationRequest):
    jobs_store[job_id]["status"] = "running"
    try:
        req_x = (X_MIN + X_MAX) / 2.0
        req_y = (Y_MIN + Y_MAX) / 2.0
        req_z = (Z_MIN + Z_MAX) / 2.0

        jobs_store[job_id]["status"] = "running_fno"
        if fno_orchestrator:
            fno_output = fno_orchestrator.run_pipeline(request.scenario_inputs)
            jobs_store[job_id]["fno_preview"] = clean_json(fno_output)

        jobs_store[job_id]["status"] = "running_pinn_cfd"
        engine_func = SCENARIO_ENGINES.get(request.scenario_type, SCENARIO_ENGINES["H2_PIPELINE"])
        scenario_outputs = engine_func(request.scenario_inputs)

        num_steps = request.n_steps or 100
        history = []
        predictions_list = []

        for i in range(num_steps):
            simulated_time = i * 0.1
            simulated_x, simulated_y, simulated_z = req_x, req_y, req_z
            t_tensor = torch.tensor([[simulated_time]], dtype=torch.float32, device=current_model_v8.device).requires_grad_(True)
            x_tensor = torch.tensor([[simulated_x]], dtype=torch.float32, device=current_model_v8.device).requires_grad_(True)
            y_tensor = torch.tensor([[simulated_y]], dtype=torch.float32, device=current_model_v8.device).requires_grad_(True)
            z_tensor = torch.tensor([[simulated_z]], dtype=torch.float32, device=current_model_v8.device).requires_grad_(True)

            rho_pinn, u_pinn, v_pinn, w_pinn, T_pinn = current_model_v8.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
            res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = current_model_v8.pinn_model.compute_residuals(
                t_tensor, x_tensor, y_tensor, z_tensor, rho_pinn, u_pinn, v_pinn, w_pinn, T_pinn, scale_dict=current_model_v8.scales
            )
            
            residuals_dict = {
                "continuity": float(torch.abs(res_mass).item()),
                "momentum": float(torch.sqrt(res_mom_x**2 + res_mom_y**2 + res_mom_z**2).item()),
                "energy": float(torch.abs(res_energy).item())
            }
            weighted_res = (residuals_dict["continuity"] / 1e-4 + residuals_dict["momentum"] / 1e-4 + residuals_dict["energy"] / 1e-3) / 3.0
            credibility_score_pinn = float(100.0 / (1.0 + 0.05 * weighted_res))
            history.append({"iteration": i, "time": simulated_time, "residuals": residuals_dict, "credibility_score": credibility_score_pinn})

            if i == num_steps - 1:
                z_levels = np.linspace(-1.0, 1.0, 5)
                theta_steps = np.linspace(0, 2*np.pi, 8)
                radius = 1.0
                with torch.no_grad():
                    for z_pos in z_levels:
                        for theta in theta_steps:
                            x_pos, y_pos = radius * np.cos(theta), radius * np.sin(theta)
                            t_p = torch.tensor([[simulated_time]], dtype=torch.float32, device=current_model_v8.device)
                            x_p, y_p, z_p = torch.tensor([[x_pos]], device=current_model_v8.device), torch.tensor([[y_pos]], device=current_model_v8.device), torch.tensor([[z_pos]], device=current_model_v8.device)
                            rho_p, u_p, v_p, w_p, T_p = current_model_v8.pinn_model(t_p, x_p, y_p, z_p)
                            p_p = get_eos(current_model_v8.fluid_type, rho_p, T_p)
                            predictions_list.append({
                                "time": simulated_time, "x": float(x_pos), "y": float(y_pos), "z": float(z_pos),
                                "pressure": float(p_p.item()), "velocity_u": float(u_p.item()), "velocity_v": float(v_p.item()), "velocity_w": float(w_p.item()),
                                "temperature": float(T_p.item()), "density": float(rho_p.item()),
                                "velocity_magnitude": float(torch.sqrt(u_p**2 + v_p**2 + w_p**2).item())
                            })

        final_residuals = history[-1]["residuals"]
        credibility_score = history[-1]["credibility_score"]
        if scenario_outputs and "coherenceScore" in scenario_outputs:
            credibility_score = 0.7 * credibility_score + 0.3 * scenario_outputs["coherenceScore"]
        credibility_score = min(100.0, max(5.0, clean_float(credibility_score, 85.0)))
        
        risk_score, risk_assessment, compliance_report = risk_manager.compute_risk_score(final_residuals, current_model_v8.fluid_type)
        
        final_result = {
            "iteration": num_steps, "residuals": clean_json(final_residuals), "residual_history": clean_json(history),
            "credibility_score": credibility_score, "risk_assessment": risk_assessment, "compliance_report": compliance_report,
            "predictions3d": clean_json(predictions_list), "scenario_outputs": clean_json(scenario_outputs),
            "status": "completed", "updated_at": datetime.utcnow().isoformat()
        }
        
        # Rapport PDF
        try:
            report_filename = f"report_{job_id}.pdf"
            report_path = os.path.join("/tmp", report_filename)
            risk_manager.generate_full_report(report_path, request.project_id, job_id, request.scenario_type, request.dict(), final_result)
            if supabase_client:
                with open(report_path, "rb") as f:
                    supabase_client.storage.from_("reports").upload(f"reports/{report_filename}", f.read(), {"content-type": "application/pdf"})
                report_url = supabase_client.storage.from_("reports").get_public_url(f"reports/{report_filename}")
                final_result["report_url"] = report_url
                supabase_client.table("reports").insert({"project_id": request.project_id, "name": f"Rapport - {request.job_name}", "file_url": report_url, "file_type": "PDF"}).execute()
        except Exception as e: print(f"Report error: {e}")

        # ✅ CRITIQUE : Mise à jour du statut de l'analyse dans Supabase
        if supabase_client and request.analysis_id:
            supabase_client.table("analyses").update({
                "status": "completed",
                "credibility_score": credibility_score,
                "results": final_result
            }).eq("id", request.analysis_id).execute()
            print(f"✅ Supabase Analysis {request.analysis_id} marked as completed.")

        jobs_store[job_id].update({"status": "completed", "results": final_result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        jobs_store[job_id].update({"status": "failed", "errorMessage": str(e)})
        if supabase_client and request.analysis_id:
            supabase_client.table("analyses").update({"status": "failed"}).eq("id", request.analysis_id).execute()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 10000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info", proxy_headers=True)
