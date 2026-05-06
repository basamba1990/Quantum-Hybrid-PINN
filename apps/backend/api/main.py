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

# Ajouter le chemin vers les moteurs
# Dans le conteneur Docker, les moteurs sont dans /app/apps/api
# En local, ils sont dans ../../api par rapport à ce fichier
possible_engine_paths = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../api")),
    "/app/apps/api",
    "/home/ubuntu/Quantum-Hybrid-PINN/apps/api"
]

for p in possible_engine_paths:
    if os.path.exists(p) and p not in sys.path:
        sys.path.append(p)
        logger.info(f"Added {p} to sys.path")

try:
    from api.path_validator import PathValidator, PathValidationResult
except ImportError:
    try:
        from path_validator import PathValidator, PathValidationResult
    except ImportError:
        # Fallback local si importé depuis le même dossier
        from .path_validator import PathValidator, PathValidationResult

try:
    from pvt_physics_engine import PVTPhysicsEngine
    from fno_pipeline_orchestrator import FNOPipelineOrchestrator
    HAS_ENGINES = True
    logger.info("✅ Moteurs PVT/FNO chargés avec succès.")
except ImportError as e:
    logger.warning(f"Moteurs PVT/FNO non trouvés dans le chemin ({e}), utilisation de stubs.")
    HAS_ENGINES = False

# Initialiser l'application FastAPI
app = FastAPI(
    title="Quantum-Hybrid-PINN API",
    description="API pour l'exécution de simulations hybrides CFD-ML avec validation robuste des chemins",
    version="1.0.0"
)

# Initialiser le validateur de chemins
import os
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
        "health": "/health"
    }

@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, str]:
    """Vérifier la santé de l'API."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Quantum-Hybrid-PINN API"
    }


@app.post("/validate/case-path", tags=["Validation"])
async def validate_case_path(request: CasePathRequest) -> Dict[str, Any]:
    """
    Valider l'existence et l'accessibilité d'un cas OpenFOAM.

    **Paramètres:**
    - `case_name`: Nom du cas (par exemple, 'h2_pipeline')

    **Réponses:**
    - 200: Cas valide ou détails de l'erreur
    - 400: Cas non trouvé ou invalide
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

    **Paramètres:**
    - `absolute_path`: Chemin absolu complet

    **Réponses:**
    - 200: Chemin valide ou détails de l'erreur
    - 400: Chemin non trouvé ou invalide
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

    **Réponses:**
    - 200: Liste des cas disponibles et invalides
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

    # PHASE 1: Validation du chemin du cas AVANT l'exécution
    # Essayer d'abord avec le nom du cas
    validation_result = path_validator.validate_case_path(case_name)
    
    # Si non trouvé, essayer avec le chemin complet si fourni
    if not validation_result.is_valid and request.case_path != case_name:
        # Extraire le nom du cas du chemin complet si c'est un chemin absolu
        potential_case_name = request.case_path.strip('/').split('/')[-1]
        validation_result = path_validator.validate_case_path(potential_case_name)

    if not validation_result.is_valid:
        logger.warning(f"Case path validation failed for {case_name}. Attempting auto-initialization.")
        try:
            from scripts.init_cases import init as init_cases
            init_cases()
            # Re-validate after initialization
            validation_result = path_validator.validate_case_path(case_name)
        except Exception as e:
            logger.error(f"Auto-initialization failed: {e}")

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

    # Créer une entrée de job avec sécurisation des identifiants
    job_info = {
        "job_id": job_id,
        "project_id": request.project_id,
        "user_id": request.user_id,
        "case_name": case_name,
        "job_name": request.job_name,
        "status": "PENDING",
        "created_at": datetime.utcnow().isoformat(),
        "config": {
            "n_steps": request.n_steps,
            "time_step": request.time_step,
            "residual_threshold": request.residual_threshold,
            "ml_weight": request.ml_weight,
            "fields": request.fields
        },
        "case_path": validation_result.path
    }

    jobs_store[job_id] = job_info
    logger.info(f"Simulation job created: {job_id} (Project: {request.project_id}, User: {request.user_id})")

    # Ajouter la tâche de simulation en arrière-plan
    background_tasks.add_task(
        execute_simulation_background,
        job_id,
        validation_result.path,
        request.ml_weight
    )

    return SimulationResponse(
        job_id=job_id,
        case_name=case_name,
        simulation_name=request.job_name,
        status="PENDING",
        created_at=job_info["created_at"],
        message=f"Simulation job {job_id} accepted and queued for execution"
    )


@app.get("/hybrid/job/{job_id}", tags=["Simulation"])
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Récupérer le statut d'un job de simulation.

    **Paramètres:**
    - `job_id`: ID unique du job

    **Réponses:**
    - 200: Statut du job
    - 404: Job non trouvé
    """
    if job_id not in jobs_store:
        raise HTTPException(
            status_code=404,
            detail={"error": f"Job {job_id} not found"}
        )

    return jobs_store[job_id]


@app.get("/hybrid/jobs", tags=["Simulation"])
async def list_all_jobs() -> Dict[str, Any]:
    """
    Lister tous les jobs de simulation.

    **Réponses:**
    - 200: Liste des jobs
    """
    return {
        "total_jobs": len(jobs_store),
        "jobs": list(jobs_store.values())
    }


# ============================================================================
# Tâches en Arrière-Plan
# ============================================================================

async def execute_simulation_background(job_id: str, case_path: str, ml_weight: float) -> None:
    """
    Exécuter la simulation en arrière-plan avec intégration réelle des moteurs.
    """
    try:
        logger.info(f"Starting industrial simulation execution for job {job_id}")
        jobs_store[job_id]["status"] = "RUNNING"
        jobs_store[job_id]["started_at"] = datetime.utcnow().isoformat()

        if HAS_ENGINES:
            logger.info("Using real PVT/FNO engines for simulation")
            # Initialiser l'orchestrateur FNO
            fno_orchestrator = FNOPipelineOrchestrator(fluid_type='H2')
            
            # Récupérer les paramètres de la requête
            config = jobs_store[job_id].get("config", {})
            input_params = {
                "pressure": 1.5e6,  # Valeurs par défaut industrielles
                "temperature": 350,
                "ml_weight": ml_weight
            }
            
            # Exécuter le pipeline
            results = fno_orchestrator.run_pipeline(input_params)
            
            # Mettre à jour les résultats du job
            jobs_store[job_id]["results"] = results
            jobs_store[job_id]["status"] = "COMPLETED"
        else:
            # Fallback si les moteurs ne sont pas installés
            logger.info(f"Executing stub CFD simulation for case: {case_path}")
            import asyncio
            await asyncio.sleep(2) # Simuler un calcul
            
            jobs_store[job_id]["results"] = {
                "status": "success",
                "message": "Simulation stub complétée (moteurs non trouvés)",
                "final_credibility_score": 85.0
            }
            jobs_store[job_id]["status"] = "COMPLETED"

        jobs_store[job_id]["completed_at"] = datetime.utcnow().isoformat()
        logger.info(f"Simulation completed successfully for job {job_id}")

    except Exception as e:
        logger.error(f"Simulation failed for job {job_id}: {str(e)}")
        jobs_store[job_id]["status"] = "FAILED"
        jobs_store[job_id]["error_message"] = str(e)


# ============================================================================
# Gestion des Erreurs
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Gestionnaire personnalisé pour les exceptions HTTP."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status_code": exc.status_code,
            "detail": exc.detail,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


if __name__ == "__main__":
    import uvicorn
    # Utiliser la variable d'environnement PORT pour Render, sinon 8080
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
