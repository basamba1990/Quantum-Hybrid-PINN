"""
Export Service for Quantum-Hybrid PINN
Provides CSV and JSON export functionality for simulation results
"""

import csv
import json
import io
from typing import List, Dict, Any, Optional
from datetime import datetime
import pandas as pd


class ExportService:
    """Handles export of simulation results to various formats"""
    
    @staticmethod
    def predictions_to_csv(predictions_3d: List[Dict[str, Any]]) -> str:
        """
        Convert 3D predictions to CSV format
        
        Args:
            predictions_3d: List of prediction dictionaries
            
        Returns:
            CSV string with predictions data
        """
        if not predictions_3d:
            return ""
        
        # Create DataFrame from predictions
        df = pd.DataFrame(predictions_3d)
        
        # Ensure proper column ordering
        column_order = [
            'time', 'x', 'y', 'z',
            'pressure', 'temperature', 'density',
            'velocity_u', 'velocity_v', 'velocity_w', 'velocity_magnitude',
            'residual_continuity', 'residual_momentum', 'residual_energy'
        ]
        
        # Keep only columns that exist
        existing_cols = [col for col in column_order if col in df.columns]
        df = df[existing_cols]
        
        # Convert to CSV
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue()
    
    @staticmethod
    def audit_to_csv(audit_data: Dict[str, Any]) -> str:
        """
        Convert audit data to CSV format
        
        Args:
            audit_data: Dictionary containing audit information
            
        Returns:
            CSV string with audit data
        """
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        
        # Write header
        writer.writerow(['Metric', 'Value', 'Unit'])
        
        # Write credibility score
        writer.writerow(['Credibility Score', audit_data.get('credibilityScore', 0), '/100'])
        writer.writerow(['Physical Coherence', 'VALIDATED' if audit_data.get('isPhysicallyCoherent') else 'ANOMALY', ''])
        
        # Write extracted data
        if 'extractedData' in audit_data:
            for key, value in audit_data['extractedData'].items():
                writer.writerow([key.replace('_', ' ').title(), value, ''])
        
        # Write residuals if available
        if 'residuals' in audit_data:
            writer.writerow(['', '', ''])  # Empty row for spacing
            writer.writerow(['Residuals', '', ''])
            for key, value in audit_data['residuals'].items():
                writer.writerow([key.replace('_', ' ').title(), f'{value:.2e}', ''])
        
        return csv_buffer.getvalue()
    
    @staticmethod
    def simulation_to_json(
        simulation_id: str,
        project_name: str,
        parameters: Dict[str, Any],
        audit_data: Dict[str, Any],
        predictions_3d: List[Dict[str, Any]],
        temporal_predictions: Optional[List[Dict[str, Any]]] = None,
        confidence_metrics: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Export complete simulation to JSON format
        
        Args:
            simulation_id: Unique simulation identifier
            project_name: Name of the project
            parameters: Simulation parameters
            audit_data: Audit and validation data
            predictions_3d: 3D predictions
            temporal_predictions: Optional temporal predictions
            confidence_metrics: Optional confidence metrics
            
        Returns:
            JSON string with complete simulation data
        """
        export_data = {
            'metadata': {
                'simulation_id': simulation_id,
                'project_name': project_name,
                'export_timestamp': datetime.utcnow().isoformat(),
                'version': '8.5',
                'format': 'quantum-hybrid-pinn-v8.5'
            },
            'parameters': parameters,
            'audit': {
                'credibility_score': audit_data.get('credibilityScore', 0),
                'is_physically_coherent': audit_data.get('isPhysicallyCoherent', False),
                'anomalies': audit_data.get('anomalies', []),
                'extracted_data': audit_data.get('extractedData', {}),
                'confidence_metrics': confidence_metrics or {}
            },
            'results': {
                'predictions_3d': predictions_3d,
                'temporal_predictions': temporal_predictions or [],
                'point_count': len(predictions_3d),
                'temporal_steps': len(temporal_predictions) if temporal_predictions else 0
            }
        }
        
        return json.dumps(export_data, indent=2, default=str)
    
    @staticmethod
    def predictions_to_json(predictions_3d: List[Dict[str, Any]]) -> str:
        """
        Export predictions to JSON format
        
        Args:
            predictions_3d: List of prediction dictionaries
            
        Returns:
            JSON string with predictions
        """
        export_data = {
            'metadata': {
                'export_timestamp': datetime.utcnow().isoformat(),
                'point_count': len(predictions_3d),
                'format': 'predictions-v8.5'
            },
            'data': predictions_3d
        }
        
        return json.dumps(export_data, indent=2, default=str)
    
    @staticmethod
    def residuals_to_csv(predictions_3d: List[Dict[str, Any]]) -> str:
        """
        Export residuals analysis to CSV
        
        Args:
            predictions_3d: List of predictions with residuals
            
        Returns:
            CSV string with residuals analysis
        """
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        
        # Write header
        writer.writerow([
            'Point Index', 'x', 'y', 'z', 'time',
            'Residual Continuity', 'Residual Momentum', 'Residual Energy',
            'Pressure', 'Temperature', 'Velocity Magnitude'
        ])
        
        # Write data
        for idx, pred in enumerate(predictions_3d):
            writer.writerow([
                idx,
                pred.get('x', ''),
                pred.get('y', ''),
                pred.get('z', ''),
                pred.get('time', ''),
                f"{pred.get('residual_continuity', 0):.2e}",
                f"{pred.get('residual_momentum', 0):.2e}",
                f"{pred.get('residual_energy', 0):.2e}",
                f"{pred.get('pressure', 0):.2e}",
                f"{pred.get('temperature', 0):.4f}",
                f"{pred.get('velocity_magnitude', 0):.4f}"
            ])
        
        return csv_buffer.getvalue()
    
    @staticmethod
    def validation_report_json(
        simulation_id: str,
        credibility_score: float,
        residuals: Dict[str, float],
        physics_violations: int,
        warnings: List[str],
        recommendations: List[str]
    ) -> str:
        """
        Generate a validation report in JSON format
        
        Args:
            simulation_id: Unique simulation identifier
            credibility_score: Overall credibility score
            residuals: Dictionary of residual values
            physics_violations: Number of physics violations detected
            warnings: List of warning messages
            recommendations: List of recommendations
            
        Returns:
            JSON string with validation report
        """
        report = {
            'validation_report': {
                'simulation_id': simulation_id,
                'timestamp': datetime.utcnow().isoformat(),
                'credibility_score': credibility_score,
                'certification_level': 'EVIDENCE_GATES_REQUIRED',
                'certification_note': 'A score cannot establish G0-G5 validation; an authoritative evidence-gate report is required.',
                'physics_validation': {
                    'residuals': residuals,
                    'violations_detected': physics_violations,
                    'status': 'PASSED' if physics_violations == 0 else 'FAILED'
                },
                'warnings': warnings,
                'recommendations': recommendations,
                'summary': {
                    'total_warnings': len(warnings),
                    'total_recommendations': len(recommendations),
                    'ready_for_production': False,
                    'decision_basis': 'G0-G5 evidence report required; score and violation count are non-authoritative',
                }
            }
        }
        
        return json.dumps(report, indent=2, default=str)
    
    @staticmethod
    def _get_certification_level(credibility_score: float) -> str:
        """Legacy compatibility label; never use this as a G0-G5 decision."""
        return 'EVIDENCE_GATES_REQUIRED'
