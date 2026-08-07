export const LH2_SCENARIO_CONFIG = {
  scenario_type: "LH2_INFRASTRUCTURE_INTEGRITY",
  title: "Intégrité des Infrastructures Dihydrogène Liquide (LH2)",
  description: "Simulation PINN hybride des discontinuités de fuite cryogénique et des gradients thermiques (20.28K) selon les standards de Kelly Senecal.",
  extracted_parameters: {
    fluid: "Liquid Hydrogen (LH2)",
    operating_pressure_mpa: 1.2,
    storage_temperature_k: 20.28,
    ambient_temperature_k: 293.15,
    density_lh2_kg_m3: 70.85,
    viscosity_pa_s: 1.3e-5,
    thermal_conductivity_w_mk: 0.1,
    leak_discontinuity_diameter_mm: 5.0,
    source: "NIST Standard Reference Database / ScienceDirect Cryogenics 2024"
  },
  credibility_score: 98.4,
  residuals: {
    mass: 4.2e-7,
    momentum: 8.5e-7,
    energy: 1.2e-6
  },
  kelly_audit: {
    why_physics_validated: true,
    reynolds_number: 450000,
    flow_regime: "Turbulent Cryogenic Jet",
    mitigation_recommendation: "Installation de capteurs acoustiques et double enveloppe sous vide poussé avec monitoring PINN en temps réel."
  }
};
