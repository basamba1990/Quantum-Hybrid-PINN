from pathlib import Path
import subprocess
import re
from copy import deepcopy
from typing import Dict, List, Optional, Union
import logging

import numpy as np
import torch
import Ofpp

from .config import TrainingConfig, OpenfoamConfig
from .utils import OpenfoamUtils

# ========== LOGGER AJOUTÉ ==========
logger = logging.getLogger(__name__)
# ===================================

# torch.set_default_dtype(torch.float64)  # Désactivé pour éviter les conflits de type avec le modèle FNO (float32)

# Default Values:
MOL_WT = 0.02896  # kg/mol
GAS_CONSTANT = 8.31446261815324  # J/(mol*K)
GRAVITY = 9.81  # m/s^2
ALPHA = 0.00343  # Thermal expansion coefficient for air at 20 degrees Celsius in 1/K


def calculate_rho(
    pressure_data: np.ndarray,
    temperature_data: np.ndarray,
    mol_wt: float = MOL_WT,
    gas_constant: float = GAS_CONSTANT,
) -> np.ndarray:
    """
    To calculate rho:
    rho = P*W / R*T
        P: latest CFD time kg/ms2
        W: 28.96 gm/mol | 0.02896 kg/mol
        R: 8.31446261815324 J/mol.K
        T: Predicted field K

    OR:
    rho = rho_0 - alpha*rho_0(T-T_0):
        https://www.simscale.com/docs/simwiki/cfd-computational-fluid-dynamics/what-is-boussinesq-approximation/
    """
    temperature_data = temperature_data.reshape(-1)
    rho_idealgas = (pressure_data * mol_wt) / (gas_constant * temperature_data)
    return rho_idealgas


def calculate_prgh(pressure_data: np.ndarray, temperature_data: np.ndarray) -> np.ndarray:
    """
    The height is exactly this:
    array([[0.005, 0.01 , 0.015, ..., 0.99 , 0.995, 1.   ],
           [0.005, 0.01 , 0.015, ..., 0.99 , 0.995, 1.   ],
           ...,
           [0.005, 0.01 , 0.015, ..., 0.99 , 0.995, 1.   ]])
    """
    gravity = 9.81
    temperature_data = temperature_data.reshape(-1)
    temp_avg = np.mean(temperature_data)
    mol_wt = 0.02896
    gas_constant = 8.31446261815324

    spatial_range = OpenfoamUtils.generate_intervals(0.005, 200 * 0.005, time_step=0.005, round_to=3)
    spatial_range = np.array(spatial_range).reshape(-1,)
    height = np.tile(spatial_range, (200, 1))

    pressure_data = pressure_data.reshape(200, 200)
    temperature_data = temperature_data.reshape(200, 200)

    p_rgh = pressure_data - ((mol_wt * gravity) / (gas_constant * temp_avg)) * (pressure_data * height)
    return p_rgh.reshape(-1)


def include_all_features_NC(
    temperature_data: np.ndarray,
    latestML_time_dir: Path,
    velocity_data: np.ndarray,
    adjust_phi: bool = True,
) -> str:
    pressure_path = latestML_time_dir / "p"
    assert pressure_path, '''You must have "pressure file" -- we are using pressure value from the latest CFD simulation;\n
    Because they are almost constant all over the simulation, so it does not matter.
    '''
    pressure_data = Ofpp.parse_internal_field(str(pressure_path))
    rho_data = calculate_rho(pressure_data, temperature_data)
    # p_rgh = calculate_prgh(pressure_data, temperature_data)
    # phi = calculate_phi(...)  # optional, commented in original
    for file in latestML_time_dir.iterdir():
        if file == latestML_time_dir / "rho":
            data_str = "(\n" + parse_numpy(rho_data) + "\n)\n;"
            with open(file, "r") as f:
                foam_data = f.read()
                foam_data = re.sub(r'\([\s\S]*?\)\n;', f"{data_str}", foam_data, count=1)
            with open(file, "w") as f:
                f.write(foam_data)
        # elif file == latestML_time_dir / "p_rgh":  # commented in original
        #     ...
        # elif file == latestML_time_dir / "phi":   # commented in original
        #     ...

    if adjust_phi:
        # ========== PATCH 5 : Remplacer adjustPhiML par adjustPhi standard ==========
        command_to_adjustPhi = ["adjustPhi", "-case", str(latestML_time_dir.parent), "-time", latestML_time_dir.name]
        try:
            return subprocess.run(command_to_adjustPhi, check=True, capture_output=True, text=True).stdout
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("adjustPhi command failed or not found. Continuing without flux adjustment.")
            return "adjustPhi command failed or not found."
    return "Done!"


