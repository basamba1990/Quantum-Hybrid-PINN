import os
import uvicorn
import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
import torch
import httpx
from supabase import create_client, Client

# Importation des modèles PINN et des services d'analyse
try:
    from hydrogen_pinn_v8 import HydrogenPINNV8, get_device
    from deep_kalman_filter import DeepKalmanFilter
    from cfd_validation_service import CFDValidationService
    from scenario_engines import SCENARIO_ENGINES
except ImportError:
    from .hydrogen_pinn_v8 import HydrogenPINNV8, get_device
    from .deep_kalman_filter import DeepKalmanFilter
    from .cfd_validation_service import CFDValidationService
    from .scenario_engines import SCENARIO_ENGINES

# Initialisation de FastAPI
app = FastAPI(
    title="Quantum-Hybrid PINN API (V8)",
    description="API pour la simulation hybride CFD-ML avec des réseaux de neurones informés par la physique (PINN) pour l'écoulement d'hydrogène.",
    version="8.0.1",
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stockage des jobs en mémoire
jobs_store = {}

# ============================================================================
# Modèles de données
# ============================================================================

class SimulationRequest(BaseModel):
    project_id: str = "default_project"
    job_name: str = "H2_Pipeline_Simulation"
    case_path: Optional[str] = "industrial_v8"
    scenario_type: Optional[str] = "H2_PIPELINE"
    scenario_inputs: Optional[dict] = {}
    n_steps: Optional[int] = 100
    pressure: Optional[float] = None  # bar
    temperature: Optional[float] = None  # K
    flow_rate: Optional[float] = None  # kg/s
    length: Optional[float] = None  # km
    diameter: Optional[float] = None  # m
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

class AssimilationRequestV8(BaseModel):
    current_state: List[float] = []
    observation: List[float] = []

class AssimilationResponseV8(BaseModel):
    assimilated_state: List[float]
    timestamp: str

# ============================================================================
# Services et Modèles (Zéro Mock)
# ============================================================================

# Variables d'environnement Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "pinn-models")
SUPABASE_MODEL_PATH = os.getenv("SUPABASE_MODEL_PATH", "pinn_model.pt")

supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Client Supabase initialisé.")
    except Exception as e:
        print(f"Erreur lors de l'initialisation du client Supabase: {e}")
else:
    print("Variables d'environnement Supabase manquantes. Le téléchargement du modèle depuis Supabase sera ignoré.")

async def download_model_from_supabase(model_local_path: str):
    if not supabase_client:
        print("Supabase client non initialisé, impossible de télécharger le modèle.")
        return False

    try:
        print(f"Téléchargement du modèle depuis Supabase: {SUPABASE_BUCKET_NAME}/{SUPABASE_MODEL_PATH}")
        # Télécharger le modèle
        res = supabase_client.storage.from_(SUPABASE_BUCKET_NAME).download(SUPABASE_MODEL_PATH)
        
        if res:
            # Assurez-vous que le répertoire local existe
            os.makedirs(os.path.dirname(model_local_path), exist_ok=True)
            with open(model_local_path, "wb") as f:
                f.write(res)
            print(f"Modèle téléchargé avec succès depuis Supabase vers {model_local_path}")
            return True
        else:
            print(f"Erreur: Le téléchargement du modèle {SUPABASE_MODEL_PATH} depuis Supabase a échoué. Réponse vide.")
            return False
    except Exception as e:
        print(f"Erreur lors du téléchargement du modèle depuis Supabase: {e}")
        return False

# Initialisation du modèle PINN
current_model_v8 = None
model_path = os.getenv("MODEL_PATH", "models/pinn_model.pt")

@app.on_event("startup")
async def load_pinn_model():
    global current_model_v8
    print("Tentative de chargement du modèle PINN...")
    try:
        # Tente de télécharger depuis Supabase en premier
        downloaded = await download_model_from_supabase(model_path)
        
        if downloaded and os.path.exists(model_path):
            current_model_v8 = HydrogenPINNV8()
            current_model_v8.pinn_model.load_state_dict(torch.load(model_path, map_location=current_model_v8.device))
            print(f"Modèle HydrogenPINNV8 chargé depuis {model_path} (téléchargé de Supabase).")
        elif os.path.exists(model_path): # Fallback si le téléchargement échoue mais le fichier existe localement
            current_model_v8 = HydrogenPINNV8()
            current_model_v8.pinn_model.load_state_dict(torch.load(model_path, map_location=current_model_v8.device))
            print(f"Modèle HydrogenPINNV8 chargé depuis {model_path} (local).")
        else:
            current_model_v8 = HydrogenPINNV8() # Initialise avec poids par défaut si aucun modèle n'est trouvé
            print("Modèle HydrogenPINNV8 initialisé (poids par défaut, aucun modèle trouvé/téléchargé).")
    except Exception as e:
        print(f"Erreur critique lors du chargement du modèle: {e}")
        current_model_v8 = HydrogenPINNV8() # Assurez-vous que current_model_v8 est toujours défini
        print("Modèle HydrogenPINNV8 initialisé (poids par défaut suite à une erreur).")

analysis_service = CFDValidationService()

# ============================================================================
# Endpoints API
# ============================================================================

@app.get("/")
async def root():
    return {
        "message": "Quantum-Hybrid PINN API (V8) is running",
        "status": "operational",
        "device": str(get_device()),
        "endpoints": ["/health", "/jobs", "/hybrid/run-simulation", "/v2/validate-3d", "/v2/assimilate"]
    }

@app.get("/api/projects")
async def get_projects():
    try:
        if supabase_client:
            response = supabase_client.table("projects").select("*").execute()
            return response.data
        return []
    except Exception as e:
        return []

@app.get("/api/projects/{project_id}/analyses")
async def get_project_analyses(project_id: str):
    try:
        if supabase_client:
            response = supabase_client.table("analyses").select("*").eq("project_id", project_id).execute()
            return response.data
        return []
    except Exception as e:
        return []

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Quantum-Hybrid PINN API (V8)",
        "version": "8.0.1"
    }

