from pathlib import Path
import subprocess
import re
from copy import deepcopy
from typing import Dict, Optional

import numpy as np
import torch
import Ofpp

from ..config import TrainingConfig, OpenfoamConfig
from .utils import OpenfoamUtils

torch.set_default_dtype(torch.float64)

# Constantes par défaut
MOL_WT = 0.02896  # kg/mol
GAS_CONSTANT = 8.31446261815324  # J/(mol*K)
GRAVITY = 9.81  # m/s^2
ALPHA = 0.00343  # 1/K


def calculate_rho(pressure_data: np.ndarray, temperature_data: np.ndarray,
                  mol_wt: float = MOL_WT, gas_constant: float = GAS_CONSTANT) -> np.ndarray:
    temperature_data = temperature_data.reshape(-1)
    rho = (pressure_data * mol_wt) / (gas_constant * temperature_data)
    return rho


def include_all_features_NC(temperature_data: np.ndarray, latestML_time_dir: Path,
                            velocity_data: np.ndarray, adjust_phi: bool = True) -> str:
    pressure_path = latestML_time_dir / "p"
    if not pressure_path.exists():
        return "⚠️ Fichier p introuvable, rho non calculé."
    pressure_data = Ofpp.parse_internal_field(str(pressure_path))
    rho_data = calculate_rho(pressure_data, temperature_data)

    # Mise à jour du champ rho
    rho_file = latestML_time_dir / "rho"
    if rho_file.exists():
        data_str = "(\n" + parse_numpy(rho_data) + "\n)\n;"
        with open(rho_file, "r") as f:
            foam_data = f.read()
        foam_data = re.sub(r'\([\s\S]*?\)\n;', data_str, foam_data, count=1)
        with open(rho_file, "w") as f:
            f.write(foam_data)

    if adjust_phi:
        cmd = ["adjustPhiML", "-case", str(latestML_time_dir.parent), "-time", latestML_time_dir.name]
        try:
            return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout
        except FileNotFoundError:
            return "⚠️ adjustPhiML non trouvé, phi non ajusté."
    return "Fonctions auxiliaires appliquées."


def format_number(x: float) -> str:
    """Formate un nombre avec 17 chiffres significatifs, sans notation scientifique."""
    return f"{x:.17g}"


def parse_numpy(data: np.ndarray) -> str:
    """Convertit un tableau NumPy en chaîne formatée pour OpenFOAM."""
    if data.ndim == 1:
        return '\n'.join(map(format_number, data))
    elif data.ndim == 2:
        if data.shape[1] == 1:  # colonne
            return '\n'.join(map(format_number, data[:, 0]))
        elif data.shape[1] == 2:  # vecteur 2D (Ux, Uy)
            return '\n'.join(f"({format_number(x)} {format_number(y)} 0)" for x, y in data)
        else:  # vecteur 3D
            return '\n'.join(f"({format_number(x)} {format_number(y)} {format_number(z)})" for x, y, z in data)
    else:
        raise ValueError("Data shape not supported")


def manage_time_uniform(solver_dir: Path, latestML_time: float) -> str:
    """Met à jour le fichier uniform/time avec le nouvel instant."""
    ml_dir_name = str(int(latestML_time)) if latestML_time.is_integer() else str(latestML_time)
    uniform_time = solver_dir / ml_dir_name / "uniform" / "time"
    if not uniform_time.exists():
        return "⚠️ uniform/time introuvable"
    with open(uniform_time, "r") as f:
        content = f.read()
    content = re.sub(r'(location\s*)"([^"]*)"', rf'\1"{ml_dir_name}"', content)
    with open(uniform_time, "w") as f:
        f.write(content)
    return f"✅ uniform/time mis à jour pour {ml_dir_name}"


