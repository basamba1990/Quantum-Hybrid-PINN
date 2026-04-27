"""
Dataset Manager Module
Unified interface for managing CFD and ML datasets.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import logging
import numpy as np
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class DatasetMetadata:
    """Metadata for a dataset."""
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
    """
    Manages CFD and ML datasets with preprocessing, normalization, and caching.
    """
    
    def __init__(self, cache_dir: Optional[Union[str, Path]] = None):
        """
        Initialize dataset manager.
        
        Args:
            cache_dir: Directory for caching processed datasets
        """
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".cache" / "quantum_hybrid"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.datasets: Dict[str, DatasetMetadata] = {}
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def load_cfd_dataset(
        self,
        case_path: Union[str, Path],
        fields: List[str],
        time_range: Tuple[float, float],
        normalize: bool = True
    ) -> Tuple[np.ndarray, DatasetMetadata]:
        """
        Load CFD dataset from OpenFOAM case.
        
        Args:
            case_path: Path to OpenFOAM case
            fields: List of field names to load (e.g., ['U', 'p', 'T'])
            time_range: (start_time, end_time)
            normalize: Whether to normalize the data
            
        Returns:
            Tuple of (data_array, metadata)
        """
        case_path = Path(case_path)
        
        if not case_path.exists():
            raise FileNotFoundError(f"Case path not found: {case_path}")
        
        # Load data from time directories
        data_list = []
        times = []
        
        for time_dir in sorted(case_path.iterdir()):
            if not time_dir.is_dir():
                continue
            
            try:
                time_val = float(time_dir.name)
                if time_range[0] <= time_val <= time_range[1]:
                    times.append(time_val)
                    
                    # Load fields for this time step
                    time_data = []
                    for field in fields:
                        field_file = time_dir / field
                        if field_file.exists():
                            # Load field data (placeholder - adapt to your format)
                            field_data = self._load_field(field_file)
                            time_data.append(field_data)
                    
                    if time_data:
                        data_list.append(np.concatenate(time_data, axis=0))
            
            except (ValueError, OSError):
                continue
        
        if not data_list:
            raise ValueError(f"No data found in time range {time_range}")
        
        # Stack all time steps
        data = np.array(data_list)  # shape: (n_times, n_features, ...)
        
        # Normalize if requested
        mean_values = None
        std_values = None
        if normalize:
            data, mean_values, std_values = self._normalize_data(data, fields)
        
        # Create metadata
        metadata = DatasetMetadata(
            name=case_path.name,
            path=case_path,
            created_at=datetime.utcnow(),
            fields=fields,
            time_range=time_range,
            grid_shape=data.shape[1:],
            n_samples=len(times),
            normalized=normalize,
            mean_values=mean_values,
            std_values=std_values
        )
        
        # Store metadata
        self.datasets[case_path.name] = metadata
        
        self.logger.info(f"Loaded CFD dataset: {case_path.name}, shape={data.shape}")
        return data, metadata
    
    def _load_field(self, field_file: Path) -> np.ndarray:
        """
        Load a single field from OpenFOAM file.
        
        Args:
            field_file: Path to field file
            
        Returns:
            Field data as numpy array
        """
        # Placeholder implementation
        # In practice, use Ofpp or similar to parse OpenFOAM files
        try:
            import Ofpp
            data = Ofpp.parse_internal_field(str(field_file))
            return data.reshape(1, -1)  # Flatten to 1D
        except Exception as e:
            self.logger.warning(f"Could not load field {field_file}: {e}")
            return np.array([[]])
    
    def _normalize_data(
        self,
        data: np.ndarray,
        fields: List[str]
    ) -> Tuple[np.ndarray, Dict[str, float], Dict[str, float]]:
        """
        Normalize data to zero mean and unit variance.
        
        Args:
            data: Input data
            fields: Field names for tracking statistics
            
        Returns:
            Tuple of (normalized_data, mean_values, std_values)
        """
        mean_values = {}
        std_values = {}
        normalized_data = data.copy()
        
        # Compute statistics per field
        for i, field in enumerate(fields):
            field_data = data[:, i:i+1]  # Select field
            mean = np.mean(field_data)
            std = np.std(field_data)
            
            if std > 0:
                normalized_data[:, i:i+1] = (field_data - mean) / std
            
            mean_values[field] = float(mean)
            std_values[field] = float(std)
        
        return normalized_data, mean_values, std_values
    
    def denormalize_predictions(
        self,
        predictions: np.ndarray,
        metadata: DatasetMetadata
    ) -> np.ndarray:
        """
        Denormalize predictions using stored statistics.
        
        Args:
            predictions: Normalized predictions
            metadata: Dataset metadata with normalization stats
            
        Returns:
            Denormalized predictions
        """
        if not metadata.normalized or not metadata.mean_values or not metadata.std_values:
            return predictions
        
        denormalized = predictions.copy()
        
        for i, field in enumerate(metadata.fields):
            mean = metadata.mean_values.get(field, 0.0)
            std = metadata.std_values.get(field, 1.0)
            
            if std > 0:
                denormalized[:, i:i+1] = predictions[:, i:i+1] * std + mean
        
        return denormalized
    
    def split_train_test(
        self,
        data: np.ndarray,
        train_ratio: float = 0.8
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Split dataset into training and testing sets.
        
        Args:
            data: Full dataset
            train_ratio: Fraction for training
            
        Returns:
            Tuple of (train_data, test_data)
        """
        n_samples = len(data)
        n_train = int(n_samples * train_ratio)
        
        train_data = data[:n_train]
        test_data = data[n_train:]
        
        self.logger.info(f"Split dataset: {n_train} train, {n_samples - n_train} test")
        return train_data, test_data
    
    def create_sequences(
        self,
        data: np.ndarray,
        sequence_length: int,
        stride: int = 1
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sequences for autoregressive training.
        
        Args:
            data: Input data (n_samples, n_features, ...)
            sequence_length: Length of sequences
            stride: Stride between sequences
            
        Returns:
            Tuple of (input_sequences, target_sequences)
        """
        input_sequences = []
        target_sequences = []
        
        for i in range(0, len(data) - sequence_length, stride):
            input_seq = data[i:i+sequence_length]
            target_seq = data[i+1:i+sequence_length+1]
            
            input_sequences.append(input_seq)
            target_sequences.append(target_seq)
        
        return np.array(input_sequences), np.array(target_sequences)
    
    def save_dataset(
        self,
        data: np.ndarray,
        metadata: DatasetMetadata,
        output_path: Optional[Union[str, Path]] = None
    ) -> Path:
        """
        Save processed dataset to disk.
        
        Args:
            data: Dataset to save
            metadata: Dataset metadata
            output_path: Output path (default: cache_dir)
            
        Returns:
            Path to saved dataset
        """
        if output_path is None:
            output_path = self.cache_dir / f"{metadata.name}_{datetime.utcnow().timestamp()}.npz"
        else:
            output_path = Path(output_path)
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save data and metadata
        np.savez(
            output_path,
            data=data,
            fields=np.array(metadata.fields),
            time_range=np.array(metadata.time_range),
            mean_values=np.array([metadata.mean_values.get(f, 0.0) for f in metadata.fields]),
            std_values=np.array([metadata.std_values.get(f, 1.0) for f in metadata.fields])
        )
        
        self.logger.info(f"Saved dataset to {output_path}")
        return output_path
    
    def load_dataset(self, dataset_path: Union[str, Path]) -> Tuple[np.ndarray, DatasetMetadata]:
        """
        Load previously saved dataset.
        
        Args:
            dataset_path: Path to saved dataset
            
        Returns:
            Tuple of (data, metadata)
        """
        dataset_path = Path(dataset_path)
        
        if not dataset_path.exists():
            raise FileNotFoundError(f"Dataset not found: {dataset_path}")
        
        loaded = np.load(dataset_path, allow_pickle=True)
        data = loaded['data']
        fields = list(loaded['fields'])
        time_range = tuple(loaded['time_range'])
        
        # Reconstruct metadata
        mean_values = {f: float(m) for f, m in zip(fields, loaded['mean_values'])}
        std_values = {f: float(s) for f, s in zip(fields, loaded['std_values'])}
        
        metadata = DatasetMetadata(
            name=dataset_path.stem,
            path=dataset_path,
            created_at=datetime.utcnow(),
            fields=fields,
            time_range=time_range,
            grid_shape=data.shape[1:],
            n_samples=len(data),
            normalized=True,
            mean_values=mean_values,
            std_values=std_values
        )
        
        self.logger.info(f"Loaded dataset from {dataset_path}, shape={data.shape}")
        return data, metadata