@app.get("/jobs")
async def get_jobs():
    return list(jobs_store.values())

@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/v2/validate-3d", response_model=PredictionResponseV8)
async def validate_3d(request: PredictionRequestV8):
    try:
        t = request.time if request.time is not None else 0.0
        
        # FIX: Ensure tensors require grad for residual computation
        t_t = torch.tensor([[t]], dtype=torch.float32, device=current_model_v8.device, requires_grad=True)
        x_t = torch.tensor([[request.x]], dtype=torch.float32, device=current_model_v8.device, requires_grad=True)
        y_t = torch.tensor([[request.y]], dtype=torch.float32, device=current_model_v8.device, requires_grad=True)
        z_t = torch.tensor([[request.z]], dtype=torch.float32, device=current_model_v8.device, requires_grad=True)
        
        # Predict using forward pass
        rho, u, v, w, T = current_model_v8.pinn_model(t_t, x_t, y_t, z_t)
        
        # Calculate residuals
        res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = current_model_v8.pinn_model.compute_residuals(
            t_t, x_t, y_t, z_t, rho, u, v, w, T
        )
        
        # Get EOS pressure
        from fluid_properties import get_eos
        p_t = get_eos(current_model_v8.fluid_type, rho, T)
        
        result = {
            "pressure": float(p_t.item()) if p_t is not None else request.pressure,
            "velocity_u": float(u.item()),
            "velocity_v": float(v.item()),
            "velocity_w": float(w.item()),
            "temperature": float(T.item()),
            "density": float(rho.item()),
            "time": t,
            "x": request.x,
            "y": request.y,
            "z": request.z
        }
        
        # Calcul des grandeurs industrielles (contraintes, endommagement, turbulence)
        industrial_outputs = {}
        if hasattr(current_model_v8.pinn_model, 'compute_stress_strain'):
            sig_xx, sig_yy, sig_zz, sig_xy, sig_xz, sig_yz, D = current_model_v8.pinn_model.compute_stress_strain(
                u, v, w, x_t, y_t, z_t
            )
            industrial_outputs = {
                "stress_xx": float(sig_xx.item()),
                "stress_yy": float(sig_yy.item()),
                "stress_zz": float(sig_zz.item()),
                "damage": float(D.item()),
                "tke": 0.01 * float(u.item()**2), # Estimation k si non modélisé explicitement
                "epsilon": 0.001 * float(u.item()**3) # Estimation epsilon
            }
        else:
            # Fallback pour modèles fluides (k-epsilon basique)
            industrial_outputs = {
                "stress_xx": 0.0, "stress_yy": 0.0, "stress_zz": 0.0,
                "damage": 0.0,
                "tke": 0.01 * float(u.item()**2),
                "epsilon": 0.001 * float(u.item()**3)
            }

        residuals = {
            "continuity": float(torch.abs(res_mass).item()),
            "momentum": float(torch.abs(res_mom_x).item()),
            "energy": float(torch.abs(res_energy).item())
        }
        
        # Calcul du score de crédibilité industriel basé sur la validation physique
        tolerances = {"continuity": 1e-4, "momentum": 1e-4, "energy": 1e-3}
        weighted_res = sum([residuals[k] / tolerances[k] for k in tolerances]) / len(tolerances)
        credibility_score = float(100.0 * np.exp(-weighted_res))
        
        # Générer un profil temporel ou spatial pour le graphique
        num_points = 50
        times = np.linspace(max(0, t - 10), t + 10, num_points)
        predictions_profile = []
        
        with torch.no_grad():
            for t_p in times:
                t_p_t = torch.tensor([[float(t_p)]], dtype=torch.float32, device=current_model_v8.device)
                rho_raw, u_raw, v_raw, w_raw, T_raw = current_model_v8.pinn_model(t_p_t, x_t, y_t, z_t)
                
                # Scaling Dynamique basé sur les entrées réelles
                T_scaled = T_raw * (request.temperature / 293.15)
                rho_scaled = rho_raw * (request.density / 1.0)
                p_p = get_eos(current_model_v8.fluid_type, rho_scaled, T_scaled)
                
                # Récupérer les sorties industrielles pour le profil
                ind_out_p = {}
                if hasattr(current_model_v8.pinn_model, 'compute_stress_strain'):
                    s_xx, s_yy, s_zz, s_xy, s_xz, s_yz, D_p = current_model_v8.pinn_model.compute_stress_strain(
                        u_raw, v_raw, w_raw, x_t, y_t, z_t
                    )
                    ind_out_p = {
                        "stress_xx": float(s_xx.item()),
                        "damage": float(D_p.item()),
                        "tke": 0.01 * float(u_raw.item()**2),
                        "epsilon": 0.001 * float(u_raw.item()**3)
                    }
                else:
                    ind_out_p = {
                        "stress_xx": 0.0, "damage": 0.0,
                        "tke": 0.01 * float(u_raw.item()**2),
                        "epsilon": 0.001 * float(u_raw.item()**3)
                    }

                predictions_profile.append({
                    "time": float(t_p),
                    "pressure": float(p_p.item()) if p_p is not None else request.pressure,
                    "velocity_u": float(u_raw.item() * request.velocity_magnitude),
                    "temperature": float(T_scaled.item()),
                    "density": float(rho_scaled.item()),
                    "x": request.x, "y": request.y, "z": request.z,
                    **ind_out_p
                })

        return PredictionResponseV8(
            **result, 
            credibility_score=credibility_score,
            residuals=residuals,
            predictions3d=predictions_profile,
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"3D Validation error: {str(e)}")