def format_number(x: float) -> str:
    """Format a number to 17 significant digits without scientific notation."""
    return f"{x:.17g}"


def parse_numpy(data: np.ndarray) -> str:
    """
    Convert a NumPy array to a string representation suitable for OpenFOAM field files with writePrecision of 12.
    This ensures 12 significant digits while removing unnecessary trailing zeros.

    Args
    ----
    data: np.ndarray
        The NumPy array to convert.

    Returns
    -------
    parsed_output: str
        The string representation of the data enclosed by parentheses.

    Example
    -------
        "(0.000123456789102 1.23456789012 1234567890.12)"
    """
    if data.ndim == 1:
        return "\n".join(map(format_number, data))
    elif data.ndim == 2:
        if data.shape[1] == 1:  # 1D array stored as column vector
            return "\n".join(map(format_number, data[:, 0]))
        elif data.shape[1] == 2:  # 2D array (vector fields, need (x y z))
            lines = [f"({format_number(x[0])} {format_number(x[1])} 0)" for x in data]
            return "\n".join(lines)
        else:  # 3D array (full vectors)
            lines = [f"({format_number(x[0])} {format_number(x[1])} {format_number(x[2])})" for x in data]
            return "\n".join(lines)
    else:
        raise ValueError("Data shape not supported. Aborting conversion from numpy to OpenFOAM.")


def manage_time_uniform(solver_dir: Path, latestML_time: Union[int, float]) -> str:
    """
    Changing time folder
    ---------------------
    command::

        foamDictionary -case solver_dir -entry value -set latestML_time latestCFD_time/uniform/time

        foamDictionary -case solver_dir -entry name -set '"latestML_time"' latestCFD_time/0/time

        foamDictionary -case solver_dir -entry index -set latestML_time_without_decimal latestCFD_time/constant/time

    It also replaces the location values in every files inside the time directory.
    Files like U, p, T, uniform/time, etc.
    """
    files_list = []
    ml_dir_name = str(int(latestML_time)) if isinstance(latestML_time, (int, float)) and latestML_time == int(latestML_time) else str(latestML_time)
    time_dir = solver_dir / ml_dir_name
    if not time_dir.exists():
        return f"Time directory {time_dir} does not exist."
    for file in time_dir.iterdir():
        if file.is_file():
            files_list.append(file)

    uniform_time_dir = time_dir / "uniform" / "time"
    if uniform_time_dir.exists():
        files_list.append(uniform_time_dir)

    for file in files_list:
        if file == uniform_time_dir:
            replace_string = "/uniform"
        else:
            replace_string = ""
        with open(file, "r") as f:
            data = f.read()
            foam_data = re.sub(r'(location\s*)"([^"]*)"', rf'\1"{ml_dir_name}{replace_string}"', data)
        with open(file, "w") as f:
            f.write(foam_data)

    command_to_change_time_value = [
        "foamDictionary",
        "-case",
        str(solver_dir),
        "-entry",
        "value",
        "-set",
        f"{latestML_time}",
        f"{ml_dir_name}/uniform/time",
    ]

    command_to_change_time_name = [
        "foamDictionary",
        "-case",
        str(solver_dir),
        "-entry",
        "name",
        "-set",
        f'"{ml_dir_name}"',
        f"{ml_dir_name}/uniform/time",
    ]

    if isinstance(latestML_time, (int, float)) and latestML_time == int(latestML_time):
        index_val = int(latestML_time * 100)
    else:
        index_val = int(str(latestML_time).replace(".", "")) if "." in str(latestML_time) else int(latestML_time) * 100

    command_to_change_time_index = [
        "foamDictionary",
        "-case",
        str(solver_dir),
        "-entry",
        "index",
        "-set",
        f"{index_val}",
        f"{ml_dir_name}/uniform/time",
    ]

    try:
        output_value = subprocess.run(command_to_change_time_value, check=True, capture_output=True, text=True)
        output_name = subprocess.run(command_to_change_time_name, check=True, capture_output=True, text=True)
        output_index = subprocess.run(command_to_change_time_index, check=True, capture_output=True, text=True)
        output_string = f"{output_value.stdout}\n{output_name.stdout}\n{output_index.stdout}"
    except subprocess.CalledProcessError as e:
        output_string = f"Error updating uniform/time: {e}"

    return output_string


