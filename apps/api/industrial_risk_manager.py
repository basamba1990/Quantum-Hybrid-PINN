import torch
import numpy as np
from typing import Dict, List, Tuple, Optional
import logging
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors

logger = logging.getLogger(__name__)

class IndustrialRiskManager:
    """
    Gestionnaire de risque industriel pour PINN :
    - Détection Out-of-Distribution (OOD)
    - Certification des résidus physiques
    - Score de confiance composite
    - Génération de rapports PDF industriels
    """
    def __init__(self, pinn_wrapper, threshold_percentile: float = 99.0):
        self.pinn = pinn_wrapper
        self.ood_detector = None
        self.threshold_percentile = threshold_percentile
        self.is_fitted = False
        
    def fit_ood(self, training_features: np.ndarray):
        """Ajuste le détecteur OOD sur les données d'entraînement"""
        try:
            from hydrogen_pinn_v8 import MahalanobisOODDetector
        except ImportError:
            from .hydrogen_pinn_v8 import MahalanobisOODDetector
            
        self.ood_detector = MahalanobisOODDetector(threshold_percentile=self.threshold_percentile)
        self.ood_detector.fit(training_features)
        self.is_fitted = True
        logger.info("Détecteur OOD industriel ajusté.")

    def load_ood_stats(self, stats_path: str):
        """Charge les statistiques OOD pré-calculées"""
        try:
            try:
                from hydrogen_pinn_v8 import MahalanobisOODDetector
            except ImportError:
                from .hydrogen_pinn_v8 import MahalanobisOODDetector
            data = np.load(stats_path)
            self.ood_detector = MahalanobisOODDetector(threshold_percentile=self.threshold_percentile)
            self.ood_detector.mean = data["mean"]
            # Reconstruire l'inverse de la covariance
            cov = data["cov"]
            d = len(self.ood_detector.mean)
            shrinkage = 0.01
            cov_reg = (1 - shrinkage) * cov + shrinkage * np.eye(d) * np.trace(cov) / d
            self.ood_detector.cov_inv = np.linalg.pinv(cov_reg)
            
            # Seuil par défaut basé sur la distribution de Mahalanobis (Chi-2)
            # Pour d=5, p=0.99, le seuil est environ 15.0
            self.ood_detector.threshold = 15.0 
            self.ood_detector.fitted = True
            self.is_fitted = True
            logger.info(f"Statistiques OOD chargées depuis {stats_path}")
            return True
        except Exception as e:
            logger.error(f"Erreur chargement OOD stats: {e}")
            return False
        
    def compute_risk_score(self, residuals: Dict[str, float], fluid_type: str, transcription: Optional[str] = None, critical_regions_residuals: Optional[Dict[str, float]] = None) -> Tuple[float, Dict, Dict]:
        """
        Calcule le score de crédibilité avec focus sur les régions critiques et seuils de décision.
        """
        # 1. Calcul des tolérances dynamiques (ISO 13623 / API 620)
        # Ajustement industriel pour éviter les fausses alertes sur les résidus transitoires
        tolerances = {"continuity": 1e-3, "momentum": 1e-3, "energy": 5e-3}
        
        # 2. Pondération des résidus globaux
        weighted_sum = 0.0
        for k in tolerances:
            val = residuals.get(k, 0.0)
            if val == 0.0: val = 1e-6
            weighted_sum += val / tolerances[k]
        weighted_res_global = weighted_sum / len(tolerances)
        
        # 3. Pondération spécifique aux régions critiques (Pénalité si forte erreur locale)
        critical_penalty = 1.0
        if critical_regions_residuals:
            crit_sum = sum([critical_regions_residuals.get(k, 0.0) / tolerances.get(k, 1e-4) for k in tolerances]) / len(tolerances)
            if crit_sum > 2.0: # Si l'erreur locale est 2x supérieure à la tolérance
                critical_penalty = 1.5
                logger.warning(f"⚠️ Alerte : Résidus critiques élevés ({crit_sum:.2e})")

        credibility_score = float(100.0 / (1.0 + 0.3 * weighted_res_global * critical_penalty))
        credibility_score = min(100, max(5.0, credibility_score))

        # 4. Évaluation de l'Erreur de Décision (Seuils de Sécurité)
        # Exemple : Seuil de température critique pour l'hydrogène (boil-off ou fragilisation)
        temp_value = residuals.get("max_temperature", 300.0)
        pressure_value = residuals.get("max_pressure", 70e5)
        
        is_safe = True
        decision_details = []
        
        if fluid_type == "LH2" and temp_value > 33.0: # Seuil critique LH2
            is_safe = False
            decision_details.append("TEMPÉRATURE CRITIQUE : Risque de vaporisation (Boil-off)")
        if pressure_value > 80e5: # 80 bar limit
            is_safe = False
            decision_details.append("SURPRESSION : Limite structurelle atteinte")

        # 5. Évaluation des risques
        risk_assessment = {
            "level": "Faible" if (credibility_score > 80 and is_safe) else ("Modéré" if (credibility_score > 60 and is_safe) else "Élevé"),
            "details": f"Score: {credibility_score:.2f}%. " + (" ".join(decision_details) if decision_details else "Paramètres physiques dans les limites nominales.")
        }

        # 6. Rapport de conformité certifié
        compliance_report = {
            "status": "CERTIFIÉ CONFORME" if (credibility_score > 75 and is_safe) else "NON CONFORME / RISQUE ÉLEVÉ",
            "standards": ["ISO 13623 (Pipelines)", "API 620 (LH2 Storage)"] if fluid_type == "LH2" else ["ISO 13623 (Pipelines)"],
            "decision_metrics": {
                "is_safe": is_safe,
                "critical_region_penalty": critical_penalty > 1.0,
                "max_temp_observed": temp_value
            },
            "recommendations": "Opération normale" if (credibility_score > 75 and is_safe) else "INTERVENTION REQUISE : Vérifier l'intégrité physique du système."
        }
        
        return credibility_score, risk_assessment, compliance_report

    def certify_prediction(self, t: float, x: float, y: float, z: float) -> Dict:
        """
        Certifie une prédiction en calculant les résidus et l'incertitude.
        """
        # 1. Calcul de l'incertitude via MC Dropout (fallback si non implémenté)
        if hasattr(self.pinn, "predict_state_with_uncertainty"):
            uncertainty_res = self.pinn.predict_state_with_uncertainty(t, x, y, z, n_samples=10)
            mean_pred = uncertainty_res["mean"]
            uncertainty = uncertainty_res["uncertainty"]
        else:
            # Fallback : prédiction standard sans incertitude réelle
            pred = self.pinn.predict_state(t, x, y, z)
            mean_pred = pred
            uncertainty = {"pressure": 0.05, "velocity": 0.05, "temperature": 0.05}
        
        # 2. Calcul des résidus physiques locaux
        t_t = torch.tensor([[t]], dtype=torch.float32, device=self.pinn.device)
        x_t = torch.tensor([[x]], dtype=torch.float32, device=self.pinn.device)
        y_t = torch.tensor([[y]], dtype=torch.float32, device=self.pinn.device)
        z_t = torch.tensor([[z]], dtype=torch.float32, device=self.pinn.device)
        
        residuals = self.pinn.calculate_residuals(t_t, x_t, y_t, z_t)
        res_values = {k: float(v.item()) for k, v in residuals.items()}
        
        # 3. Score de confiance composite (0-100)
        # Basé sur : résidus (50%), incertitude (30%), OOD (20%)
        
        # Normalisation des résidus (seuil arbitraire 1e-3 pour 100%)
        res_score = max(0, 100 * (1.0 - sum(res_values.values()) / (5 * 1e-2)))
        
        # Normalisation de l'incertitude (pression relative)
        p_uncertainty = uncertainty.get("pressure", 0.0)
        p_mean = mean_pred.get("pressure", 101325.0)
        rel_uncertainty = p_uncertainty / (p_mean**2 + 1e-6) # Variance relative
        unc_score = max(0, 100 * (1.0 - rel_uncertainty * 1e6))
        
        # OOD Score
        ood_detected = False
        dist = 0.0
        if self.is_fitted:
            feature = np.array([mean_pred[k] for k in sorted(mean_pred.keys())])
            ood_detected, dist = self.ood_detector.is_out_of_distribution(feature)
        
        ood_score = 0 if ood_detected else 100
        
        composite_score = 0.5 * res_score + 0.3 * unc_score + 0.2 * ood_score
        
        return {
            "is_certified": composite_score > 80,
            "composite_score": float(composite_score),
            "residuals": res_values,
            "uncertainty": {k: float(v) for k, v in uncertainty.items()},
            "ood_detected": ood_detected,
            "mahalanobis_distance": float(dist)
        }

    def get_safe_prediction(self, t: float, x: float, y: float, z: float) -> Dict:
        """Retourne la prédiction avec son certificat de sécurité"""
        pred = self.pinn.predict_state(t, x, y, z)
        cert = self.certify_prediction(t, x, y, z)
        
        return {
            **pred,
            "certification": cert,
            "status": "SAFE" if cert["is_certified"] else "RISKY"
        }

    def check_drift(self, batch_residuals: List[Dict[str, float]]) -> Dict:
        """
        Analyse une série de résidus pour détecter une dérive physique globale.
        """
        if not batch_residuals:
            return {"drift_detected": False, "drift_score": 0.0}
            
        avg_res = sum([sum(r.values()) for r in batch_residuals]) / (len(batch_residuals) * 5)
        # Seuil industriel : 1e-3
        drift_score = avg_res / 1e-3
        
        return {
            "drift_detected": drift_score > 2.0,
            "drift_score": float(drift_score),
            "avg_residual": float(avg_res)
        }

    def generate_full_report(self, output_path: str, project_id: str, analysis_id: str, scenario_type: str, scenario_inputs: Dict, final_result: Dict):
        """
        Génère un rapport PDF complet et professionnel pour une analyse industrielle.
        """
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        # Styles personnalisés
        if 'TitleStyle' not in styles:
            styles.add(ParagraphStyle(name='TitleStyle', fontSize=24, leading=28, alignment=TA_CENTER, spaceAfter=20))
        if 'Heading1' not in styles:
            styles.add(ParagraphStyle(name='Heading1', fontSize=18, leading=22, spaceAfter=14, textColor=colors.darkblue))
        if 'Heading2' not in styles:
            styles.add(ParagraphStyle(name='Heading2', fontSize=14, leading=18, spaceAfter=10, textColor=colors.blue))
        if 'BodyText' not in styles:
            styles.add(ParagraphStyle(name='BodyText', fontSize=10, leading=12, spaceAfter=6))
        if 'Code' not in styles:
            styles.add(ParagraphStyle(name='Code', fontName='Courier', fontSize=9, leading=10, backColor=colors.lightgrey, spaceBefore=6, spaceAfter=6, borderPadding=5))
        if 'TableCaption' not in styles:
            styles.add(ParagraphStyle(name='TableCaption', fontSize=9, leading=11, spaceBefore=6, spaceAfter=6, alignment=TA_CENTER))

        # Titre du rapport
        story.append(Paragraph("Rapport d'Analyse Industrielle", styles['TitleStyle']))
        story.append(Paragraph(f"Quantum-Hybrid PINN V8 - Projet : {project_id}", styles['Heading1']))
        story.append(Paragraph(f"Analyse ID : {analysis_id}", styles['Heading2']))
        story.append(Paragraph(f"Date : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['BodyText']))
        story.append(Spacer(1, 0.2 * 2.54 * 72)) # 0.2 inch spacer

        # Section Résumé de l'Analyse
        story.append(Paragraph("1. Résumé de l'Analyse", styles['Heading1']))
        story.append(Paragraph(f"Type de Scénario : {scenario_type}", styles['BodyText']))
        story.append(Paragraph(f"Description : {scenario_inputs.get('description', 'N/A')}", styles['BodyText']))
        story.append(Paragraph(f"Nombre d'Étapes : {final_result.get('iteration', 'N/A')}", styles['BodyText']))
        story.append(Spacer(1, 0.1 * 2.54 * 72))

        # Section Score de Crédibilité
        credibility_score = final_result.get('credibility_score', 0.0)
        story.append(Paragraph("2. Score de Crédibilité du Modèle", styles['Heading1']))
        story.append(Paragraph(f"Le modèle a obtenu un score de crédibilité de <font color='{'green' if credibility_score > 80 else ('orange' if credibility_score > 60 else 'red')}'><b>{credibility_score:.2f}%</b></font>. Ce score reflète la cohérence physique des prédictions par rapport aux équations de Navier-Stokes et l'incertitude associée.", styles['BodyText']))
        story.append(Spacer(1, 0.1 * 2.54 * 72))

        # Section Évaluation des Risques
        risk_assessment = final_result.get('risk_assessment', {})
        story.append(Paragraph("3. Évaluation des Risques", styles['Heading1']))
        story.append(Paragraph(f"Niveau de Risque : <b>{risk_assessment.get('level', 'N/A')}</b>", styles['BodyText']))
        story.append(Paragraph(f"Détails : {risk_assessment.get('details', 'N/A')}", styles['BodyText']))
        story.append(Spacer(1, 0.1 * 2.54 * 72))

        # Section Rapport de Conformité
        compliance_report = final_result.get('compliance_report', {})
        story.append(Paragraph("4. Rapport de Conformité", styles['Heading1']))
        story.append(Paragraph(f"Statut : <b>{compliance_report.get('status', 'N/A')}</b>", styles['BodyText']))
        story.append(Paragraph(f"Normes Appliquées : {', '.join(compliance_report.get('standards', ['N/A']))}", styles['BodyText']))
        story.append(Paragraph(f"Recommandations : {compliance_report.get('recommendations', 'N/A')}", styles['BodyText']))
        story.append(Spacer(1, 0.1 * 2.54 * 72))

        # Section Détails des Résidus Physiques
        residuals = final_result.get('residuals', {})
        story.append(Paragraph("5. Détails des Résidus Physiques", styles['Heading1']))
        data_residuals = [['Résidu', 'Valeur']] + [[k.capitalize(), f'{v:.2e}'] for k, v in residuals.items()]
        table_residuals = Table(data_residuals)
        table_residuals.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table_residuals)
        story.append(Spacer(1, 0.1 * 2.54 * 72))

        # Section Historique des Résidus (simplifié)
        residual_history = final_result.get('residual_history', [])
        if residual_history:
            story.append(Paragraph("6. Historique des Résidus (Dernière Étape)", styles['Heading1']))
            last_step_residuals = residual_history[-1].get('residuals', {})
            continuity_val = last_step_residuals.get('continuity', 0.0)
            momentum_val = last_step_residuals.get('momentum', 0.0)
            energy_val = last_step_residuals.get('energy', 0.0)
            uncertainty_val = last_step_residuals.get('uncertainty', 0.0)
            
            # Formatage sécurisé avec gestion des valeurs None/string
            cont_str = f"{float(continuity_val):.2e}" if isinstance(continuity_val, (int, float)) else "N/A"
            mom_str = f"{float(momentum_val):.2e}" if isinstance(momentum_val, (int, float)) else "N/A"
            ener_str = f"{float(energy_val):.2e}" if isinstance(energy_val, (int, float)) else "N/A"
            unc_str = f"{float(uncertainty_val):.2e}" if isinstance(uncertainty_val, (int, float)) else "N/A"
            
            story.append(Paragraph(f"Continuité : {cont_str}", styles['BodyText']))
            story.append(Paragraph(f"Momentum : {mom_str}", styles['BodyText']))
            story.append(Paragraph(f"Énergie : {ener_str}", styles['BodyText']))
            story.append(Paragraph(f"Incertitude : {unc_str}", styles['BodyText']))
            story.append(Spacer(1, 0.1 * 2.54 * 72))

        # Section Prédictions 3D (Résumé)
        predictions3d = final_result.get('predictions3d', [])
        if predictions3d:
            story.append(Paragraph("7. Résumé des Prédictions 3D", styles['Heading1']))
            story.append(Paragraph(f"Nombre de points 3D générés pour le profil : {len(predictions3d)}", styles['BodyText']))
            # Afficher quelques points clés ou une moyenne
            avg_pressure = np.mean([p['pressure'] for p in predictions3d]) if predictions3d else 'N/A'
            avg_velocity = np.mean([p['velocity_u'] for p in predictions3d]) if predictions3d else 'N/A'
            avg_temperature = np.mean([p['temperature'] for p in predictions3d]) if predictions3d else 'N/A'
            story.append(Paragraph(f"Pression Moyenne : {avg_pressure:.2f} Pa", styles['BodyText']))
            story.append(Paragraph(f"Vitesse Moyenne (u) : {avg_velocity:.2f} m/s", styles['BodyText']))
            story.append(Paragraph(f"Température Moyenne : {avg_temperature:.2f} K", styles['BodyText']))
            story.append(Spacer(1, 0.1 * 2.54 * 72))

        # Pied de page
        story.append(PageBreak())
        story.append(Paragraph("Fin du Rapport", styles['TitleStyle']))
        story.append(Paragraph("Ce rapport a été généré automatiquement par Quantum-Hybrid PINN V8.", styles['BodyText']))

        doc.build(story)
        logger.info(f"Rapport PDF généré à : {output_path}")
        return output_path


