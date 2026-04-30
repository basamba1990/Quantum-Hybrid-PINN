"""
Dataset Manager – Version industrielle avec parsing OpenFOAM
"""

import re
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@dataclass
class DatasetMetadata:
    name: str
    path: Path
    created_at: datetime
    fields: List[str]
    time_range: Tuple[float, float]
    grid_shape: Tuple[int, ...]
    n_samples: int
    normalized: bool = False
    mean_values: Optional[Dict[str, float]] = None
    std_values: Optional[Dict[str, float]] = None


class DatasetManager:
    def __init__(self, cache_dir: Optional[Union[str, Path]] = None):
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".cache" / "quantum_hybrid"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.datasets: Dict[str, DatasetMetadata] = {}

    def load_cfd_dataset(self, case_path: Union[str, Path], fields: List[str],
                         time_range: Tuple[float, float], normalize: bool = True):
        case_path = Path(case_path)
        if not case_path.exists():
            raise FileNotFoundError(f"Case path not found: {case_path}")

        data_list = []
        times = []
        for time_dir in sorted(case_path.iterdir()):
            if not time_dir.is_dir():
                continue
            try:
                time_val = float(time_dir.name)
                if time_range[0] <= time_val <= time_range[1]:
                    times.append(time_val)
                    time_data = []
                    for field in fields:
                        field_file = time_dir / field
                        if field_file.exists():
                            field_data = self._load_field(field_file)
                            time_data.append(field_data)
                    if time_data:
                        data_list.append(np.concatenate(time_data, axis=0))
            except (ValueError, OSError):
                continue

        if not data_list:
            raise ValueError(f"No data found in time range {time_range}")

        data = np.array(data_list)
        mean_values = std_values = None
        if normalize:
            data, mean_values, std_values = self._normalize_data(data, fields)

        metadata = DatasetMetadata(
            name=case_path.name, path=case_path, created_at=datetime.utcnow(),
            fields=fields, time_range=time_range, grid_shape=data.shape[1:],
            n_samples=len(times), normalized=normalize,
            mean_values=mean_values, std_values=std_values
        )
        self.datasets[case_path.name] = metadata
        return data, metadata

    def _load_field(self, field_file: Path) -> np.ndarray:
        """Parse OpenFOAM ASCII – volScalarField / volVectorField réels"""
        with open(field_file, 'r') as f:
            content = f.read()

        # Détection vector field (U) vs scalar (p, T)
        if 'vector' in content.lower():
            # Format: internalField nonuniform List<vector> N ( (x y z) ... )
            match = re.search(r'internalField\s+nonuniform\s+List<vector>\s+(\d+)\s+\(([\s\S]*?)\);', content, re.DOTALL)
            if match:
                n = int(match.group(1))
                vector_text = match.group(2)
                # Extraire les triplets
                values = []
                for triplet in re.findall(r'\(([^)]+)\)', vector_text):
                    comps = list(map(float, triplet.strip().split()))
                    if len(comps) == 3:
                        values.extend(comps)
                arr = np.array(values).reshape(-1, 3)
                return arr  # shape (n_cells, 3)
        else:
            # Scalar field
            match = re.search(r'internalField\s+nonuniform\s+List<scalar>\s+(\d+)\s+\(([\d\s\.,eE+-]+)\);', content, re.DOTALL)
            if match:
                n = int(match.group(1))
                values = np.fromstring(match.group(2), sep=' ')
                if len(values) == n:
                    return values.reshape(-1, 1)
        raise ValueError(f"Format non supporté ou champ absent : {field_file}")

    def _normalize_data(self, data, fields):
        mean_values, std_values = {}, {}
        norm_data = data.copy()
        for i, f in enumerate(fields):
            mean = np.mean(data[:, i])
            std = np.std(data[:, i])
            if std > 0:
                norm_data[:, i] = (data[:, i] - mean) / std
            mean_values[f] = float(mean)
            std_values[f] = float(std)
        return norm_data, mean_values, std_values

    def denormalize_predictions(self, predictions, metadata):
        if not metadata.normalized or not metadata.mean_values or not metadata.std_values:
            return predictions
        denorm = predictions.copy()
        for i, f in enumerate(metadata.fields):
            mean = metadata.mean_values.get(f, 0.0)
            std = metadata.std_values.get(f, 1.0)
            if std > 0:
                denorm[:, i] = predictions[:, i] * std + mean
        return denorm

    def save_dataset(self, data, metadata, output_path=None):
        output_path = Path(output_path) if output_path else self.cache_dir / f"{metadata.name}_{datetime.utcnow().timestamp()}.npz"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        np.savez(output_path, data=data, fields=np.array(metadata.fields),
                 time_range=np.array(metadata.time_range),
                 mean_values=np.array([metadata.mean_values.get(f,0.0) for f in metadata.fields]),
                 std_values=np.array([metadata.std_values.get(f,1.0) for f in metadata.fields]))
        return output_path
