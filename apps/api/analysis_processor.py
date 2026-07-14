"""
Analysis Processor for Quantum-Hybrid PINN
Handles analysis submission, processing, and status updates
"""

import asyncio
import numpy as np
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import httpx
import torch
from pgd_pinn_hybrid import run_hybrid_simulation

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# Pydantic Models
# ============================================================================

class AnalysisSubmissionRequest(BaseModel):
    projectId: str
    analysisId: str
    name: str
    transcription: Optional[str] = None
    description: Optional[str] = None
    userId: str
    scenario_type: Optional[str] = "H2_PIPELINE"
    scenario_inputs: Optional[Dict[str, Any]] = {}

class AnalysisResponse(BaseModel):
    jobId: str
    analysisId: str
    status: str
    message: str

# ============================================================================
# Analysis Processor
# ============================================================================

class AnalysisProcessor:
    """Processes PINN analyses submitted from the web frontend"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.jobs: Dict[str, Dict[str, Any]] = {}
    
    async def submit_analysis(self, request: AnalysisSubmissionRequest) -> Dict[str, Any]:
        """
        Submit an analysis for processing
        """
        job_id = f"analysis_{request.analysisId}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        logger.info(f"[{job_id}] Submitting analysis: {request.name}")
        
        # Store job metadata
        self.jobs[job_id] = {
            "jobId": job_id,
            "analysisId": request.analysisId,
            "projectId": request.projectId,
            "name": request.name,
            "status": "queued",
            "progress": 0,
            "createdAt": datetime.now().isoformat(),
            "results": None,
            "error": None,
        }
        
        return {
            "jobId": job_id,
            "analysisId": request.analysisId,
            "status": "queued",
            "message": f"Analysis {request.name} submitted for processing"
        }
    
    async def process_analysis(self, job_id: str, request: AnalysisSubmissionRequest):
        """
        Process analysis in background
        """
        try:
            job = self.jobs.get(job_id)
            if not job:
                logger.error(f"Job {job_id} not found")
                return
            
            # Update status to processing
            job["status"] = "processing"
            logger.info(f"[{job_id}] Starting analysis processing")
            
            # Step 1: Extract physics parameters from transcription
            logger.info(f"[{job_id}] Extracting physics parameters from transcription")
            job["progress"] = 20
            
            physics_params = await self._extract_physics_params(
                request.transcription or request.description or ""
            )
            
            # Step 2: Run PINN simulation
            logger.info(f"[{job_id}] Running PINN simulation")
            job["progress"] = 40
            
            pinn_results = await self._run_pinn_simulation(physics_params, request.projectId, request.scenario_type)
            
            # Step 3: Validate results
            logger.info(f"[{job_id}] Validating simulation results")
            job["progress"] = 70
            
            validation_results = await self._validate_results(pinn_results)
            
            # Step 4: Generate 3D predictions
            logger.info(f"[{job_id}] Generating 3D field predictions")
            job["progress"] = 85
            
            predictions_3d = await self._generate_3d_predictions(pinn_results, request.scenario_type, physics_params)
            
            # Step 5: Calculate credibility score
            logger.info(f"[{job_id}] Calculating credibility score")
            job["progress"] = 95
            
            credibility_score = await self._calculate_credibility_score(
                validation_results,
                pinn_results
            )
            
            # Store results
            job["results"] = {
                "physicsParams": physics_params,
                "pinn_results": pinn_results,
                "validation": validation_results,
                "predictions3d": predictions_3d,
                "credibilityScore": credibility_score,
            }
            
            job["status"] = "completed"
            job["progress"] = 100
            
            logger.info(f"[{job_id}] Analysis completed successfully")
            logger.info(f"[{job_id}] Credibility Score: {credibility_score:.2%}")
            
            # Update Supabase with results
            await self._update_supabase_analysis(
                request.analysisId,
                "completed",
                credibility_score,
                job["results"]
            )
            
        except Exception as e:
            logger.error(f"[{job_id}] Error processing analysis: {str(e)}")
            job["status"] = "failed"
            job["error"] = str(e)
            job["progress"] = 0
            
            # Update Supabase with error
            await self._update_supabase_analysis(
                request.analysisId,
                "failed",
                None,
                {"error": str(e)}
            )
    
    async def _extract_physics_params(self, transcription: str) -> Dict[str, Any]:
        """Extract physics parameters from transcription (V8.3 Improved)"""
        import re
        
        def extract_val(pattern, text, default):
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1).replace(',', '.'))
                except:
                    return default
            return default

        # Extraction dynamique basée sur le texte
        pressure = extract_val(r"(?:pression|pressure)\s*:?\s*(\d+(?:[.,]\d+)?)", transcription, 80.0)
        temp = extract_val(r"(?:température|temperature)\s*:?\s*(\d+(?:[.,]\d+)?)", transcription, 300.0)
        diameter = extract_val(r"(?:diamètre|diameter)\s*:?\s*(\d+(?:[.,]\d+)?)", transcription, 0.5)
        flow_rate = extract_val(r"(?:débit|flow\s*rate)\s*:?\s*(\d+(?:[.,]\d+)?)", transcription, 2.0)
        
        params = {
            "pressure": pressure,
            "temperature": temp,
            "diameter": diameter,
            "flow_rate": flow_rate,
            "reynolds_number": (1.0 * flow_rate * diameter) / 8.8e-6, # Approximation
            "inlet_velocity": flow_rate / (3.14 * (diameter/2)**2 * 1.0),
            "inlet_temperature": temp,
            "geometry": {
                "diameter": diameter,
                "length": extract_val(r"(?:longueur|length)\s*:?\s*(\d+(?:[.,]\d+)?)", transcription, 100.0)
            }
        }
        return params
    
    async def _run_pinn_simulation(self, physics_params: Dict[str, Any], project_id: str, scenario_type: str = "H2_PIPELINE") -> Dict[str, Any]:
        """Run Industrial Hybrid PGD-PINN simulation (V8.3 - No Hardcoding)"""
        logger.info(f"Running Industrial Hybrid PGD-PINN simulation for project {project_id}")
        
        from hydrogen_pinn_tfc_v8 import HydrogenPINNTFCV8, get_device

        device = get_device()

        # Déterminer la géométrie et les paramètres
        geometry_type = scenario_type.lower()
        geometry_params = {}
        fluid_type = physics_params.get("fluid_type", "H2")

        if geometry_type == "h2_pipeline":
            geometry_type = "pipeline"
            geometry_params = {
                "radius": physics_params.get("diameter", 0.5) / 2,
                "length": physics_params.get("geometry", {}).get("length", 100.0),
                "inlet_velocity": physics_params.get("inlet_velocity", 1.0),
                "outlet_pressure": physics_params.get("outlet_pressure", 101325.0),
                "wall_temperature": physics_params.get("wall_temperature", 293.15)
            }
        elif geometry_type == "lh2_storage":
            geometry_type = "sphere"
            geometry_params = {
                "radius": physics_params.get("diameter", 4.57) / 2, # Diamètre typique de réservoir LH2
                "surface_temperature": physics_params.get("surface_temperature", 20.28) # Point d'ébullition LH2
            }
        elif geometry_type == "salt_cavern":
            geometry_params = {
                "x_center": physics_params.get("x_center", 0.0),
                "y_center": physics_params.get("y_center", 0.0),
                "z_center": physics_params.get("z_center", -1000.0),
                "major_radius": physics_params.get("major_radius", 100.0),
                "minor_radius": physics_params.get("minor_radius", 50.0),
                "cavern_temperature": physics_params.get("cavern_temperature", 300.0)
            }
        elif geometry_type == "rock_elast_stress":
            geometry_type = "box"
            geometry_params = {
                "x_min": physics_params.get("x_min", -50.0),
                "x_max": physics_params.get("x_max", 50.0),
                "y_min": physics_params.get("y_min", -50.0),
                "y_max": physics_params.get("y_max", 50.0),
                "z_min": physics_params.get("z_min", -physics_params.get("depth", 1000.0)),
                "z_max": physics_params.get("z_max", 0.0)
            }
        else:
            # Géométrie par défaut (boîte)
            geometry_type = "box"
            geometry_params = {
                "x_min": -1.0, "x_max": 1.0,
                "y_min": -1.0, "y_max": 1.0,
                "z_min": -1.0, "z_max": 1.0
            }

        # Initialisation du modèle PINN
        pinn_instance = HydrogenPINNTFCV8(
            fluid_type=fluid_type,
            geometry_type=geometry_type,
            geometry_params=geometry_params
        )

        # Entraînement du modèle PINN
        epochs = physics_params.get("epochs", 5000) # Nombre d'epochs configurable
        learning_rate = physics_params.get("learning_rate", 1e-3)
        N_pde = physics_params.get("N_pde", 5000)

        logger.info(f"[{project_id}] Entraînement du PINN pour {epochs} epochs...")
        training_history = pinn_instance.train_pinn(epochs=epochs, learning_rate=learning_rate, N_pde=N_pde)
        logger.info(f"[{project_id}] Entraînement PINN terminé. Perte finale: {training_history['loss'][-1]:.6e}")

        # Calcul des résidus moyens pour évaluer la convergence
        # Échantillonner des points pour le calcul des résidus
        N_eval_points = 1000
        t_eval, x_eval, y_eval, z_eval = pinn_instance.geometry_handler.get_sampling_points(N_eval_points)
        t_eval = t_eval.to(device).requires_grad_(True)
        x_eval = x_eval.to(device).requires_grad_(True)
        y_eval = y_eval.to(device).requires_grad_(True)
        z_eval = z_eval.to(device).requires_grad_(True)

        rho_pred, u_pred, v_pred, w_pred, T_pred = pinn_instance.pinn_model(t_eval, x_eval, y_eval, z_eval)
        mass_res, mom_x_res, mom_y_res, mom_z_res, energy_res = pinn_instance.pinn_model.compute_residuals(
            t_eval, x_eval, y_eval, z_eval, rho_pred, u_pred, v_pred, w_pred, T_pred, scale_dict=pinn_instance.scales
        )

        residual_norm = torch.sqrt(torch.mean(mass_res**2) + torch.mean(mom_x_res**2) + 
                                   torch.mean(mom_y_res**2) + torch.mean(mom_z_res**2) + 
                                   torch.mean(energy_res**2)).item()

        # Stocker l'instance du modèle pour les prédictions 3D ultérieures
        self.jobs[project_id]["pinn_instance"] = pinn_instance

        results = {
            "training_loss_history": training_history["loss"],
            "final_training_loss": training_history["loss"][-1],
            "residual_norm": residual_norm,
            "fluid_type": fluid_type,
            "geometry_type": geometry_type,
            "geometry_params": geometry_params,
            # Ajoutez d'autres métriques pertinentes si nécessaire
        }
        return results
    
    async def _validate_results(self, pinn_results: Dict[str, Any]) -> Dict[str, Any]:
        """Validate PINN results against physical constraints by checking conservation laws."""
        job = self.jobs.get(pinn_results["projectId"])
        if not job or "pinn_instance" not in job:
            logger.error(f"No PINN instance found for project {pinn_results['projectId']}")
            return {"validation_status": "failed", "reason": "PINN instance not found"}

        pinn_instance = job["pinn_instance"]
        device = pinn_instance.device

        # Use a fresh set of sampling points for validation to avoid overfitting to training points
        N_validation_points = 2000 # Augmenter le nombre de points pour une validation plus robuste
        t_val, x_val, y_val, z_val = pinn_instance.geometry_handler.get_sampling_points(N_validation_points)
        t_val = t_val.to(device).requires_grad_(True)
        x_val = x_val.to(device).requires_grad_(True)
        y_val = y_val.to(device).requires_grad_(True)
        z_val = z_val.to(device).requires_grad_(True)

        # Obtenir les prédictions du modèle PINN
        rho_pred, u_pred, v_pred, w_pred, T_pred = pinn_instance.pinn_model(t_val, x_val, y_val, z_val)

        # Calculer les résidus des équations de conservation
        mass_res, mom_x_res, mom_y_res, mom_z_res, energy_res = pinn_instance.pinn_model.compute_residuals(
            t_val, x_val, y_val, z_val, rho_pred, u_pred, v_pred, w_pred, T_pred, scale_dict=pinn_instance.scales
        )

        # Évaluer la conservation des lois
        # Utiliser la moyenne absolue des résidus comme métrique de validation
        mass_conservation_error = torch.abs(mass_res).mean().item()
        momentum_conservation_error = (torch.abs(mom_x_res).mean() + torch.abs(mom_y_res).mean() + torch.abs(mom_z_res).mean()).item() / 3.0
        energy_conservation_error = torch.abs(energy_res).mean().item()

        # Définir des seuils de tolérance pour la validation industrielle
        # Ces seuils peuvent être ajustés en fonction des exigences spécifiques de l'industrie
        MASS_TOLERANCE = 1e-4
        MOMENTUM_TOLERANCE = 1e-4
        ENERGY_TOLERANCE = 1e-4

        mass_conserved = mass_conservation_error < MASS_TOLERANCE
        momentum_conserved = momentum_conservation_error < MOMENTUM_TOLERANCE
        energy_conserved = energy_conservation_error < ENERGY_TOLERANCE

        validation_status = "passed" if (mass_conserved and momentum_conserved and energy_conserved) else "failed"

        validation = {
            "validation_status": validation_status,
            "mass_conservation_error": mass_conservation_error,
            "momentum_conservation_error": momentum_conservation_error,
            "energy_conservation_error": energy_conservation_error,
            "mass_conserved": mass_conserved,
            "momentum_conserved": momentum_conserved,
            "energy_conserved": energy_conserved,
            "overall_physical_coherence": mass_conserved and momentum_conserved and energy_conserved,
            "pinn_residual_norm": pinn_results["residual_norm"]
        }
        return validation
    
    async def _generate_3d_predictions(self, pinn_results: Dict[str, Any], scenario_type: str = 'H2_PIPELINE', physics_params: Dict[str, Any] = {}) -> list:
        """Generate Truly-Industrial Parametric 3D Geometries (V8.5)"""
        predictions = []
        N_points = 1200 # Résolution accrue pour géométries complexes

        job = self.jobs.get(pinn_results["projectId"])
        if not job or "pinn_instance" not in job:
            logger.error(f"No PINN instance found for project {pinn_results["projectId"]}")
            return []

        pinn_instance = job["pinn_instance"]
        device = pinn_instance.device

        # Générer des points d'échantillonnage pour la visualisation 3D
        t_vis, x_vis, y_vis, z_vis = pinn_instance.geometry_handler.get_sampling_points(N_points)
        t_vis = t_vis.to(device)
        x_vis = x_vis.to(device)
        y_vis = y_vis.to(device)
        z_vis = z_vis.to(device)

        # Obtenir les prédictions du modèle PINN
        with torch.no_grad():
            rho_pred, u_pred, v_pred, w_pred, T_pred = pinn_instance.pinn_model(t_vis, x_vis, y_vis, z_vis)
            p_pred = pinn_instance.pinn_model.get_pressure(rho_pred, T_pred, pinn_instance.fluid_type)
            vel_mag_pred = torch.sqrt(u_pred**2 + v_pred**2 + w_pred**2)

        # Convertir en liste de dictionnaires pour la réponse API
        for i in range(N_points):
            predictions.append({
                'x': x_vis[i].item(),
                'y': y_vis[i].item(),
                'z': z_vis[i].item(),
                'time': t_vis[i].item(),
                'pressure': p_pred[i].item(),
                'temperature': T_pred[i].item(),
                'density': rho_pred[i].item(),
                'velocity_u': u_pred[i].item(),
                'velocity_v': v_pred[i].item(),
                'velocity_w': w_pred[i].item(),
                'velocity_magnitude': vel_mag_pred[i].item()
            })
                        
        return predictions

    async def _calculate_credibility_score(self, validation: Dict[str, Any], pinn_results: Dict[str, Any]) -> float:
        """Calculate overall credibility score"""
        score = 0.0
        
        # Convergence score (40%)
        convergence_score = min(pinn_results["convergence_rate"], 1.0)
        score += convergence_score * 0.4
        
        # Validation score (40%)
        validation_checks = sum(1 for v in validation.values() if v is True)
        validation_score = validation_checks / len(validation)
        score += validation_score * 0.4
        
        # Residual score (20%)
        residual_score = max(0, 1.0 - (pinn_results["residual_norm"] / 1e-4))
        score += residual_score * 0.2
        
        return min(max(score, 0.0), 1.0)  # Clamp between 0 and 1
    
    async def _update_supabase_analysis(
        self,
        analysis_id: str,
        status: str,
        credibility_score: Optional[float],
        results: Dict[str, Any]
    ):
        """Update analysis in Supabase directly"""
        try:
            from supabase import create_client
            import os
            
            supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL', '')
            supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_SERVICE_KEY', '')
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not found in environment")
                return
            
            supabase = create_client(supabase_url, supabase_key)
            
            # Prepare update data
            from datetime import datetime
            update_data = {
                "status": status,
                "credibility_score": round(credibility_score * 100, 2) if credibility_score else None,
                "results": results,
                "updated_at": datetime.utcnow().isoformat(),
                "scenario_type": results.get("scenario_outputs", {}).get("scenario_type", "H2_PIPELINE")
            }
            
            # Update the analysis record in Supabase
            response = supabase.table("analyses").update(update_data).eq("id", analysis_id).execute()
            
            logger.info(f"✅ Supabase updated: analysis {analysis_id} status={status}, credibility_score={credibility_score}")
            
        except Exception as e:
            logger.error(f"❌ Failed to update Supabase analysis {analysis_id}: {str(e)}", exc_info=True)
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status"""
        return self.jobs.get(job_id)
    
    def get_job_result(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job result"""
        job = self.jobs.get(job_id)
        if job and job["status"] == "completed":
            return job["results"]
        return None

# ============================================================================
# FastAPI Router
# ============================================================================

router = APIRouter(prefix="/v2", tags=["analysis"])

# Global processor instance
processor: Optional[AnalysisProcessor] = None

def init_processor(supabase_url: str, supabase_key: str):
    """Initialize the analysis processor"""
    global processor
    processor = AnalysisProcessor(supabase_url, supabase_key)

@router.post("/submit-analysis", response_model=AnalysisResponse)
async def submit_analysis(request: AnalysisSubmissionRequest, background_tasks: BackgroundTasks):
    """
    Submit an analysis for processing
    """
    if not processor:
        raise HTTPException(status_code=500, detail="Analysis processor not initialized")
    
    try:
        # Submit analysis and get job ID
        result = await processor.submit_analysis(request)
        
        # Add background task to process analysis
        background_tasks.add_task(processor.process_analysis, result["jobId"], request)
        
        return AnalysisResponse(
            jobId=result["jobId"],
            analysisId=result["analysisId"],
            status=result["status"],
            message=result["message"]
        )
    except Exception as e:
        logger.error(f"Failed to submit analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analysis-status/{job_id}")
async def get_analysis_status(job_id: str):
    """Get analysis processing status"""
    if not processor:
        raise HTTPException(status_code=500, detail="Analysis processor not initialized")
    
    job = processor.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "jobId": job["jobId"],
        "analysisId": job["analysisId"],
        "status": job["status"],
        "progress": job["progress"],
        "createdAt": job["createdAt"],
        "error": job["error"],
    }

@router.get("/analysis-result/{job_id}")
async def get_analysis_result(job_id: str):
    """Get analysis result"""
    if not processor:
        raise HTTPException(status_code=500, detail="Analysis processor not initialized")
    
    result = processor.get_job_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found or still processing")
    
    return result
