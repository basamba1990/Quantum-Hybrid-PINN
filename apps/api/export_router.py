"""
Export Router for Quantum-Hybrid PINN API
Provides endpoints for exporting simulation results in various formats
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from export_service import ExportService
import io

router = APIRouter(prefix="/v2/export", tags=["export"])


class ExportRequest(BaseModel):
    """Request model for export operations"""
    job_id: str
    format: str = "json"  # json, csv, full-report


class PredictionsExportRequest(BaseModel):
    """Request model for predictions export"""
    predictions_3d: List[Dict[str, Any]]
    include_residuals: bool = True
    format: str = "csv"  # csv or json


class AuditExportRequest(BaseModel):
    """Request model for audit data export"""
    audit_data: Dict[str, Any]
    format: str = "csv"  # csv or json


class SimulationExportRequest(BaseModel):
    """Request model for complete simulation export"""
    simulation_id: str
    project_name: str
    parameters: Dict[str, Any]
    audit_data: Dict[str, Any]
    predictions_3d: List[Dict[str, Any]]
    temporal_predictions: Optional[List[Dict[str, Any]]] = None
    confidence_metrics: Optional[Dict[str, Any]] = None


@router.post("/predictions/csv")
async def export_predictions_csv(request: PredictionsExportRequest):
    """
    Export 3D predictions to CSV format
    
    Returns:
        CSV file with predictions data
    """
    try:
        csv_content = ExportService.predictions_to_csv(request.predictions_3d)
        
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=predictions.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV export failed: {str(e)}")


@router.post("/predictions/json")
async def export_predictions_json(request: PredictionsExportRequest):
    """
    Export 3D predictions to JSON format
    
    Returns:
        JSON file with predictions data
    """
    try:
        json_content = ExportService.predictions_to_json(request.predictions_3d)
        
        return StreamingResponse(
            iter([json_content]),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=predictions.json"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JSON export failed: {str(e)}")


@router.post("/residuals/csv")
async def export_residuals_csv(request: PredictionsExportRequest):
    """
    Export residuals analysis to CSV format
    
    Returns:
        CSV file with residuals analysis
    """
    try:
        csv_content = ExportService.residuals_to_csv(request.predictions_3d)
        
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=residuals_analysis.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Residuals export failed: {str(e)}")


@router.post("/audit/csv")
async def export_audit_csv(request: AuditExportRequest):
    """
    Export audit data to CSV format
    
    Returns:
        CSV file with audit data
    """
    try:
        csv_content = ExportService.audit_to_csv(request.audit_data)
        
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_report.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit export failed: {str(e)}")


@router.post("/simulation/json")
async def export_simulation_json(request: SimulationExportRequest):
    """
    Export complete simulation to JSON format
    
    Returns:
        JSON file with complete simulation data
    """
    try:
        json_content = ExportService.simulation_to_json(
            simulation_id=request.simulation_id,
            project_name=request.project_name,
            parameters=request.parameters,
            audit_data=request.audit_data,
            predictions_3d=request.predictions_3d,
            temporal_predictions=request.temporal_predictions,
            confidence_metrics=request.confidence_metrics
        )
        
        return StreamingResponse(
            iter([json_content]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=simulation_{request.simulation_id}.json"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation export failed: {str(e)}")


@router.post("/simulation/csv")
async def export_simulation_csv(request: SimulationExportRequest):
    """
    Export simulation predictions to CSV format
    
    Returns:
        CSV file with simulation predictions
    """
    try:
        csv_content = ExportService.predictions_to_csv(request.predictions_3d)
        
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=simulation_{request.simulation_id}.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV export failed: {str(e)}")


@router.post("/validation-report/json")
async def export_validation_report(
    simulation_id: str = Query(...),
    credibility_score: float = Query(...),
    residuals: Optional[str] = Query(None),
    physics_violations: int = Query(0),
    warnings: List[str] = Query(default=[]),
    recommendations: List[str] = Query(default=[])
):
    """
    Generate and export validation report in JSON format
    
    Returns:
        JSON file with validation report
    """
    try:
        json_content = ExportService.validation_report_json(
            simulation_id=simulation_id,
            credibility_score=credibility_score,
            residuals=json.loads(residuals) if residuals else {},
            physics_violations=physics_violations,
            warnings=warnings,
            recommendations=recommendations
        )
        
        return StreamingResponse(
            iter([json_content]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=validation_report_{simulation_id}.json"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/formats")
async def get_supported_formats():
    """
    Get list of supported export formats
    
    Returns:
        Dictionary with supported formats and their descriptions
    """
    return {
        "supported_formats": {
            "csv": {
                "description": "Comma-separated values format",
                "use_cases": ["Data analysis", "Excel import", "Statistical processing"],
                "endpoints": [
                    "/v2/export/predictions/csv",
                    "/v2/export/residuals/csv",
                    "/v2/export/audit/csv",
                    "/v2/export/simulation/csv"
                ]
            },
            "json": {
                "description": "JavaScript Object Notation format",
                "use_cases": ["API integration", "Web applications", "Data archival"],
                "endpoints": [
                    "/v2/export/predictions/json",
                    "/v2/export/simulation/json",
                    "/v2/export/validation-report/json"
                ]
            }
        },
        "total_endpoints": 8
    }
