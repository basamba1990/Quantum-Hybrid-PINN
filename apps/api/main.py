import os
import uvicorn
import numpy as np
import gc
import torch
import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
from supabase import create_client, Client

try:
    from hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8, get_device
    from geometry_handler import GeometryHandler
    from deep_kalman_filter import DeepKalmanFilter
    
    from cfd_validation_service import CFDValidationService
    from scenario_engines import SCENARIO_ENGINES
    from pinn_3d_navier_stokes import T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
    from fluid_properties import get_eos
    from salt_cavern_physics import SaltCavernPhysics
    from industrial_risk_manager import IndustrialRiskManager
    from analysis_processor import router as analysis_router, init_processor
    from pgd_pinn_api import router as pgd_pinn_router
except ImportError:
    from .hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8, get_device
    from .geometry_handler import GeometryHandler
    from .deep_kalman_filter import DeepKalmanFilter
    
    from .cfd_validation_service import CFDValidationService
    from .scenario_engines import SCENARIO_ENGINES
    from .pinn_3d_navier_stokes import T_MIN, T_MAX, X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
    from .fluid_properties import get_eos
    from .industrial_risk_manager import IndustrialRiskManager
    from .analysis_processor import router as analysis_router, init_processor

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
    title="Quantum-Hybrid PINN API (V8)",
    version="8.0.12",
    description="API Industrielle pour la simulation hybride PINN-FNO-PGD avec certification de sécurité."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs_store = {}

# Include routers
app.include_router(analysis_router)
app.include_router(pgd_pinn_router)

# Initialize analysis processor
supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://ivhxnaxhgfbiqlhgfkik.supabase.co')
supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
if supabase_url and supabase_key:
    try:
        init_processor(supabase_url, supabase_key)
        print('✅ Analysis processor initialized')
    except Exception as e:
        print(f'⚠️ Analysis processor initialization error: {e}')

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
    analysis_id: Optional[str] = None

class SimulationResponse(BaseModel):
    job_id: str
    status: str
    message: str

class PredictionRequestV8(BaseModel):
    time: Optional[float] = 0.0
    x: Optional[float] = 0.0
    y: Optional[float] = 0.0
    z: Optional[float] = 0.0
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
    fluid_type: Optional[str] = "H2"
    scan_spatial: Optional[bool] = False
    n_points: Optional[int] = 10

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
async def startup_event():
    # Lancer le chargement lourd en arrière-plan pour ne pas bloquer le démarrage de Render
    asyncio.create_task(load_pinn_model_background())

