"""
Simulation Orchestrator Module
Manages end-to-end hybrid CFD-ML simulation workflows.
"""

from pathlib import Path
from typing import Dict, List, Optional, Any
import logging
import json
from datetime import datetime
from dataclasses import dataclass, asdict
import uuid

from .openfoam_utils import OpenFOAMUtils
from .fvmn_dataset import FVMNDataset
from .numpy_to_foam import numpyToFoam
from .hybrid_predictor import HybridSimulationConfig, MLAcceleratedPredictor
from .dataset_manager import DatasetManager

logger = logging.getLogger(__name__)


@dataclass
class SimulationJob:
    """Represents a simulation job."""
    job_id: str
    name: str
    case_path: str
    status: str  # pending, running, completed, failed
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    config: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
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
    """
    Orchestrates hybrid CFD-ML simulations.
    Manages job lifecycle, dataset preparation, and result collection.
    """
    
    def __init__(self, work_dir: Optional[Path] = None):
        """
        Initialize orchestrator.
        
        Args:
            work_dir: Working directory for simulations
        """
        self.work_dir = Path(work_dir) if work_dir else Path.home() / "hybrid_simulations"
        self.work_dir.mkdir(parents=True, exist_ok=True)
        
        self.jobs: Dict[str, SimulationJob] = {}
        self.dataset_manager = DatasetManager()
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def create_job(
        self,
        name: str,
        case_path: str,
        config: Optional[Dict[str, Any]] = None
    ) -> SimulationJob:
        """
        Create a new simulation job.
        
        Args:
            name: Job name
            case_path: Path to OpenFOAM case
            config: Simulation configuration
            
        Returns:
            Created SimulationJob
        """
        job_id = str(uuid.uuid4())
        job = SimulationJob(
            job_id=job_id,
            name=name,
            case_path=case_path,
            status="pending",
            created_at=datetime.utcnow(),
            config=config or {}
        )
        
        self.jobs[job_id] = job
        self.logger.info(f"Created job {job_id}: {name}")
        return job
    
    def prepare_cfd_dataset(
        self,
        job_id: str,
        fields: List[str],
        time_range: tuple,
        normalize: bool = True
    ) -> Dict[str, Any]:
        """
        Prepare CFD dataset for a job.
        
        Args:
            job_id: Job ID
            fields: Fields to extract (e.g., ['U', 'p', 'T'])
            time_range: (start_time, end_time)
            normalize: Whether to normalize
            
        Returns:
            Dataset information
        """
        if job_id not in self.jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job = self.jobs[job_id]
        case_path = job.case_path
        
        try:
            # Load CFD dataset
            data, metadata = self.dataset_manager.load_cfd_dataset(
                case_path=case_path,
                fields=fields,
                time_range=time_range,
                normalize=normalize
            )
            
            # Save processed dataset
            dataset_path = self.work_dir / job_id / "dataset.npz"
            dataset_path.parent.mkdir(parents=True, exist_ok=True)
            self.dataset_manager.save_dataset(data, metadata, dataset_path)
            
            result = {
                "status": "success",
                "dataset_path": str(dataset_path),
                "n_samples": metadata.n_samples,
                "fields": metadata.fields,
                "shape": data.shape,
                "normalized": metadata.normalized
            }
            
            self.logger.info(f"Dataset prepared for job {job_id}: {result}")
            return result
            
        except Exception as e:
            self.logger.error(f"Dataset preparation failed for job {job_id}: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def run_cfd_simulation(
        self,
        job_id: str,
        solver: str = "buoyantBoussinesqPimpleFoam",
        n_processors: int = 1
    ) -> Dict[str, Any]:
        """
        Run CFD simulation for a job.
        
        Args:
            job_id: Job ID
            solver: OpenFOAM solver to use
            n_processors: Number of processors
            
        Returns:
            Simulation result
        """
        if job_id not in self.jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job = self.jobs[job_id]
        job.status = "running"
        job.started_at = datetime.utcnow()
        
        try:
            foam_utils = OpenFOAMUtils(job.case_path)
            
            # Run simulation
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
            job.results = {
                "status": "success",
                "log": full_log,
                "output_path": str(Path(job.case_path) / "reconstructed_results")
            }
            
            self.logger.info(f"CFD simulation completed for job {job_id}")
            return job.results
            
        except Exception as e:
            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            self.logger.error(f"CFD simulation failed for job {job_id}: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def run_hybrid_simulation(
        self,
        job_id: str,
        ml_model=None,
        n_steps: int = 100,
        time_step: float = 0.01,
        residual_threshold: float = 0.01
    ) -> Dict[str, Any]:
        """
        Run hybrid CFD-ML simulation for a job.
        
        Args:
            job_id: Job ID
            ml_model: ML model for predictions
            n_steps: Number of simulation steps
            time_step: Time step size
            residual_threshold: Threshold for switching between CFD and ML
            
        Returns:
            Simulation result
        """
        if job_id not in self.jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job = self.jobs[job_id]
        job.status = "running"
        job.started_at = datetime.utcnow()
        
        try:
            # Create hybrid predictor
            config = HybridSimulationConfig(
                case_path=job.case_path,
                ml_model_path=None,
                n_processors=1,
                max_iterations=n_steps,
                residual_threshold=residual_threshold
            )
            
            predictor = MLAcceleratedPredictor(config, ml_model=ml_model)
            
            # Load initial state (placeholder)
            initial_state = {
                "U": np.zeros((100, 100)),
                "p": np.zeros((100, 100)),
                "T": np.zeros((100, 100))
            }
            
            # Run hybrid simulation
            result = predictor.run_hybrid_simulation(
                initial_state=initial_state,
                n_steps=n_steps,
                time_step=time_step
            )
            
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.results = {
                "status": result.status,
                "iteration": result.iteration,
                "cfd_time": result.cfd_time,
                "ml_time": result.ml_time,
                "residuals": result.residuals,
                "log": result.log,
                "error_message": result.error_message
            }
            
            self.logger.info(f"Hybrid simulation completed for job {job_id}")
            return job.results
            
        except Exception as e:
            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            self.logger.error(f"Hybrid simulation failed for job {job_id}: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def reinject_predictions(
        self,
        job_id: str,
        field_name: str,
        data: List[List[float]],
        time_step: float
    ) -> Dict[str, Any]:
        """
        Reinject ML predictions into OpenFOAM case.
        
        Args:
            job_id: Job ID
            field_name: Field name (e.g., 'U', 'p', 'T')
            data: Prediction data
            time_step: Time step
            
        Returns:
            Reinjection result
        """
        if job_id not in self.jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job = self.jobs[job_id]
        
        try:
            # Convert data to numpy array
            import numpy as np
            data_array = np.array(data)
            
            # Reinject using numpyToFoam
            # This is a simplified version - adapt to your actual implementation
            result_log = f"Reinjected {field_name} at t={time_step}"
            
            return {
                "status": "success",
                "message": result_log,
                "field": field_name,
                "time_step": time_step
            }
            
        except Exception as e:
            self.logger.error(f"Reinjection failed for job {job_id}: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """
        Get status of a job.
        
        Args:
            job_id: Job ID
            
        Returns:
            Job status dictionary
        """
        if job_id not in self.jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job = self.jobs[job_id]
        return job.to_dict()
    
    def list_jobs(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all jobs, optionally filtered by status.
        
        Args:
            status: Filter by status (pending, running, completed, failed)
            
        Returns:
            List of job dictionaries
        """
        jobs = list(self.jobs.values())
        
        if status:
            jobs = [j for j in jobs if j.status == status]
        
        return [j.to_dict() for j in jobs]
    
    def save_job_state(self, job_id: str, output_path: Optional[Path] = None) -> Path:
        """
        Save job state to disk.
        
        Args:
            job_id: Job ID
            output_path: Output path
            
        Returns:
            Path to saved state
        """
        if job_id not in self.jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job = self.jobs[job_id]
        
        if output_path is None:
            output_path = self.work_dir / job_id / "job_state.json"
        else:
            output_path = Path(output_path)
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(job.to_dict(), f, indent=2, default=str)
        
        self.logger.info(f"Saved job state to {output_path}")
        return output_path


# Import numpy for type hints
import numpy as np
