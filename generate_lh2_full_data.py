import json
import math
import random

def generate_lh2_sphere_data(radius=2.5, num_points=2000):
    points = []
    T_center = 20.0
    T_surface = 100.0
    P_base = 120000.0
    rho_lh2 = 70.8

    for _ in range(num_points):
        # Distribution sphérique uniforme
        phi = random.uniform(0, 2 * math.pi)
        costheta = random.uniform(-1, 1)
        u = random.uniform(0, 1)
        
        theta = math.acos(costheta)
        r = radius * (u**(1/3))
        
        x = r * math.sin(theta) * math.cos(phi)
        y = r * math.sin(theta) * math.sin(phi)
        z = r * math.cos(theta)
        
        # Température avec gradient radial (plus chaud à la surface)
        norm_r = r / radius
        # Simulation d'une stratification thermique
        temp = T_center + (T_surface - T_center) * (norm_r**2)
        
        # Pression avec gradient hydrostatique
        pressure = P_base + rho_lh2 * 9.81 * (radius - z)
        
        points.append({
            "x": round(x, 3),
            "y": round(y, 3),
            "z": round(z, 3),
            "temperature": round(temp, 2),
            "pressure": round(pressure, 2),
            "density": rho_lh2,
            "velocity_magnitude": round(0.001 * norm_r, 5)
        })
    
    return points

data = {
    "project": {
        "name": "LH2-SPHERE-V10-GOLD",
        "description": "Simulation plein volume d'une sphère de stockage LH2 avec rendu Truly-Industrial.",
        "status": "active"
    },
    "analysis": {
        "title": "LH2 Full Volume Thermal Analysis",
        "scenario_type": "LH2_STORAGE",
        "results": {
            "predictions3d": generate_lh2_sphere_data()
        }
    }
}

with open('lh2_full_volume_data.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Fichier lh2_full_volume_data.json généré avec succès.")
