"""
FastAPI Routes for Quantum-Hybrid PGD-PINN
Exposes the hybrid model through REST API endpoints.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from pydantic import BaseModel
from typing import Dict, Optional, List
import logging
import os
import tempfile
import numpy as np

from pgd_pinn_hybrid import run_hybrid_simulation, create_hybrid_model

logger = logging.getLogger(__name__)

# ============================================================================
# Pydantic Models
# ============================================================================

class HybridSimulationRequest(BaseModel):
    """Request model for hybrid PGD-PINN simulation"""
    project_id: str
    analysis_id: str
    physics_params: Dict[str, float]
    correction_steps: int = 5
    boundary_conditions: Optional[Dict[str, List[int]]] = None

class HybridSimulationResponse(BaseModel):
    """Response model for hybrid simulation"""
    job_id: str
    status: str
    message: str
    coherence_score: Optional[float] = None

# ============================================================================
# Router Setup
# ============================================================================

router = APIRouter(prefix="/v2/hybrid", tags=["hybrid-pgd-pinn"])

# In-memory job store
hybrid_jobs_store: Dict[str, Dict] = {}

# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/submit-hybrid-simulation", response_model=HybridSimulationResponse)
async def submit_hybrid_simulation(
    request: HybridSimulationRequest,
    background_tasks: BackgroundTasks,
):
    """
    Submit a hybrid PGD-PINN simulation job.
    
    Args:
        request: Simulation request with physics parameters
        background_tasks: FastAPI background tasks
        
    Returns:
        Response with job ID and status
    """
    try:
        job_id = f"hybrid_{request.analysis_id}_{int(np.random.random() * 1e6)}"
        
        # Store job metadata
        hybrid_jobs_store[job_id] = {
            "job_id": job_id,
            "analysis_id": request.analysis_id,
            "project_id": request.project_id,
            "status": "queued",
            "coherence_score": None,
            "results": None,
            "error": None,
        }
        
        # Add background task
        background_tasks.add_task(
            _process_hybrid_simulation,
            job_id,
            request,
        )
        
        logger.info(f"[{job_id}] Hybrid simulation submitted")
        
        return HybridSimulationResponse(
            job_id=job_id,
            status="queued",
            message=f"Hybrid PGD-PINN simulation queued for analysis {request.analysis_id}",
        )
    except Exception as e:
        logger.error(f"Failed to submit hybrid simulation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/hybrid-status/{job_id}")
async def get_hybrid_status(job_id: str):
    """
    Get status of a hybrid simulation job.
    
    Args:
        job_id: Job ID
        
    Returns:
        Job status and progress
    """
    if job_id not in hybrid_jobs_store:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = hybrid_jobs_store[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "coherence_score": job["coherence_score"],
        "error": job["error"],
    }

@router.get("/hybrid-result/{job_id}")
async def get_hybrid_result(job_id: str):
    """
    Get results of a completed hybrid simulation.
    
    Args:
        job_id: Job ID
        
    Returns:
        Simulation results and predictions
    """
    if job_id not in hybrid_jobs_store:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = hybrid_jobs_store[job_id]
    
    if job["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job status is {job['status']}, not completed"
        )
    
    return {
        "job_id": job_id,
        "analysis_id": job["analysis_id"],
        "coherence_score": job["coherence_score"],
        "results": job["results"],
    }

@router.post("/upload-mesh")
async def upload_mesh(file: UploadFile = File(...)):
    """
    Upload a mesh file (STL or OBJ) for processing.
    
    Args:
        file: Mesh file (STL or OBJ)
        
    Returns:
        File path and metadata
    """
    try:
        # Validate file extension
        if not file.filename.endswith(('.stl', '.obj')):
            raise HTTPException(
                status_code=400,
                detail="File must be STL or OBJ format"
            )
        
        # Save to temporary directory
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, file.filename)
        
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        logger.info(f"Mesh uploaded: {file_path}")
        
        return {
            "filename": file.filename,
            "path": file_path,
            "size_bytes": len(content),
        }
    except Exception as e:
        logger.error(f"Failed to upload mesh: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Background Task
# ============================================================================

async def _process_hybrid_simulation(job_id: str, request: HybridSimulationRequest):
    """
    Background task to process hybrid simulation.
    
    Args:
        job_id: Job ID
        request: Simulation request
    """
    try:
        job = hybrid_jobs_store[job_id]
        job["status"] = "processing"
        
        logger.info(f"[{job_id}] Starting hybrid PGD-PINN processing")
        
        # Create dummy mesh path (in production, this would come from upload)
        mesh_path = f"/tmp/mesh_{job_id}.stl"
        
        # Create dummy mesh for testing
        _create_dummy_mesh(mesh_path)
        
        # Prepare boundary conditions
        boundary_conditions = request.boundary_conditions or {
            "wall": list(range(100)),
            "inlet": list(range(100, 150)),
            "outlet": list(range(150, 200)),
        }
        
        # Run hybrid simulation
        logger.info(f"[{job_id}] Running hybrid simulation with {request.correction_steps} correction steps")
        
        results = run_hybrid_simulation(
            mesh_path=mesh_path,
            boundary_conditions=boundary_conditions,
            physics_params=request.physics_params,
            device='cpu',
            correction_steps=request.correction_steps,
        )
        
        # Extract coherence score
        coherence_score = float(results['coherence_score'])
        
        # Store results
        job["results"] = {
            "pgd_prediction_shape": str(results['pgd_prediction'].shape),
            "corrected_prediction_shape": str(results['corrected_prediction'].shape),
            "coherence_score": coherence_score,
        }
        job["coherence_score"] = coherence_score
        job["status"] = "completed"
        
        logger.info(f"[{job_id}] Hybrid simulation completed. Coherence Score: {coherence_score:.4f}")
        
        # Cleanup
        if os.path.exists(mesh_path):
            os.remove(mesh_path)
        
    except Exception as e:
        logger.error(f"[{job_id}] Error processing hybrid simulation: {str(e)}")
        job["status"] = "failed"
        job["error"] = str(e)

def _create_dummy_mesh(path: str):
    """Create a simple dummy STL mesh for testing"""
    # Create a simple cube mesh
    vertices = np.array([
        [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
    ], dtype=np.float32)
    
    faces = np.array([
        [0, 1, 2], [0, 2, 3],  # bottom
        [4, 6, 5], [4, 7, 6],  # top
        [0, 4, 5], [0, 5, 1],  # front
        [2, 6, 7], [2, 7, 3],  # back
        [0, 3, 7], [0, 7, 4],  # left
        [1, 5, 6], [1, 6, 2],  # right
    ], dtype=np.uint32)
    
    # Write binary STL
    with open(path, 'wb') as f:
        # Header
        f.write(b'\0' * 80)
        # Number of triangles
        f.write(len(faces).to_bytes(4, 'little'))
        
        # Write triangles
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = np.cross(v1 - v0, v2 - v0)
            normal = normal / (np.linalg.norm(normal) + 1e-6)
            
            f.write(normal.astype(np.float32).tobytes())
            f.write(v0.astype(np.float32).tobytes())
            f.write(v1.astype(np.float32).tobytes())
            f.write(v2.astype(np.float32).tobytes())
            f.write(b'\0\0')  # Attribute byte count