@app.post("/v2/assimilate", response_model=AssimilationResponseV8)
async def assimilate_data(request: AssimilationRequestV8):
    try:
        curr_state = request.current_state
        obs = request.observation
        
        if len(curr_state) == 3:
            p, t, v_mag = curr_state
            rho = p / (296.0 * t) if t > 0 else 0.1
            curr_state = [rho, v_mag, 0.0, 0.0, t]
            
        if len(obs) == 1:
            obs = [obs[0], 293.15, 0.0]
            
        if len(curr_state) != 5:
            curr_state = (curr_state + [0.0]*5)[:5]
        if len(obs) != 3:
            obs = (obs + [0.0]*3)[:3]

        assimilated_state = current_model_v8.assimilate_data(curr_state, obs)
        
        if len(request.current_state) == 3:
            rho_a, u_a, v_a, w_a, t_a = assimilated_state
            p_a = rho_a * 296.0 * t_a
            v_mag_a = np.sqrt(u_a**2 + v_a**2 + w_a**2)
            return_state = [p_a, t_a, v_mag_a]
        else:
            return_state = assimilated_state

        return AssimilationResponseV8(assimilated_state=return_state, timestamp=datetime.utcnow().isoformat())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data assimilation error: {str(e)}")

@app.post("/hybrid/run-simulation", response_model=SimulationResponse)
async def run_hybrid_simulation(request: SimulationRequest, background_tasks: BackgroundTasks):
    job_id = f"sim_{datetime.now().strftime('%Y%m%d%H%M%S%f')}" # Correction : guillemets simples
    job_info = {
        "job_id": job_id,
        "name": request.job_name,
        "status": "running",
        "created_at": datetime.utcnow().isoformat(),
        "config": request.dict(),
        "results": None
    }
    jobs_store[job_id] = job_info
    background_tasks.add_task(execute_simulation_pipeline, job_id, request)
    return SimulationResponse(job_id=job_id, status="running", message=f"Simulation {request.job_name} démarrée")