def numpyToFoam(openfoam_config: OpenfoamConfig,
                latestML_time: float,
                latestCFD_time: Optional[float] = None,
                variables: Optional[list] = None,
                solver_dir: Optional[Path] = None,
                assets_path: Optional[Path] = None,
                is_ground_truth: bool = False) -> str:
    """Convertit les fichiers .npy en champs OpenFOAM."""
    solver_dir = Path(solver_dir) if solver_dir else openfoam_config.solver_dir
    assets_path = Path(assets_path) if assets_path else openfoam_config.assets_dir
    variables = variables or openfoam_config.get_variables()

    if latestCFD_time is None:
        latestCFD_time = OpenfoamUtils.max_time_directory(solver_dir, round_to=openfoam_config.round_to)
    else:
        latestCFD_time = float(latestCFD_time)

    latestCFD_time_dir = solver_dir / (str(int(latestCFD_time)) if latestCFD_time.is_integer() else str(latestCFD_time))
    ml_dir_name = str(int(latestML_time)) if latestML_time.is_integer() else str(latestML_time)
    latestML_time_dir = solver_dir / ml_dir_name

    if not latestML_time_dir.exists():
        subprocess.run(["cp", "-r", str(latestCFD_time_dir), str(latestML_time_dir)], check=True)

    output = manage_time_uniform(solver_dir, latestML_time)

    temperature_data = None
    velocity_data = None

    for var in variables:
        if is_ground_truth:
            numpy_file = assets_path / f"{var}_{latestML_time}.npy"
        else:
            numpy_file = assets_path / f"{var}_{latestML_time}_predicted.npy"
        if not numpy_file.exists():
            output += f"\n⚠️ Fichier introuvable : {numpy_file}"
            continue

        data = np.load(numpy_file)
        if var == "T":
            temperature_data = deepcopy(data)
        elif var == "U":
            velocity_data = deepcopy(data)

        foam_file = latestML_time_dir / var
        data_str = "(\n" + parse_numpy(data) + "\n)\n;"
        with open(foam_file, "r") as f:
            foam_data = f.read()
        foam_data = re.sub(r'\([\s\S]*?\)\n;', data_str, foam_data, count=1)
        with open(foam_file, "w") as f:
            f.write(foam_data)
        output += f"\n✅ {var} mis à jour"

    if temperature_data is not None and velocity_data is not None:
        output += "\n" + include_all_features_NC(temperature_data, latestML_time_dir, velocity_data, adjust_phi=True)

    return output


def numpyToFoamDirect(training_config: TrainingConfig,
                      latestML_time: float,
                      data_dict: Dict[str, np.ndarray],
                      latestCFD_time: Optional[float] = None,
                      solver_dir: Optional[Path] = None) -> str:
    """Version directe sans fichiers .npy intermédiaires."""
    solver_dir = Path(solver_dir) if solver_dir else training_config.solver_dir
    if latestCFD_time is None:
        latestCFD_time = OpenfoamUtils.max_time_directory(solver_dir, round_to=training_config.round_to)
    else:
        latestCFD_time = float(latestCFD_time)

    latestCFD_time_dir = solver_dir / (str(int(latestCFD_time)) if latestCFD_time.is_integer() else str(latestCFD_time))
    ml_dir_name = str(int(latestML_time)) if latestML_time.is_integer() else str(latestML_time)
    latestML_time_dir = solver_dir / ml_dir_name

    if not latestML_time_dir.exists():
        subprocess.run(["cp", "-r", str(latestCFD_time_dir), str(latestML_time_dir)], check=True)

    output = manage_time_uniform(solver_dir, latestML_time)

    for var, data in data_dict.items():
        foam_file = latestML_time_dir / var
        data_str = "(\n" + parse_numpy(data) + "\n)\n;"
        with open(foam_file, "r") as f:
            foam_data = f.read()
        foam_data = re.sub(r'\([\s\S]*?\)\n;', data_str, foam_data, count=1)
        with open(foam_file, "w") as f:
            f.write(foam_data)
        output += f"\n✅ {var} mis à jour"

    if "T" in data_dict and "U" in data_dict:
        output += "\n" + include_all_features_NC(data_dict["T"], latestML_time_dir, data_dict["U"], adjust_phi=True)

    return output