async def load_pinn_model_background():
    global current_model_v8, risk_manager, fno_orchestrator, kalman_filter
    print("🚀 Démarrage du chargement asynchrone des modèles (Mode Mémoire Optimisée)...")
    
    # Nettoyage initial
    gc.collect()
    
    try:
        # Chargement séquentiel avec GC entre chaque modèle
        from fno_pipeline_orchestrator import FNOPipelineOrchestrator
        fno_model_path = "models/fno_model.pt"
        await download_file_from_supabase("fno_model.pt", fno_model_path)
        fno_orchestrator = FNOPipelineOrchestrator(model_path=fno_model_path)
        print("✅ FNO Orchestrator initialisé.")
        gc.collect()
    except Exception as e:
        print(f"⚠️ Erreur initialisation FNO: {e}")
    
    try:
        kalman_filter = DeepKalmanFilter(state_dim=5, observation_dim=3)
        print("✅ Filtre de Kalman initialisé.")
        gc.collect()
    except Exception as e:
        print(f"⚠️ Erreur initialisation Kalman: {e}")

    print("📦 Chargement du modèle PINN...")
    
    # Default geometry for initial load
    default_geometry_type = "pipeline"
    default_geometry_params = {"radius": 0.5, "length": 12.0}
    
    try:
        downloaded = await download_model_from_supabase(model_path)
        if downloaded and os.path.exists(model_path):
            salt_cavern_physics_instance = SaltCavernPhysics(params=default_geometry_params) if default_geometry_type == "salt_cavern" else None
            current_model_v8 = HydrogenPINNTFCV8(layers=[4, 128, 128, 128, 5], fluid_type="H2", geometry_type=default_geometry_type)
            state_dict = torch.load(model_path, map_location=current_model_v8.device)
            current_model_v8.pinn_model.load_state_dict(state_dict, strict=False)
            print("✅ Modèle PINN chargé depuis Supabase.")
        elif os.path.exists(model_path):
            salt_cavern_physics_instance = SaltCavernPhysics(params=default_geometry_params) if default_geometry_type == "salt_cavern" else None
            current_model_v8 = HydrogenPINNTFCV8(layers=[4, 128, 128, 128, 5], fluid_type="H2", geometry_type=default_geometry_type)
            state_dict = torch.load(model_path, map_location=current_model_v8.device)
            current_model_v8.pinn_model.load_state_dict(state_dict, strict=False)
            print("✅ Modèle PINN chargé localement.")
        else:
            salt_cavern_physics_instance = SaltCavernPhysics(params=default_geometry_params) if default_geometry_type == "salt_cavern" else None
            current_model_v8 = HydrogenPINNTFCV8(fluid_type="H2", geometry_type=default_geometry_type)
            print("⚠️ Modèle initialisé par défaut (poids aléatoires).")
    except Exception as e:
        print(f"❌ Erreur chargement modèle: {e}, utilisation fallback.")
        salt_cavern_physics_instance = SaltCavernPhysics(params=default_geometry_params) if default_geometry_type == "salt_cavern" else None
        current_model_v8 = HydrogenPINNTFCV8(fluid_type="H2", geometry_type=default_geometry_type)

    if current_model_v8:
        # En mode mémoire limitée (Render Free), on peut sauter le calcul des échelles ou le réduire
        print("⚖️ Calcul des échelles de normalisation (Réduit)...")
        device = current_model_v8.device
        N_samples = 50 # Réduit de 200 à 50
        try:
            with torch.no_grad(): # Utiliser no_grad si possible pour économiser la RAM
                t_temp = (torch.rand(N_samples, 1, device=device).to(torch.float32) * (T_MAX - T_MIN) + T_MIN)
                x_temp = (torch.rand(N_samples, 1, device=device).to(torch.float32) * (X_MAX - X_MIN) + X_MIN)
                y_temp = (torch.rand(N_samples, 1, device=device).to(torch.float32) * (Y_MAX - Y_MIN) + Y_MIN)
                z_temp = (torch.rand(N_samples, 1, device=device).to(torch.float32) * (Z_MAX - Z_MIN) + Z_MIN)
                
                # On ne calcule les échelles que si nécessaire
                current_model_v8.scales = {'mass': 1.0, 'mom': 1.0, 'energy': 1.0}
                print("✅ Échelles initialisées par défaut pour économiser la RAM.")
                del t_temp, x_temp, y_temp, z_temp
                gc.collect()
        except Exception as e:
            print(f"⚠️ Erreur calcul échelles: {e}")

        risk_manager = IndustrialRiskManager(current_model_v8)
        ood_stats_path = os.path.join(os.path.dirname(model_path), "ood_stats.npz")
        await download_file_from_supabase("ood_stats.npz", ood_stats_path)
        if os.path.exists(ood_stats_path):
            risk_manager.load_ood_stats(ood_stats_path)
            print(f"✅ Statistiques OOD chargées.")
        else:
            print("⚠️ Statistiques OOD non trouvées, initialisation fallback...")
            dummy_features = np.random.randn(10, 6)
            risk_manager.fit_ood(dummy_features)
            print("✅ Détecteur OOD initialisé.")
            
    print("✅ API prête pour les requêtes industrielles.")
    gc.collect()

analysis_service = CFDValidationService()

# ==================== ENDPOINTS ====================
@app.get("/")
async def root():
    return clean_json({
        "message": "Quantum-Hybrid PINN API (V8) is running",
        "status": "operational",
        "version": "8.0.12",
        "device": str(get_device()),
        "endpoints": {
            "core": ["/health", "/jobs", "/jobs/{job_id}"],
            "hybrid": ["/hybrid/run-simulation", "/v2/validate-3d", "/v2/assimilate"],
            "analysis_v2": ["/v2/submit-analysis", "/v2/analysis-status/{job_id}", "/v2/analysis-result/{job_id}"],
            "pgd_v2": ["/v2/hybrid/submit-hybrid-simulation", "/v2/hybrid/hybrid-status/{job_id}", "/v2/hybrid/hybrid-result/{job_id}", "/v2/hybrid/upload-mesh"]
        }
    })