def numpyToFoam(
    openfoam_config: OpenfoamConfig,
    latestML_time: float,
    latestCFD_time: Optional[Union[int, float]] = None,
    variables: Optional[List[str]] = None,
    solver_dir: Optional[Path] = None,
    assets_path: Optional[Path] = None,
    is_ground_truth: bool = False,
) -> str:
    """
    This function takes a numpy file and writes it to an OpenFOAM file.

    Args
    ----
    openfoam_config: OpenfoamConfig:
        The OpenFOAM configuration object.
    latestML_time: float
        The final time step for which ML simulation is present.
    latestCFD_time: int|float
        The final time step for which OpenFOAM file is already present.
    variables: list()
        The OpenFOAM variables list.
    solver_dir: Path
        The directory of the solver inside "Solvers" directory e.g: "Solvers/natural_convection"
    assets_path: Path
        The path to the assets directory where the numpy files are stored: e.g: "Assets/natural_convection"
    is_ground_truth: bool
        If True, it will load the ground truth data. If False, it will load the predicted data.
        Because, for the predicted cases we will have var_timestamp_predicted.npy files.

    NOTE
    ----
    The latestCFD_time should be the time step for which the OpenFOAM file is already present.
    Because, we need to copy format to the present time step for which we are trying to run the
    simulation.

    Returns
    -------
    True if the function executes successfully.

    Remember
    --------
    latestML_time should always be float value. Because, while saving any value to numpy, we save it as float.
    see: repitframework/OpenFOAM/utils.py: parse_numpy

    Example
    -------
    If we have a numpy file U_3.npy, we can write it to the OpenFOAM file U at time t=3.
    """
    solver_dir = Path(solver_dir) if solver_dir else openfoam_config.solver_dir
    assets_path = Path(assets_path) if assets_path else openfoam_config.assets_dir
    variables = variables if variables else openfoam_config.get_variables()

    if latestCFD_time is None:
        latestCFD_time = OpenfoamUtils.max_time_directory(solver_dir, round_to=openfoam_config.round_to)
    else:
        latestCFD_time = float(latestCFD_time)

    latestCFD_time_dir = solver_dir / (str(int(latestCFD_time)) if isinstance(latestCFD_time, (int, float)) and latestCFD_time == int(latestCFD_time) else str(latestCFD_time))
    ml_dir_time_name = str(int(latestML_time)) if isinstance(latestML_time, (int, float)) and latestML_time == int(latestML_time) else str(latestML_time)
    latestML_time_dir = solver_dir / ml_dir_time_name

    # copy the contents of latest CFD simulation time to the latest ML simulation time.
    if not latestML_time_dir.exists():
        subprocess.run(["cp", "-r", str(latestCFD_time_dir), str(latestML_time_dir)], check=True)

    output_string = manage_time_uniform(solver_dir, latestML_time)

    temperature_data = None
    velocity_data = None

    for variable in variables:
        if is_ground_truth:
            numpy_file_name = f"{variable}_{latestML_time}.npy"
        else:
            numpy_file_name = f"{variable}_{latestML_time}_predicted.npy"
        openfoam_var_path = latestML_time_dir / variable
        numpy_file_path = assets_path / numpy_file_name

        # numpy file processing:
        data = np.load(numpy_file_path)
        if variable == "T":
            temperature_data = deepcopy(data)
        elif variable == "U":
            velocity_data = deepcopy(data)

        data_str = "(\n" + parse_numpy(data) + "\n)\n;"

        with open(openfoam_var_path, "r") as file:
            foam_data_temp = file.read()
            foam_data = re.sub(r'(location\s*)"([^"]*)"', rf'\1"{ml_dir_time_name}"', foam_data_temp)
            foam_data = re.sub(r'\([\s\S]*?\)\n;', f"{data_str}", foam_data, count=1)

        with open(openfoam_var_path, "w") as file:
            file.write(foam_data)

    if temperature_data is not None and velocity_data is not None:
        output_string += include_all_features_NC(
            temperature_data, latestML_time_dir, velocity_data, adjust_phi=True
        )
    return output_string


