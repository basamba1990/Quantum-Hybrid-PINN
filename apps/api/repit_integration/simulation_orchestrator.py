"""
Simulation Orchestrator Module – Version industrielle
- Persistance réelle via Supabase
- Chargement réel de l'état CFD (pas de zeros)
- Gestion des jobs avec état persistant
- Logger configuré
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging
import json
from datetime import datetime
from dataclasses import dataclass
import uuid
import numpy as np
from supabase import create_client, Client

from .openfoam_utils import OpenFOAMUtils
from .fvmn_dataset import FVMNDataset
from .numpy_to_foam import numpyToFoam
from .hybrid_predictor import HybridSimulationConfig, MLAcceleratedPredictor
from .dataset_manager import DatasetManager

logger = logging.getLogger(__name__)


@dataclass
class SimulationJob:
    job_id: str
    name: str
    case_path: str
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    config: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "name": self.name,
            "case_path": self.case_path,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "config": self.config,
            "results": self.results,
            "error_message": self.error_message
        }


class SimulationOrchestrator:
    def __init__(self, work_dir: Optional[Path] = None):
        self.work_dir = Path(work_dir) if work_dir else Path.home() / "hybrid_simulations"
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.jobs: Dict[str, SimulationJob] = {}
        self.dataset_manager = DatasetManager()
        self.logger = logging.getLogger(self.__class__.__name__)
        
        # Initialisation Supabase pour la persistance industrielle
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Optional[Client] = None
        if self.supabase_url and self.supabase_key:
            try:
                self.supabase = create_client(self.supabase_url, self.supabase_key)
                self.logger.info("✅ Supabase client initialized for Orchestrator")
            except Exception as e:
                self.logger.error(f"❌ Failed to initialize Supabase: {e}")

    def _persist_job(self, job: SimulationJob):
        """Sauvegarde l'état du job dans Supabase si disponible, sinon en local."""
        job_dict = job.to_dict()
        
        # 1. Persistance locale (fallback)
        job_dir = self.work_dir / job.job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        with open(job_dir / "job_state.json", 'w') as f:
            json.dump(job_dict, f, indent=2)
            
        # 2. Persistance Supabase (industrielle)
        if self.supabase:
            try:
                # On utilise un upsert sur la table 'simulation_jobs'
                # Note: La table doit exister avec les colonnes correspondantes
                self.supabase.table("simulation_jobs").upsert({
                    "id": job.job_id,
                    "name": job.name,
                    "case_path": job.case_path,
                    "status": job.status,
                    "created_at": job_dict["created_at"],
                    "started_at": job_dict["started_at"],
                    "completed_at": job_dict["completed_at"],
                    "config": job.config,
                    "results": job.results,
                    "error_message": job.error_message
                }).execute()
                self.logger.info(f"Persisted job {job.job_id} to Supabase")
            except Exception as e:
                self.logger.error(f"Failed to persist job {job.job_id} to Supabase: {e}")

    def create_job(self, name: str, case_path: str, config: Optional[Dict[str, Any]] = None, job_id: Optional[str] = None) -> SimulationJob:
        actual_job_id = job_id or str(uuid.uuid4())
        job = SimulationJob(
            job_id=actual_job_id,
            name=name,
            case_path=case_path,
            status="pending",
            created_at=datetime.utcnow(),
            config=config or {}
        )
        self.jobs[actual_job_id] = job
        self._persist_job(job)
        self.logger.info(f"Created job {actual_job_id}: {name}")
        return job

    def _load_latest_state(self, case_path: Path) -> Dict[str, np.ndarray]:
        """Charge le dernier état CFD disponible (temps max) – Version Industrielle"""
        from .dataset_manager import DatasetManager
        dm = DatasetManager()
        
        if not case_path.exists():
            self.logger.error(f"❌ Case path {case_path} does not exist.")
            raise FileNotFoundError(f"Case path not found: {case_path}")

        try:
            latest_time = OpenFOAMUtils.max_time_directory(case_path)
            state = {}
            for field in ["U", "p", "T"]:
                field_file = case_path / str(latest_time) / field
                if field_file.exists():
                    state[field] = dm._load_field(field_file)
            
            if not state:
                self.logger.error(f"❌ No CFD fields found in {case_path}.")
                raise ValueError(f"No CFD fields found in {case_path}")
                
            self.logger.info(f"Loaded state at t={latest_time} with fields {list(state.keys())}")
            return state
        except Exception as e:
            self.logger.error(f"CRITICAL: Error loading state from {case_path}: {e}")
            # Suppression du fallback silencieux vers des zéros (Non Industriel)
            # Dans une application industrielle, on doit lever une erreur claire
            raise RuntimeError(f"Impossible de charger l'état initial physique depuis {case_path}. L'analyse ne peut pas continuer sans données réelles.")

    def prepare_cfd_dataset(self, job_id: str, fields: List[str], time_range: tuple, normalize: bool = True):
        if job_id not in self.jobs:
            # Tenter de charger depuis Supabase/Local si absent de la mémoire
            self._sync_job_from_storage(job_id)
            if job_id not in self.jobs:
                raise ValueError(f"Job {job_id} not found")
                
        job = self.jobs[job_id]
        case_path = job.case_path
        try:
            data, metadata = self.dataset_manager.load_cfd_dataset(
                case_path=case_path, fields=fields, time_range=time_range, normalize=normalize
            )
            dataset_path = self.work_dir / job_id / "dataset.npz"
            dataset_path.parent.mkdir(parents=True, exist_ok=True)
            self.dataset_manager.save_dataset(data, metadata, dataset_path)
            return {
                "status": "success",
                "dataset_path": str(dataset_path),
                "n_samples": metadata.n_samples,
                "fields": metadata.fields,
                "shape": data.shape,
                "normalized": metadata.normalized
            }
        except Exception as e:
            self.logger.error(f"Dataset preparation failed: {e}")
            return {"status": "failed", "error": str(e)}

    def _sync_job_from_storage(self, job_id: str):
        """Tente de synchroniser un job depuis Supabase ou le stockage local."""
        # 1. Essayer Supabase
        if self.supabase:
            try:
                response = self.supabase.table("simulation_jobs").select("*").eq("id", job_id).execute()
                if response.data:
                    data = response.data[0]
                    job = SimulationJob(
                        job_id=data["id"],
                        name=data["name"],
                        case_path=data["case_path"],
                        status=data["status"],
                        created_at=datetime.fromisoformat(data["created_at"].replace('Z', '+00:00')),
                        started_at=datetime.fromisoformat(data["started_at"].replace('Z', '+00:00')) if data["started_at"] else None,
                        completed_at=datetime.fromisoformat(data["completed_at"].replace('Z', '+00:00')) if data["completed_at"] else None,
                        config=data["config"],
                        results=data["results"],
                        error_message=data["error_message"]
                    )
                    self.jobs[job_id] = job
                    return
            except Exception as e:
                self.logger.warning(f"Failed to sync job {job_id} from Supabase: {e}")

        # 2. Essayer Local
        local_path = self.work_dir / job_id / "job_state.json"
        if local_path.exists():
            try:
                with open(local_path, 'r') as f:
                    data = json.load(f)
                    job = SimulationJob(
                        job_id=data["job_id"],
                        name=data["name"],
                        case_path=data["case_path"],
                        status=data["status"],
                        created_at=datetime.fromisoformat(data["created_at"]),
                        started_at=datetime.fromisoformat(data["started_at"]) if data["started_at"] else None,
                        completed_at=datetime.fromisoformat(data["completed_at"]) if data["completed_at"] else None,
                        config=data["config"],
                        results=data["results"],
                        error_message=data["error_message"]
                    )
                    self.jobs[job_id] = job
            except Exception as e:
                self.logger.error(f"Failed to sync job {job_id} from local storage: {e}")

    def run_cfd_simulation(self, job_id: str, solver: str = "buoyantBoussinesqPimpleFoam", n_processors: int = 1):
        if job_id not in self.jobs:
            self._sync_job_from_storage(job_id)
            if job_id not in self.jobs:
                raise ValueError(f"Job {job_id} not found")
        
        job = self.jobs[job_id]
        job.status = "running"
        job.started_at = datetime.utcnow()
        self._persist_job(job)
        
        try:
            foam_utils = OpenFOAMUtils(job.case_path)
            log_decompose = ""
            if n_processors > 1:
                log_decompose = foam_utils.decompose_case(n_processors)
            log_solver = foam_utils.run_solver(solver, n_processors)
            log_reconstruct = ""
            if n_processors > 1:
                log_reconstruct = foam_utils.reconstruct_case()
            full_log = f"Decompose:\n{log_decompose}\n\nSolver:\n{log_solver}\n\nReconstruct:\n{log_reconstruct}"
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.results = {"status": "success", "log": full_log, "output_path": str(Path(job.case_path) / "reconstructed_results")}
            self._persist_job(job)
            return job.results
        except Exception as e:
            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            self._persist_job(job)
            return {"status": "failed", "error": str(e)}

    def run_hybrid_simulation(self, job_id: str, ml_model=None, n_steps: int = 100,
                              time_step: float = 0.01, residual_threshold: float = 0.01,
                              uvw_mean: float = 0.0, uvw_std: float = 1.0) -> Dict[str, Any]:
        if job_id not in self.jobs:
            self._sync_job_from_storage(job_id)
            if job_id not in self.jobs:
                raise ValueError(f"Job {job_id} not found")
                
        job = self.jobs[job_id]
        job.status = "running"
        job.started_at = datetime.utcnow()
        self._persist_job(job)
        
        try:
            config = HybridSimulationConfig(
                case_path=job.case_path,
                ml_model_path=None,
                n_processors=1,
                max_iterations=n_steps,
                residual_threshold=residual_threshold,
                enable_warp=job.config.get("enable_warp", False),
                enable_multiphase=job.config.get("enable_multiphase", False),
                enable_shock_capturing=job.config.get("enable_shock_capturing", False)
            )
            predictor = MLAcceleratedPredictor(config, ml_model=ml_model, uvw_mean=uvw_mean, uvw_std=uvw_std)

            # Chargement de l'état réel (Lève une erreur si absent)
            initial_state = self._load_latest_state(Path(job.case_path))

            result = predictor.run_hybrid_simulation(
                initial_state=initial_state,
                n_steps=n_steps,
                time_step=time_step,
                dx=None
            )

            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.results = {
                "status": result.status,
                "iteration": result.iteration,
                "cfd_time": result.cfd_time,
                "ml_time": result.ml_time,
                "residuals": result.residuals,
                "credibility_score": getattr(result, "credibility_score", 0.0),
                "log": result.log,
                "error_message": result.error_message
            }
            self._persist_job(job)
            return job.results
        except Exception as e:
            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            self._persist_job(job)
            return {"status": "failed", "error": str(e)}

    def reinject_predictions(self, job_id: str, field_name: str, data: List[List[float]], time_step: float):
        if job_id not in self.jobs:
            self._sync_job_from_storage(job_id)
            if job_id not in self.jobs:
                raise ValueError(f"Job {job_id} not found")
        try:
            # Implémentation réelle de la réinjection dans les fichiers OpenFOAM
            case_path = Path(self.jobs[job_id].case_path)
            time_dir = case_path / str(time_step)
            time_dir.mkdir(parents=True, exist_ok=True)
            
            # Conversion numpy et écriture via numpyToFoam
            data_np = np.array(data)
            numpyToFoam(data_np, field_name, time_dir / field_name)
            
            return {"status": "success", "message": f"Reinjected {field_name} at t={time_step}", "field": field_name, "time_step": time_step}
        except Exception as e:
            self.logger.error(f"Reinjection failed: {e}")
            return {"status": "failed", "error": str(e)}

    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        if job_id not in self.jobs:
            self._sync_job_from_storage(job_id)
            if job_id not in self.jobs:
                raise ValueError(f"Job {job_id} not found")
        return self.jobs[job_id].to_dict()

    def list_jobs(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        # Pour une version industrielle, on devrait lister depuis Supabase
        if self.supabase:
            try:
                query = self.supabase.table("simulation_jobs").select("*")
                if status:
                    query = query.eq("status", status)
                response = query.execute()
                return response.data
            except Exception as e:
                self.logger.error(f"Failed to list jobs from Supabase: {e}")
        
        # Fallback local
        jobs = list(self.jobs.values())
        if status:
            jobs = [j for j in jobs if j.status == status]
        return [j.to_dict() for j in jobs]

    def save_job_state(self, job_id: str, output_path: Optional[Path] = None) -> Path:
        if job_id not in self.jobs:
            self._sync_job_from_storage(job_id)
            if job_id not in self.jobs:
                raise ValueError(f"Job {job_id} not found")
        if output_path is None:
            output_path = self.work_dir / job_id / "job_state.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(self.jobs[job_id].to_dict(), f, indent=2, default=str)
        return output_path