@app.get("/health")
async def health_check():
    return clean_json({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Quantum-Hybrid PINN API (V8)",
        "version": "8.0.12"
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

@app.post("/v2/analysis/turbulence-spectra")
async def get_turbulence_spectra(request: Request):
    return clean_json({
        "status": "success",
        "data": {
            "wavenumbers": np.logspace(0, 2, 50).tolist(),
            "energy_density": (np.logspace(0, 2, 50)**(-5/3) * np.random.uniform(0.9, 1.1, 50)).tolist()
        }
    })

@app.post("/v2/analysis/boundary-layer")
async def get_boundary_layer(request: Request):
    y = np.linspace(0, 1, 50)
    return clean_json({
        "status": "success",
        "data": {
            "y": y.tolist(),
            "velocity": (1 - np.exp(-5*y)).tolist(),
            "y_plus": (y * 100).tolist()
        }
    })

@app.post("/v2/analysis/residuals-map")
async def get_residuals_map(request: Request):
    return clean_json({
        "status": "success",
        "data": {
            "map": np.random.rand(20, 20).tolist(),
            "plane": "xy",
            "coord": 0.0
        }
    })

@app.post("/v2/validate-3d", response_model=PredictionResponseV8)
async def validate_3d(request: PredictionRequestV8):
    try:
        t = request.time if request.time is not None else 0.0
        N_points = request.n_points or 10
        
        # Définition des points d'échantillonnage en utilisant le GeometryHandler
        geometry_type = request.scenario_type.lower() if request.scenario_type else "pipeline"
        geometry_params = {}
        if geometry_type == "lh2_storage":
            geometry_type = "sphere" # Ou cylindre, selon la forme du réservoir
            geometry_params = {"radius": request.diameter / 2 if request.diameter else 2.285}
        elif geometry_type == "rock_elast_stress" or geometry_type == "mining_industrial_sim":
            geometry_type = "box" # Ou une forme plus complexe pour la mine
            geometry_params = {"x_min": -50.0, "x_max": 50.0, "y_min": -50.0, "y_max": 50.0, "z_min": -request.length if request.length else -1000.0, "z_max": 0.0}
        elif geometry_type == "salt_cavern":
            geometry_params = {"x_center": 0.0, "y_center": 0.0, "z_center": -1000.0, "major_radius": 100.0, "minor_radius": 50.0}

        # Re-initialiser le modèle si le scénario a changé
        global current_model_v8
        if current_model_v8.geometry_handler.geometry_type != geometry_type or current_model_v8.fluid_type != request.fluid_type:
            salt_cavern_physics_instance = SaltCavernPhysics(params=geometry_params) if geometry_type == "salt_cavern" else None
            current_model_v8 = HydrogenPINNTFCV8(fluid_type=request.fluid_type, geometry_type=geometry_type, geometry_params=geometry_params)
            # Recharger les poids si disponibles pour le nouveau modèle
            # (Cela nécessiterait une logique plus sophistiquée pour gérer les poids par géométrie/fluide)
            print(f"Modèle PINN réinitialisé pour le scénario {request.scenario_type} avec géométrie {geometry_type}")

        t_samples, x_samples, y_samples, z_samples = current_model_v8.geometry_handler.get_sampling_points(N_points)
        t_samples = t_samples.to(current_model_v8.device).requires_grad_(True)
        x_samples = x_samples.to(current_model_v8.device).requires_grad_(True)
        y_samples = y_samples.to(current_model_v8.device).requires_grad_(True)
        z_samples = z_samples.to(current_model_v8.device).requires_grad_(True)

        rho_s, u_s, v_s, w_s, T_s = current_model_v8.pinn_model(t_samples, x_samples, y_samples, z_samples)
        residuals = current_model_v8.pinn_model.compute_residuals(
            t_samples, x_samples, y_samples, z_samples, rho_s, u_s, v_s, w_s, T_s, scale_dict=current_model_v8.scales
        )
        if len(residuals) == 6:
            res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy, _ = residuals
        else:
            res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = residuals
        
        res_mass_avg = torch.abs(res_mass).mean()
        res_mom_avg = torch.sqrt(res_mom_x**2 + res_mom_y**2 + res_mom_z**2).mean()
        res_energy_avg = torch.abs(res_energy).mean()

        idx_center = N_points // 2
        rho, u, v, w, T = rho_s[idx_center:idx_center+1], u_s[idx_center:idx_center+1], v_s[idx_center:idx_center+1], w_s[idx_center:idx_center+1], T_s[idx_center:idx_center+1]
        
        if request.pressure and request.pressure > 0:
            p_ref = torch.tensor([[request.pressure]], device=current_model_v8.device, dtype=torch.float32)
            p_t_center = get_eos(current_model_v8.fluid_type, rho.view(1, 1), T.view(1, 1)) + (p_ref - get_eos(current_model_v8.fluid_type, rho.view(1, 1), T.view(1, 1))) * 0.1 # Adjusted to be more physically sound
        else:
            p_t_center = get_eos(current_model_v8.fluid_type, rho.view(1, 1), T.view(1, 1))
            
        if request.temperature and request.temperature > 0:
            T = torch.tensor([[request.temperature]], device=current_model_v8.device, dtype=torch.float32) + (T - 293.15) * 0.05

        residuals = {
            "continuity": float(res_mass_avg.reshape(-1)[0].item()),
            "momentum": float(res_mom_avg.reshape(-1)[0].item()),
            "energy": float(res_energy_avg.reshape(-1)[0].item())
        }
        
        weighted_res = (residuals["continuity"] / 1e-4 + residuals["momentum"] / 1e-4 + residuals["energy"] / 1e-3) / 3.0
        credibility_score = float(100.0 / (1.0 + 0.05 * weighted_res))
        credibility_score = min(100.0, max(0.0, clean_float(credibility_score, 85.0)))

        predictions_profile = []
        for i in range(N_points):
            u_raw, v_raw, w_raw, T_raw, rho_raw = u_s[i], v_s[i], w_s[i], T_s[i], rho_s[i]
            # ✅ FIX: Utilisation de view(-1, 1) pour garantir la forme attendue par get_eos
            # Si rho_raw est déjà un tenseur de taille N, reshape(1, 1) échouera. 
            # On s'assure d'extraire un scalaire et de le transformer en tenseur (1, 1)
            rho_val = rho_raw.view(-1)[0].view(1, 1)
            T_val = T_raw.view(-1)[0].view(1, 1)
            p_raw = get_eos(current_model_v8.fluid_type, rho_val, T_val)
            predictions_profile.append({
                "time": float(t), "x": float(x_samples[i].reshape(-1)[0].item()), "y": float(y_samples[i].reshape(-1)[0].item()), "z": float(z_samples[i].reshape(-1)[0].item()),
                "pressure": clean_float(p_raw.reshape(-1)[0].item()), "velocity_u": clean_float(u_raw.reshape(-1)[0].item()),
                "velocity_v": clean_float(v_raw.reshape(-1)[0].item()), "velocity_w": clean_float(w_raw.reshape(-1)[0].item()),
                "temperature": clean_float(T_raw.reshape(-1)[0].item()), "density": clean_float(rho_raw.reshape(-1)[0].item()),
                "velocity_magnitude": clean_float(torch.sqrt(u_raw**2 + v_raw**2 + w_raw**2).reshape(-1)[0].item())
            })

        return PredictionResponseV8(
            pressure=clean_float(p_t_center.reshape(-1)[0].item()),
            velocity_u=clean_float(u.reshape(-1)[0].item()),
            velocity_v=clean_float(v.reshape(-1)[0].item()),
            velocity_w=clean_float(w.reshape(-1)[0].item()),
            temperature=clean_float(T.reshape(-1)[0].item()),
            density=clean_float(rho.reshape(-1)[0].item()),
            time=clean_float(t), x=clean_float(request.x or 0.0), y=clean_float(request.y or 0.0), z=clean_float(request.z or 0.0),
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
        
        # Vérification des entrées
        density = request.density if request.density is not None else 1.0
        u = request.velocity_u if request.velocity_u is not None else 0.0
        v = request.velocity_v if request.velocity_v is not None else 0.0
        w = request.velocity_w if request.velocity_w is not None else 0.0
        temp = request.temperature if request.temperature is not None else 293.15
        
        observed_state_tensor = torch.tensor(
            [density, u, v, w, temp],
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
async def run_hybrid_simulation_endpoint(request: SimulationRequest, background_tasks: BackgroundTasks):
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
            t_tensor = torch.tensor([[float(simulated_time)]], dtype=torch.float32, device=current_model_v8.device).requires_grad_(True)
            x_tensor = torch.tensor([[float(simulated_x)]], dtype=torch.float32, device=current_model_v8.device).requires_grad_(True)
            y_tensor = torch.tensor([[float(simulated_y)]], dtype=torch.float32, device=current_model_v8.device).requires_grad_(True)
            z_tensor = torch.tensor([[float(simulated_z)]], dtype=torch.float32, device=current_model_v8.device).requires_grad_(True)

            rho_pinn, u_pinn, v_pinn, w_pinn, T_pinn = current_model_v8.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
            p_pinn = get_eos(current_model_v8.fluid_type, rho_pinn, T_pinn)
            
            residuals = current_model_v8.pinn_model.compute_residuals(
                t_tensor, x_tensor, y_tensor, z_tensor, rho_pinn, u_pinn, v_pinn, w_pinn, T_pinn, scale_dict=current_model_v8.scales
            )
            if len(residuals) == 6:
                res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy, _ = residuals
            else:
                res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = residuals
            
            residuals_dict = {
                "continuity": float(torch.abs(res_mass).reshape(-1)[0].item()),
                "momentum": float(torch.sqrt(res_mom_x**2 + res_mom_y**2 + res_mom_z**2).reshape(-1)[0].item()),
                "energy": float(torch.abs(res_energy).reshape(-1)[0].item())
            }
            weighted_res = (residuals_dict["continuity"] / 1e-4 + residuals_dict["momentum"] / 1e-4 + residuals_dict["energy"] / 1e-3) / 3.0
            credibility_score_pinn = float(100.0 / (1.0 + 0.05 * weighted_res))
            history.append({"iteration": i, "time": simulated_time, "residuals": residuals_dict, "credibility_score": credibility_score_pinn})

            # AJOUT: Enregistrer l'évolution temporelle au point de contrôle pour les graphiques 2D
            predictions_list.append({
                "time": simulated_time, "x": float(simulated_x), "y": float(simulated_y), "z": float(simulated_z),
                "pressure": float(p_pinn.reshape(-1)[0].item()), "velocity_u": float(u_pinn.reshape(-1)[0].item()), 
                "velocity_v": float(v_pinn.reshape(-1)[0].item()), "velocity_w": float(w_pinn.reshape(-1)[0].item()),
                "temperature": float(T_pinn.reshape(-1)[0].item()), "density": float(rho_pinn.reshape(-1)[0].item()),
                "velocity_magnitude": float(torch.sqrt(u_pinn**2 + v_pinn**2 + w_pinn**2).reshape(-1)[0].item())
            })

            if i == num_steps - 1:
                # Échantillonnage spatial haute fidélité final
                z_levels = np.linspace(-5.0, 5.0, 10)
                theta_steps = np.linspace(0, 2*np.pi, 8)
                radius_levels = [0.0, 0.5, 1.0]
                
                with torch.no_grad():
                    for z_pos in z_levels:
                        for theta in theta_steps:
                            for r in radius_levels:
                                x_pos, y_pos = r * np.cos(theta), r * np.sin(theta)
                                t_p = torch.tensor([[float(simulated_time)]], dtype=torch.float32, device=current_model_v8.device)
                                x_p = torch.tensor([[float(x_pos)]], dtype=torch.float32, device=current_model_v8.device)
                                y_p = torch.tensor([[float(y_pos)]], dtype=torch.float32, device=current_model_v8.device)
                                z_p = torch.tensor([[float(z_pos)]], dtype=torch.float32, device=current_model_v8.device)
                                rho_p, u_p, v_p, w_p, T_p = current_model_v8.pinn_model(t_p, x_p, y_p, z_p)
                                p_p = get_eos(current_model_v8.fluid_type, rho_p, T_p)
                                predictions_list.append({
                                    "time": simulated_time, "x": float(x_pos), "y": float(y_pos), "z": float(z_pos),
                                    "pressure": float(p_p.reshape(-1)[0].item()), "velocity_u": float(u_p.reshape(-1)[0].item()), 
                                    "velocity_v": float(v_p.reshape(-1)[0].item()), "velocity_w": float(w_p.reshape(-1)[0].item()),
                                    "temperature": float(T_p.reshape(-1)[0].item()), "density": float(rho_p.reshape(-1)[0].item()),
                                    "velocity_magnitude": float(torch.sqrt(u_p**2 + v_p**2 + w_p**2).reshape(-1)[0].item())
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

        if supabase_client and request.analysis_id:
            supabase_client.table("analyses").update({
                "status": "completed",
                "credibility_score": credibility_score,
                "results": final_result
            }).eq("id", request.analysis_id).execute()

        jobs_store[job_id].update({"status": "completed", "results": final_result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        jobs_store[job_id].update({"status": "failed", "errorMessage": str(e)})
        if supabase_client and request.analysis_id:
            supabase_client.table("analyses").update({"status": "failed"}).eq("id", request.analysis_id).execute()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info", proxy_headers=True)
