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

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration des chemins pour les moteurs
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# On ajoute le répertoire courant au sys.path pour s'assurer que les imports locaux fonctionnent
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Import du validateur
try:
    from path_validator import PathValidator, PathValidationResult
except ImportError:
    from .path_validator import PathValidator, PathValidationResult

# Import des moteurs (maintenant situés dans le même répertoire)
try:
    from pvt_physics_engine import PVTPhysicsEngine
    from fno_pipeline_orchestrator import FNOPipelineOrchestrator
    from hydrogen_pinn_v8 import HydrogenPINNV8
    HAS_ENGINES = True
    logger.info("✅ Moteurs PVT/FNO/V8 chargés avec succès.")
except ImportError as e:
    logger.error(f"❌ Échec de l'import des moteurs: {e}")
    HAS_ENGINES = False

# Modèles globaux pour V2
current_model_v8 = None
if HAS_ENGINES:
    try:
        current_model_v8 = HydrogenPINNV8()
        logger.info("✅ Modèle V8 initialisé par défaut.")
    except Exception as e:
        logger.error(f"❌ Erreur initialisation V8: {e}")

# Initialiser l'application FastAPI
app = FastAPI(
    title="Quantum-Hybrid-PINN API",
    description="API pour l'exécution de simulations hybrides CFD-ML avec validation robuste des chemins",
    version="1.0.0"
)

# Initialiser le validateur de chemins
CASES_BASE_PATH = os.getenv("CASES_BASE_PATH", "/home/ubuntu/cases")
# S'assurer que le répertoire existe
os.makedirs(CASES_BASE_PATH, exist_ok=True)
path_validator = PathValidator(base_path=CASES_BASE_PATH)

# Stockage en mémoire des jobs (à remplacer par une base de données en production)
jobs_store: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# Modèles Pydantic
# ============================================================================

class CasePathRequest(BaseModel):
    """Requête pour valider un chemin de cas."""
    case_name: str = Field(..., description="Nom du cas OpenFOAM (par exemple, 'h2_pipeline')")


class AbsolutePathRequest(BaseModel):
    """Requête pour valider un chemin absolu."""
    absolute_path: str = Field(..., description="Chemin absolu complet vers le répertoire du cas")


class SimulationRequest(BaseModel):
    """Requête pour lancer une simulation hybride."""
    project_id: Optional[str] = Field(None, description="ID du projet")
    user_id: Optional[str] = Field(None, description="ID de l'utilisateur")
    job_id: Optional[str] = Field(None, description="ID du job (optionnel)")
    job_name: str = Field(..., description="Nom de la simulation")
    case_path: str = Field(..., description="Chemin ou nom du cas OpenFOAM")
    n_steps: int = Field(default=100, description="Nombre de pas de temps")
    time_step: float = Field(default=0.01, description="Pas de temps")
    residual_threshold: float = Field(default=0.01, description="Seuil de résidu")
    fields: List[str] = Field(default=["U", "p", "T"], description="Champs à simuler")
    ml_weight: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Poids du prédicteur ML (0.0 = CFD pur, 1.0 = ML pur)"
    )
    timeout_seconds: int = Field(
        default=3600,
        ge=60,
        description="Timeout en secondes pour la simulation"
    )


class SimulationResponse(BaseModel):
    """Réponse pour une simulation lancée."""
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
# Endpoints de Validation
# ============================================================================

@app.get("/", tags=["Root"])
async def root() -> Dict[str, Any]:
    """Route racine pour éviter les 404 et fournir des infos sur l'API."""
    return {
        "message": "Quantum-Hybrid-PINN API is running",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "engines_loaded": HAS_ENGINES
    }

