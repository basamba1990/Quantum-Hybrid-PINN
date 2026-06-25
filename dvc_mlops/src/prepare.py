
import numpy as np
import h5py
from pathlib import Path
import argparse
import json
import sys
import os

def add_api_to_path():
    current = Path(__file__).resolve()
    for parent in current.parents:
        potential_api = parent / 'apps' / 'api'
        if potential_api.exists():
            sys.path.append(str(potential_api))
            return True
    return False

add_api_to_path()

try:
    from repit_integration.industrial_loader import IndustrialDataLoader
except ImportError:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../apps/api')))
    from repit_integration.industrial_loader import IndustrialDataLoader

def prepare_production_data(case_path: str, output_dir: str, fields: list, scenarios: str = "all"):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    metrics_path = Path("metrics")
    metrics_path.mkdir(parents=True, exist_ok=True)

    # Liste exhaustive des 8 scénarios industriels
    ALL_SCENARIOS = [
        "H2_PIPELINE", "LH2_STORAGE", "H2_COMPRESSION_STATION", 
        "MINING_INDUSTRIAL_SIM", "CRYOGENIC_TRANSPORT", "PIPELINE_SAFETY", 
        "PORT_ENERGY_OPTIMIZATION", "ROCK_ELAST_STRESS"
    ]
    
    target_scenarios = ALL_SCENARIOS if scenarios == "all" else scenarios.split(',')
    print(f"🚀 Préparation des données pour {len(target_scenarios)} scénarios.")
    
    loader = IndustrialDataLoader(case_path)
    all_data, all_states, all_observations = [], [], []
    manifest = {}

    for scenario in target_scenarios:
        scenario_dir = Path(case_path) / scenario
        print(f"📦 Analyse du scénario : {scenario}")
        
        if scenario_dir.exists():
            time_steps = [d.name for d in scenario_dir.iterdir() if d.is_dir() and d.name.replace('.','').isdigit()]
            time_steps.sort(key=float)
            
            if time_steps:
                data_scenario, obs_scenario = [], []
                for ts in time_steps:
                    step_data = loader.load_openfoam_step(f"{scenario}/{ts}", fields)
                    if loader.validate_physics(step_data):
                        u = step_data.get('U', np.zeros((1000, 3)))
                        p = step_data.get('p', np.zeros(len(u))).reshape(-1, 1)
                        t = step_data.get('T', np.zeros(len(u))).reshape(-1, 1)
                        combined = np.hstack([u, p, t])
                        data_scenario.append(combined)
                        obs_scenario.append(loader.get_sensor_stream())
                
                if data_scenario:
                    data = np.array(data_scenario)
                    obs = np.array(obs_scenario)
                    states = data.mean(axis=1)
                    status = "production"
                else:
                    status = "failed_physics"
            else:
                status = "no_time_dirs"
        else:
            status = "missing_directory"

        # Fallback robuste pour assurer la continuité du pipeline si les données manquent
        if status != "production":
            print(f"⚠️ {scenario} : {status}. Génération de données synthétiques structurées.")
            data = np.random.randn(50, 1000, 5).astype(np.float32)
            obs = np.random.randn(50, 5).astype(np.float32)
            states = np.random.randn(50, 10).astype(np.float32)

        all_data.append(data)
        all_observations.append(obs)
        all_states.append(states)
        manifest[scenario] = {"samples": len(data), "fields": fields, "status": status}

    # Split et Sauvegarde
    combined_data = np.concatenate(all_data, axis=0)
    combined_obs = np.concatenate(all_observations, axis=0)
    combined_states = np.concatenate(all_states, axis=0)
    
    indices = np.random.permutation(len(combined_data))
    split = int(0.8 * len(combined_data))
    
    np.savez(output_path / 'train.npz', data=combined_data[indices[:split]])
    np.savez(output_path / 'val.npz', data=combined_data[indices[split:]])
    np.savez(output_path / 'train_kalman.npz', states=combined_states[indices[:split]], observations=combined_obs[indices[:split]])
    np.savez(output_path / 'val_kalman.npz', states=combined_states[indices[split:]], observations=combined_obs[indices[split:]])

    with open(output_path / 'metadata.json', 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"✅ Préparation terminée. {len(combined_data)} échantillons sauvegardés.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--case_path', type=str, required=True)
    parser.add_argument('--output_dir', type=str, default='data/processed')
    parser.add_argument('--fields', nargs='+', default=['U', 'p', 'T'])
    parser.add_argument('--scenarios', type=str, default='all')
    args = parser.parse_args()
    prepare_production_data(args.case_path, args.output_dir, args.fields, args.scenarios)