def numpyToFoamDirect(
    training_config: TrainingConfig,
    latestML_time: float,
    data_dict: Dict[str, np.ndarray],
    latestCFD_time: Optional[Union[int, float]] = None,
    solver_dir: Optional[Path] = None,
) -> str:
    solver_dir = Path(solver_dir) if solver_dir else training_config.solver_dir

    if latestCFD_time is None:
        latestCFD_time = OpenfoamUtils.max_time_directory(solver_dir, round_to=training_config.round_to)
    else:
        latestCFD_time = float(latestCFD_time)

    latestCFD_time_dir = solver_dir / (str(int(latestCFD_time)) if isinstance(latestCFD_time, (int, float)) and latestCFD_time == int(latestCFD_time) else str(latestCFD_time))
    ml_dir_time_name = str(int(latestML_time)) if isinstance(latestML_time, (int, float)) and latestML_time == int(latestML_time) else str(latestML_time)
    latestML_time_dir = solver_dir / ml_dir_time_name

    # copy the contents of latest CFD simulation time to the latest ML simulation time.
    if not latestML_time_dir.exists():
        subprocess.run(["cp", "-r", str(latestCFD_time_dir), str(latestML_time_dir)], check=True)

    output_string = manage_time_uniform(solver_dir, latestML_time)

    for variable, data in data_dict.items():
        openfoam_var_path = latestML_time_dir / variable
        data_str = "(\n" + parse_numpy(data) + "\n)\n;"

        with open(openfoam_var_path, "r") as file:
            foam_data_temp = file.read()
            foam_data = re.sub(r'(location\s*)"([^"]*)"', rf'\1"{ml_dir_time_name}"', foam_data_temp)
            foam_data = re.sub(r'\([\s\S]*?\)\n;', f"{data_str}", foam_data, count=1)

        with open(openfoam_var_path, "w") as file:
            file.write(foam_data)

    if "T" in data_dict and "U" in data_dict:
        output_string += include_all_features_NC(
            data_dict["T"], latestML_time_dir, data_dict["U"], adjust_phi=True
        )
    return output_string


class NumpyToFoamConverter:
    """
    Convertisseur de données NumPy vers fichiers OpenFOAM.
    Utilisé par l'API pour l'endpoint /openfoam/reinject-data.
    """

    def __init__(self, case_path: Union[str, Path]):
        """
        Initialise le convertisseur avec le chemin du cas OpenFOAM.

        Args:
            case_path: Chemin vers le répertoire du cas OpenFOAM
        """
        self.case_path = Path(case_path)

    def convert_and_write(
        self,
        field_name: str,
        data: List[List[float]],
        time_step: float,
        latestCFD_time: Optional[Union[int, float]] = None,
    ) -> str:
        """
        Convertit une matrice 2D (liste de listes) en champ OpenFOAM et l'écrit
        dans le répertoire de temps correspondant.

        Args:
            field_name: Nom du champ (ex: "U", "p", "T")
            data: Données 2D (ex: numpy array converti en liste)
            time_step: Instant auquel écrire le champ
            latestCFD_time: Dernier temps CFD existant (optionnel)

        Returns:
            Chemin du fichier OpenFOAM créé
        """
        # Convertir la liste en numpy array
        np_data = np.array(data, dtype=np.float64)

        # Créer un dictionnaire avec le champ
        data_dict = {field_name: np_data}

        # Utiliser numpyToFoamDirect pour écrire le champ
        config = TrainingConfig()
        config.solver_dir = self.case_path

        output_log = numpyToFoamDirect(
            training_config=config,
            latestML_time=time_step,
            data_dict=data_dict,
            latestCFD_time=latestCFD_time,
            solver_dir=self.case_path,
        )

        # Retourner le chemin du fichier créé
        time_dir_name = str(int(time_step)) if float(time_step).is_integer() else str(time_step)
        output_file = self.case_path / time_dir_name / field_name
        return str(output_file)


if __name__ == "__main__":
    openfoam_config = TrainingConfig()
    output_string = numpyToFoam(
        openfoam_config,
        latestCFD_time=10.0,
        latestML_time=10.53,
        is_ground_truth=False,
        assets_path=Path("/home/shilaj/shilaj_data/repit_tf/DataSample"),
    )
    print(output_string)
