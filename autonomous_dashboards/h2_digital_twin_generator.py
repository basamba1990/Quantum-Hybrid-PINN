#!/usr/bin/env python3
"""
H2 Digital Twin Generator
Génère des tableaux de bord HTML autonomes et portables pour les jumeaux numériques d'hydrogène
Combine le moteur SciML, les résidus physiques et le template HTML interactif
"""

import json
import os
from datetime import datetime
from pathlib import Path
from h2_sciml_engine import SciMLEngine

# ============================================================================
# CONFIGURATION
# ============================================================================
API_BASE_URL = os.getenv("H2_INFERENCE_API_URL", "https://quantum-pinn-api-qef2.onrender.com")
OUTPUT_DIR = Path("digital_twins")
OUTPUT_DIR.mkdir(exist_ok=True)

# Template HTML (à lire depuis le fichier ou l'inclure directement)
HTML_TEMPLATE_PATH = Path("h2_dashboard_template.html")

# ============================================================================
# SCÉNARIOS À GÉNÉRER
# ============================================================================
SCENARIOS = [
    {
        "name": "LH2_STORAGE",
        "title": "Réservoir de Stockage LH₂ (50 m³)",
        "description": "Stockage cryogénique d'hydrogène liquide avec analyse thermodynamique",
        "inputs": {
            "volume": 50,            # m³
            "pressure": 1.2,         # bar
            "temperature": 20.3,     # K (point d'ébullition)
            "ambientTemp": 300       # K
        },
        "method": "generate_lh2_storage_data"
    },
    {
        "name": "H2_PIPELINE",
        "title": "Pipeline H₂ (100 km)",
        "description": "Transport d'hydrogène gazeux sur longue distance avec analyse aérodynamique",
        "inputs": {
            "length": 100,           # km
            "diameter": 0.5,         # m
            "pressure": 80,          # bar
            "temperature": 300,      # K
            "flowRate": 2,           # kg/s
            "fluid": "H2"
        },
        "method": "generate_pipeline_data"
    },
    {
        "name": "ROCK_STRESS",
        "title": "Stockage Géologique (1000 m)",
        "description": "Stockage d'hydrogène en formation rocheuse profonde avec analyse de contrainte",
        "inputs": {
            "depth": 1000,           # m
            "rockType": "granite"
        },
        "method": "generate_rock_stress_data"
    }
]

