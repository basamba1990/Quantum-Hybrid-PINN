
import numpy as np
import h5py
from pathlib import Path
import argparse
import json
import sys

# Add the parent directory of repit_integration to the Python path
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
    from repit_integration.dataset_manager import DatasetManager
except ImportError:
    # Fallback for Colab
    sys.path.append('/content/Quantum-Hybrid-PINN/apps/api')
    from repit_integration.dataset_manager import DatasetManager

def prepare_data(case_path: str, output_dir: str, fields: list, time_range: tuple, normalize: bool = True):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    manager = DatasetManager()
    data, metadata = manager.load_cfd_dataset(case_path, fields, time_range, normalize)

    train_ratio = 0.8
    split_idx = int(len(data) * train_ratio)

    train_data = data[:split_idx]
    val_data = data[split_idx:]

    np.savez(output_path / 'train.npz', data=train_data)
    np.savez(output_path / 'val.npz', data=val_data)

    # Save metadata for later use
    with open(output_path / 'metadata.json', 'w') as f:
        json.dump(metadata.__dict__, f, default=str)

    print(f"Prepared data saved to {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Prepare CFD data for FNO/PINN training.')
    parser.add_argument('--case_path', type=str, required=True, help='Path to the OpenFOAM case directory.')
    parser.add_argument('--output_dir', type=str, default='data/processed', help='Output directory for processed data.')
    parser.add_argument('--fields', nargs='+', default=['p', 'U', 'T'], help='List of fields to extract (e.g., p U T).')
    parser.add_argument('--time_start', type=float, default=0.0, help='Start time for data extraction.')
    parser.add_argument('--time_end', type=float, default=1.0, help='End time for data extraction.')
    parser.add_argument('--no_normalize', action='store_false', dest='normalize', help='Do not normalize the data.')

    args = parser.parse_args()

    prepare_data(
        case_path=args.case_path,
        output_dir=args.output_dir,
        fields=args.fields,
        time_range=(args.time_start, args.time_end),
        normalize=args.normalize
    )
