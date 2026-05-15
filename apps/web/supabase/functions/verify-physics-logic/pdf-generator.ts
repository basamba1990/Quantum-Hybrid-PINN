
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

export async function generateAnalysisReport(data: any) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(0, 51, 102);
  doc.text("RAPPORT D'ANALYSE SCIENTIFIQUE PINN V8", 20, 30);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`ID Analyse: ${data.analysisId}`, 20, 40);
  doc.text(`Date: ${new Date().toLocaleString()}`, 20, 47);
  
  // Section 1: Paramètres Extraits
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("1. Paramètres Physiques Extraits (GPT-4o)", 20, 65);
  
  doc.setFontSize(10);
  let y = 75;
  const params = data.extractedData;
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      doc.text(`${key}: ${value}`, 30, y);
      y += 7;
    }
  });
  
  // Section 2: Score de Crédibilité
  y += 10;
  doc.setFontSize(16);
  doc.text("2. Évaluation de la Crédibilité Physique", 20, y);
  y += 10;
  doc.setFontSize(24);
  const score = data.credibilityScore;
  if (score >= 80) doc.setTextColor(0, 153, 76);
  else if (score >= 50) doc.setTextColor(204, 102, 0);
  else doc.setTextColor(204, 0, 0);
  doc.text(`${score}%`, 20, y + 10);
  
  // Section 3: Anomalies
  doc.setTextColor(0);
  y += 30;
  doc.setFontSize(16);
  doc.text("3. Détection d'Anomalies", 20, y);
  y += 10;
  doc.setFontSize(10);
  if (data.anomalies && data.anomalies.length > 0) {
    data.anomalies.forEach((anomaly: string) => {
      doc.text(`- ${anomaly}`, 30, y);
      y += 7;
    });
  } else {
    doc.text("Aucune anomalie critique détectée.", 30, y);
  }
  
  // Section 4: Visualisation des Champs (Résumé)
  y += 15;
  doc.setFontSize(16);
  doc.text("4. Résumé des Champs de Simulation 3D", 20, y);
  y += 10;
  doc.setFontSize(10);
  doc.text("Les données de champ complet sont disponibles dans le visualiseur interactif du dashboard.", 20, y);

  return doc.output("arraybuffer");
}