# ============================================================================
# CLASSE GÉNÉRATEUR
# ============================================================================
class H2DigitalTwinGenerator:
    def __init__(self, api_url: str, template_path: Path):
        self.sciml_engine = SciMLEngine(api_url)
        self.template_path = template_path
        self.template_content = self.load_template()

    def load_template(self) -> str:
        """Charge le template HTML"""
        if self.template_path.exists():
            with open(self.template_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            print(f"⚠️  Template non trouvé: {self.template_path}")
            print("Utilisation d'un template minimal...")
            return self.get_minimal_template()

    def get_minimal_template(self) -> str:
        """Retourne un template minimal si le fichier n'existe pas"""
        return """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>H2 Digital Twin Dashboard</title>
    <style>
        body { font-family: monospace; background: #0a0e27; color: #00d4ff; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #00ff88; }
        .data { background: #1a1f3a; padding: 15px; border-radius: 5px; margin: 10px 0; }
        pre { overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>H₂ Digital Twin - Autonomous Dashboard</h1>
        <div class="data">
            <h2 id="scenario"></h2>
            <pre id="data"></pre>
        </div>
    </div>
    <script>
        const DATA = {embedded_data_placeholder};
        document.getElementById('scenario').textContent = DATA.meta.scenario;
        document.getElementById('data').textContent = JSON.stringify(DATA, null, 2);
    </script>
</body>
</html>"""

    def generate_dashboard(self, scenario: dict, output_filename: str) -> str:
        """Génère un tableau de bord pour un scénario donné"""
        print(f"\n{'='*70}")
        print(f"🔬 Génération: {scenario['title']}")
        print(f"{'='*70}")

        # Étape 1: Générer les données SciML
        print(f"  ✓ Appel du moteur SciML...")
        method_name = scenario['method']
        method = getattr(self.sciml_engine, method_name)
        sciml_data = method(scenario['inputs'])

        # Étape 2: Enrichir les données
        print(f"  ✓ Enrichissement des données...")
        enriched_data = self.enrich_data(sciml_data, scenario)

        # Étape 3: Générer le HTML
        print(f"  ✓ Génération du HTML autonome...")
        html_content = self.inject_data_into_template(enriched_data)

        # Étape 4: Sauvegarder le fichier
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = OUTPUT_DIR / f"{output_filename}_{timestamp}.html"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"  ✓ Fichier généré: {output_path}")
        print(f"  ✓ Taille: {file_size_mb:.2f} MB")

        # Étape 5: Afficher les statistiques
        self.print_statistics(enriched_data, scenario)

        return str(output_path)

    def enrich_data(self, sciml_data: dict, scenario: dict) -> dict:
        """Enrichit les données SciML avec des métadonnées"""
        enriched = {
            **sciml_data,
            "meta": {
                **sciml_data["meta"],
                "scenario_title": scenario["title"],
                "scenario_description": scenario["description"],
                "generated_at": datetime.now().isoformat(),
                "generator_version": "1.0.0",
                "api_url": API_BASE_URL
            }
        }
        return enriched

    def inject_data_into_template(self, data: dict) -> str:
        """Injecte les données dans le template HTML"""
        # Convertir les données en JSON
        json_data = json.dumps(data, default=str, indent=2)

        # Remplacer le placeholder dans le template
        html = self.template_content.replace(
            'const EMBEDDED_DATA = {',
            f'const EMBEDDED_DATA = {json_data.replace("const EMBEDDED_DATA = ", "")}'
        )

        # Si le remplacement n'a pas fonctionné (template minimal), utiliser une autre approche
        if 'EMBEDDED_DATA' not in html:
            html = html.replace(
                '{embedded_data_placeholder}',
                json_data
            )

        return html

    def print_statistics(self, data: dict, scenario: dict) -> None:
        """Affiche les statistiques de génération"""
        print(f"\n  📊 Statistiques:")
        print(f"     • Scénario: {data['meta']['scenario']}")
        print(f"     • Score de crédibilité: {data.get('credibility_score', 'N/A')}%")
        
        physical_outputs = data['meta'].get('physical_outputs', {})
        if physical_outputs:
            print(f"     • Sorties physiques:")
            for key, value in physical_outputs.items():
                if isinstance(value, (int, float)):
                    print(f"       - {key}: {value}")

        residuals = data.get('residuals', {})
        if residuals:
            print(f"     • Résidus physiques:")
            for key, values in residuals.items():
                if isinstance(values, list) and len(values) > 0:
                    mean_residual = sum(values) / len(values)
                    print(f"       - {key}: {mean_residual:.2e}")

# ============================================================================
# FONCTION PRINCIPALE
# ============================================================================
def main():
    print("\n" + "="*70)
    print("🚀 H₂ DIGITAL TWIN GENERATOR - Générateur Autonome")
    print("="*70)
    print(f"📍 Répertoire de sortie: {OUTPUT_DIR}")
    print(f"🔗 API URL: {API_BASE_URL}")
    print(f"⏰ Timestamp: {datetime.now().isoformat()}")

    # Initialiser le générateur
    generator = H2DigitalTwinGenerator(API_BASE_URL, HTML_TEMPLATE_PATH)

    # Générer les tableaux de bord pour chaque scénario
    generated_files = []
    for scenario in SCENARIOS:
        try:
            output_filename = f"digital_twin_{scenario['name']}"
            output_path = generator.generate_dashboard(scenario, output_filename)
            generated_files.append(output_path)
        except Exception as e:
            print(f"  ❌ Erreur lors de la génération: {e}")
            import traceback
            traceback.print_exc()

    # Résumé final
    print(f"\n{'='*70}")
    print(f"✅ GÉNÉRATION TERMINÉE")
    print(f"{'='*70}")
    print(f"📁 Fichiers générés: {len(generated_files)}")
    for filepath in generated_files:
        print(f"   ✓ {filepath}")

    print(f"\n💡 Prochaines étapes:")
    print(f"   1. Télécharger les fichiers HTML générés")
    print(f"   2. Ouvrir dans un navigateur web (aucun serveur requis)")
    print(f"   3. Modifier les paramètres avec les sliders")
    print(f"   4. Partager les fichiers avec les clients/stakeholders")
    print(f"   5. Héberger sur serveur pour analytics (optionnel)")

    return generated_files

# ============================================================================
# POINT D'ENTRÉE
# ============================================================================
if __name__ == "__main__":
    generated_files = main()
    print(f"\n✨ Générateur terminé avec succès!")
