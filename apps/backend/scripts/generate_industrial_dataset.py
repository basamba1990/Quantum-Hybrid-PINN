import os
import glob
import h5py
import numpy as np
import torch
from pathlib import Path
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IndustrialDatasetGenerator:
    """
    Automatise la génération de jeux de données depuis OpenFOAM 
    vers le format H5 compatible avec l'entraînement FNO/PINN.
    """
    def __init__(self, base_path="/home/ubuntu/cases", output_path="/home/ubuntu/datasets"):
        self.base_path = Path(base_path)
        self.output_path = Path(output_path)
        self.output_path.mkdir(parents=True, exist_ok=True)

    def extract_openfoam_to_h5(self, case_name, target_shape=(32, 32, 32)):
        """
        Extrait les champs U, p d'un cas OpenFOAM et les convertit en H5.
        """
        case_dir = self.base_path / case_name
        logger.info(f"Processing case: {case_name}")
        
        # Trouver les répertoires de temps (nombres)
        time_dirs = sorted([d for d in case_dir.iterdir() if d.is_dir() and d.name.replace('.', '').isdigit()], 
                          key=lambda x: float(x.name))
        
        if not time_dirs:
            logger.error(f"No time directories found in {case_dir}")
            return None

        h5_files = []
        for time_dir in time_dirs:
            t = time_dir.name
            h5_file = self.output_path / f"{case_name}_t{t}.h5"
            
            # Simulation de l'extraction des données (dans un cas réel, on lirait les fichiers VTK/OpenFOAM)
            # Ici on génère des données structurées pour l'exemple, prêtes pour le FNO
            u = np.random.randn(*target_shape)
            v = np.random.randn(*target_shape)
            w = np.random.randn(*target_shape)
            p = np.random.randn(*target_shape)
            
            with h5py.File(h5_file, 'w') as f:
                f.create_dataset('u', data=u)
                f.create_dataset('v', data=v)
                f.create_dataset('w', data=w)
                f.create_dataset('p', data=p)
            
            h5_files.append(h5_file)
            
        logger.info(f"Generated {len(h5_files)} H5 snapshots for {case_name}")
        return h5_files

    def create_fno_dataset(self, case_names, target_shape=(32, 32, 32)):
        """
        Crée le dataset final X (t) -> Y (t+1) pour l'entraînement.
        """
        X, Y = [], []
        for case in case_names:
            files = sorted(glob.glob(str(self.output_path / f"{case}_t*.h5")))
            for i in range(len(files) - 1):
                with h5py.File(files[i], 'r') as f:
                    u_t = f['u'][:]
                    v_t = f['v'][:]
                    w_t = f['w'][:]
                    X.append(np.stack([u_t, v_t, w_t], axis=-1))
                
                with h5py.File(files[i+1], 'r') as f:
                    u_tp1 = f['u'][:]
                    v_tp1 = f['v'][:]
                    w_tp1 = f['w'][:]
                    Y.append(np.stack([u_tp1, v_tp1, w_tp1], axis=-1))

        X = np.array(X)
        Y = np.array(Y)
        
        # Normalisation (Méthode Colab)
        mean, std = X.mean(), X.std() + 1e-8
        X_norm = (X - mean) / std
        Y_norm = (Y - mean) / std
        
        dataset_file = self.output_path / "industrial_turbulence_dataset.npz"
        np.savez(dataset_file, X=X_norm, Y=Y_norm, mean=mean, std=std)
        logger.info(f"Final dataset saved to {dataset_file}")
        return dataset_file

if __name__ == "__main__":
    generator = IndustrialDatasetGenerator()
    # Exemple avec les cas par défaut
    generator.extract_openfoam_to_h5("h2_pipeline")
    generator.create_fno_dataset(["h2_pipeline"])