@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, str]:
    """Vérifier la santé de l'API."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Quantum-Hybrid-PINN API",
        "engines_loaded": str(HAS_ENGINES)
    }


@app.post("/validate/case-path", tags=["Validation"])
async def validate_case_path(request: CasePathRequest) -> Dict[str, Any]:
    """
    Valider l'existence et l'accessibilité d'un cas OpenFOAM.
    """
    logger.info(f"Validating case path: {request.case_name}")

    result = path_validator.validate_case_path(request.case_name)

    if not result.is_valid:
        logger.error(f"Validation failed for case {request.case_name}: {result.error_message}")
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": result.error_code,
                "error_message": result.error_message,
                "details": result.details
            }
        )

    logger.info(f"Case {request.case_name} validated successfully")
    return {
        "is_valid": True,
        "case_name": request.case_name,
        "path": result.path,
        "details": result.details
    }


@app.post("/validate/absolute-path", tags=["Validation"])
async def validate_absolute_path(request: AbsolutePathRequest) -> Dict[str, Any]:
    """
    Valider un chemin absolu fourni directement.
    """
    logger.info(f"Validating absolute path: {request.absolute_path}")

    result = path_validator.validate_absolute_path(request.absolute_path)

    if not result.is_valid:
        logger.error(f"Validation failed for path {request.absolute_path}: {result.error_message}")
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": result.error_code,
                "error_message": result.error_message,
                "details": result.details
            }
        )

    logger.info(f"Path {request.absolute_path} validated successfully")
    return {
        "is_valid": True,
        "path": result.path,
        "details": result.details
    }


@app.get("/cases/list", tags=["Cases"])
async def list_available_cases() -> Dict[str, Any]:
    """
    Lister tous les cas OpenFOAM disponibles.
    """
    logger.info("Listing available cases")
    cases_info = path_validator.list_available_cases()
    return cases_info


# ============================================================================
# Endpoints de Simulation
# ============================================================================

@app.post("/hybrid/run-simulation", tags=["Simulation"])
async def run_hybrid_simulation(
    request: SimulationRequest,
    background_tasks: BackgroundTasks
) -> SimulationResponse:
    """
    Lancer une simulation hybride CFD-ML.
    """
    # Utiliser le nom du cas extrait du chemin si nécessaire
    case_name = request.case_path.strip('/').split('/')[-1]
    logger.info(f"Received simulation request: {request.job_name} for case {case_name}")

    # Validation du chemin du cas
    validation_result = path_validator.validate_case_path(case_name)
    
    if not validation_result.is_valid:
        logger.error(f"Simulation rejected: Case path validation failed for {case_name}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Case path validation failed",
                "error_code": validation_result.error_code,
                "error_message": validation_result.error_message
            }
        )

    # Utiliser l'ID fourni ou en générer un
    job_id = request.job_id or str(uuid.uuid4())

    # Créer une entrée de job
    job_info = {
        "job_id": job_id,
        "project_id": request.project_id,
        "user_id": request.user_id,
        "case_name": case_name,
        "job_name": request.job_name,
        "status": "PENDING",
        "created_at": datetime.utcnow().isoformat(),
        "config": request.dict()
    }
    
    jobs_store[job_id] = job_info
    
    # Simuler le lancement en arrière-plan
    # background_tasks.add_task(execute_simulation, job_id)
    
    return SimulationResponse(
        job_id=job_id,
        case_name=case_name,
        simulation_name=request.job_name,
        status="PENDING",
        created_at=job_info["created_at"],
        message="Simulation hybride lancée avec succès"
    )

@app.get("/jobs/{job_id}", tags=["Simulation"])
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """Récupérer le statut d'un job."""
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail="Job non trouvé")
    return jobs_store[job_id]

# ============================================================================
# Endpoints V2 (Hybrid PINN V8)
# ============================================================================

@app.post("/v2/validate-3d", response_model=PredictionResponseV8, tags=["V2"])
async def validate_3d(request: PredictionRequestV8):
    global current_model_v8
    try:
        if current_model_v8 is None:
            if HAS_ENGINES:
                from hydrogen_pinn_v8 import HydrogenPINNV8
                current_model_v8 = HydrogenPINNV8()
            else:
                raise ValueError("Moteurs non disponibles")
        
        result = current_model_v8.predict_state(request.time, request.x, request.y, request.z)
        return PredictionResponseV8(
            **result,
            timestamp=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        logger.error(f"3D Validation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v2/assimilate", response_model=AssimilationResponseV8, tags=["V2"])
async def assimilate_data(request: AssimilationRequestV8):
    global current_model_v8
    try:
        if current_model_v8 is None:
            if HAS_ENGINES:
                from hydrogen_pinn_v8 import HydrogenPINNV8
                current_model_v8 = HydrogenPINNV8()
            else:
                raise ValueError("Moteurs non disponibles")
        
        assimilated_state = current_model_v8.assimilate_data(request.current_state, request.observation)
        return AssimilationResponseV8(
            assimilated_state=assimilated_state,
            timestamp=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        logger.error(f"Data assimilation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