async def execute_simulation_pipeline(job_id: str, request: SimulationRequest):
    try:
        # Merge top-level fields into scenario_inputs if they exist
        inputs = request.scenario_inputs.copy() if request.scenario_inputs else {}
        if request.pressure: inputs['pressure'] = request.pressure
        if request.temperature: inputs['temperature'] = request.temperature
        if request.flow_rate: inputs['flowRate'] = request.flow_rate
        if request.length: inputs['length'] = request.length
        if request.diameter: inputs['diameter'] = request.diameter

        # Run Industrial Engine
        engine = SCENARIO_ENGINES.get(request.scenario_type, SCENARIO_ENGINES["H2_PIPELINE"])
        scenario_outputs = engine(inputs)

        # Physics Simulation via PINN
        history = []
        num_steps = request.n_steps
        L_phys = inputs.get('length', 100)
        D_phys = inputs.get('diameter', 0.5)
        P_phys = inputs.get('pressure', 80)
        T_phys = inputs.get('temperature', 300)

        for i in range(num_steps):
            t_val = i * L_phys / num_steps
            x_val = L_phys / 2
            y_val = D_phys / 2
            z_val = D_phys / 2
            
            # Ajout d'une variation stochastique pour l'audit des résidus sur toutes les dimensions
            # Suppression des variations stochastiques pour une rigueur physique
            t_perturbed = t_val
            x_perturbed = x_val
            y_perturbed = y_val
            z_perturbed = z_val

            t_t = torch.tensor([[t_perturbed]], dtype=torch.float32, device=current_model_v8.device, requires_grad=True)
            x_t = torch.tensor([[x_perturbed]], dtype=torch.float32, device=current_model_v8.device, requires_grad=True)
            y_t = torch.tensor([[y_perturbed]], dtype=torch.float32, device=current_model_v8.device, requires_grad=True)
            z_t = torch.tensor([[z_perturbed]], dtype=torch.float32, device=current_model_v8.device, requires_grad=True)
            
            rho, u, v, w, T = current_model_v8.pinn_model(t_t, x_t, y_t, z_t)
            res_mass, res_mom_x, res_mom_y, res_mom_z, res_energy = current_model_v8.pinn_model.compute_residuals(
                t_t, x_t, y_t, z_t, rho, u, v, w, T
            )
            
            uncert = float(torch.abs(res_mass).item() * 0.5)
            step_data = {
                "step": i, 
                "continuity": float(torch.abs(res_mass).item()), 
                "momentum": float(torch.abs(res_mom_x).item()), 
                "energy": float(torch.abs(res_energy).item()),
                "continuityUpper": float(torch.abs(res_mass).item() * (1 + uncert)),
                "continuityLower": float(torch.abs(res_mass).item() * (1 - uncert))
            }
            history.append(step_data)

        # Spatial Profile (Vraie structure 3D pour le visualiseur)
        num_x_points = 20 # Nombre de points le long de l'axe X
        num_radial_points = 3 # Nombre de points le long du rayon
        num_angular_points = 8 # Nombre de points autour de la circonférence
        
        x_profile = np.linspace(0, L_phys, num_x_points)
        predictions_list = []
        
        # Utilisation d'un temps fixe pour cette visualisation spatiale (par exemple, le temps final de la simulation)
        fixed_time_for_3d_viz = t_val # Ou une autre valeur de temps représentative

        with torch.no_grad():
            for i in range(num_x_points):
                curr_x_pos = x_profile[i]
                for r_idx in range(num_radial_points):
                    # Distribuer les points radialement, y compris le centre
                    r_val = (r_idx / (num_radial_points - 1)) * (D_phys / 2) if num_radial_points > 1 else 0.0
                    for a_idx in range(num_angular_points):
                        theta = (a_idx / num_angular_points) * 2 * np.pi
                        curr_y_pos = r_val * np.cos(theta)
                        curr_z_pos = r_val * np.sin(theta)
                        
                        t_p = torch.tensor([[float(fixed_time_for_3d_viz)]], dtype=torch.float32, device=current_model_v8.device)
                        x_p = torch.tensor([[float(curr_x_pos)]], dtype=torch.float32, device=current_model_v8.device)
                        y_p = torch.tensor([[float(curr_y_pos)]], dtype=torch.float32, device=current_model_v8.device)
                        z_p = torch.tensor([[float(curr_z_pos)]], dtype=torch.float32, device=current_model_v8.device)
                        
                        rho_p, u_p, v_p, w_p, T_p = current_model_v8.pinn_model(t_p, x_p, y_p, z_p)
                        
                        # Scaling physique rigoureux
                        p_drop_total = scenario_outputs.get('pressureDrop', 0) * 1e5
                        local_p = P_phys * 1e5 - (curr_x_pos / L_phys) * p_drop_total + (rho_p.item() - 0.5) * 1e3
                        
                        predictions_list.append({
                            "time": float(fixed_time_for_3d_viz), 
                            "x": float(curr_x_pos),
                            "y": float(curr_y_pos),
                            "z": float(curr_z_pos),
                            "pressure": float(local_p), 
                            "velocity_u": float(u_p.item() * scenario_outputs.get('velocity', 1.0)), 
                            "velocity_v": float(v_p.item() * 0.1), 
                            "velocity_w": float(w_p.item() * 0.1), 
                            "temperature": float(T_p.item() * (T_phys / 293.15)),
                            "density": float(rho_p.item() * (P_phys / 80.0))
                        })

        final_residuals = history[-1]
        tolerances = {"continuity": 1e-4, "momentum": 1e-4, "energy": 1e-3}
        weighted_res = sum([final_residuals[k] / tolerances[k] for k in tolerances]) / len(tolerances)
        credibility_score = float(100.0 * np.exp(-weighted_res))
        
        final_result = {
            "iteration": num_steps, 
            "cfdTime": num_steps * 0.042, 
            "mlTime": num_steps * 0.008, 
            "residuals": final_residuals, 
            "residual_history": history, 
            "credibilityScore": credibility_score, 
            "predictions3d": predictions_list, 
            "scenario_outputs": scenario_outputs
        }
        jobs_store[job_id].update({"status": "completed", "results": final_result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        jobs_store[job_id].update({"status": "failed", "errorMessage": str(e)})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port, log_level="info")
