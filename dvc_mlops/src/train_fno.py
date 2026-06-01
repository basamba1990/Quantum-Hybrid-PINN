
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import mlflow
import mlflow.pytorch
import argparse
import json
from pathlib import Path
import sys

# Add the parent directory of fno_3d_navier_stokes.py to the Python path
sys.path.append(str(Path(__file__).resolve().parents[3] / 'apps' / 'api'))

from fno_3d_navier_stokes import FNO3D, FLUID_CONFIGS

# Dummy DataLoader for now, will be replaced by actual data loading
class DummyDataLoader:
    def __init__(self, data_path, batch_size=1):
        self.data = np.load(data_path)['data']
        self.batch_size = batch_size
        self.current_idx = 0

    def __iter__(self):
        self.current_idx = 0
        return self

    def __next__(self):
        if self.current_idx >= len(self.data):
            raise StopIteration
        batch = self.data[self.current_idx:self.current_idx + self.batch_size]
        self.current_idx += self.batch_size
        # Assuming data is (N, X, Y, Z, C) where C is in_channels
        # FNO3D expects (batch_size, X, Y, Z, in_channels)
        return torch.from_numpy(batch).float()

    def __len__(self):
        return (len(self.data) + self.batch_size - 1) // self.batch_size

def train_fno(train_data_path: str, val_data_path: str, fluid_type: str, epochs: int, learning_rate: float, n_modes: int, width: int, in_channels: int, out_channels: int, model_output_path: str):
    mlflow.set_experiment("FNO_Training")
    with mlflow.start_run():
        mlflow.log_params({
            "fluid_type": fluid_type,
            "epochs": epochs,
            "learning_rate": learning_rate,
            "n_modes": n_modes,
            "width": width,
            "in_channels": in_channels,
            "out_channels": out_channels
        })

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        model = FNO3D(modes1=n_modes, modes2=n_modes, modes3=n_modes, width=width, fluid_type=fluid_type, in_channels=in_channels, out_channels=out_channels).to(device)
        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        loss_fn = nn.MSELoss()

        train_loader = DummyDataLoader(train_data_path, batch_size=4) # Adjust batch size as needed
        val_loader = DummyDataLoader(val_data_path, batch_size=4)

        for epoch in range(epochs):
            model.train()
            train_loss = 0
            for batch in train_loader:
                batch = batch.to(device)
                # Assuming input is first `in_channels` and output is remaining `out_channels`
                # This needs to be adapted based on actual data structure
                input_data = batch[..., :in_channels]
                target_data = batch[..., in_channels:]

                optimizer.zero_grad()
                output = model(input_data)
                loss = loss_fn(output, target_data)
                loss.backward()
                optimizer.step()
                train_loss += loss.item()
            scheduler.step()
            avg_train_loss = train_loss / len(train_loader)

            model.eval()
            val_loss = 0
            with torch.no_grad():
                for batch in val_loader:
                    batch = batch.to(device)
                    input_data = batch[..., :in_channels]
                    target_data = batch[..., in_channels:]
                    output = model(input_data)
                    loss = loss_fn(output, target_data)
                    val_loss += loss.item()
            avg_val_loss = val_loss / len(val_loader)

            mlflow.log_metrics({"train_loss": avg_train_loss, "val_loss": avg_val_loss}, step=epoch)
            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch + 1}/{epochs}, Train Loss: {avg_train_loss:.4f}, Val Loss: {avg_val_loss:.4f}")

        mlflow.pytorch.log_model(model, "fno_model")
        torch.save(model.state_dict(), model_output_path)
        print(f"Model saved to {model_output_path}")

        # Log metrics to a file for DVC
        metrics = {"final_train_loss": avg_train_loss, "final_val_loss": avg_val_loss}
        with open("metrics/fno_metrics.json", "w") as f:
            json.dump(metrics, f)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train FNO model.")
    parser.add_argument("--train_data_path", type=str, default="data/processed/train.npz", help="Path to training data.")
    parser.add_argument("--val_data_path", type=str, default="data/processed/val.npz", help="Path to validation data.")
    parser.add_argument("--fluid_type", type=str, default="H2", help="Fluid type for FNO model.")
    parser.add_argument("--epochs", type=int, default=100, help="Number of training epochs.")
    parser.add_argument("--learning_rate", type=float, default=1e-3, help="Learning rate.")
    parser.add_argument("--n_modes", type=int, default=12, help="Number of modes for FNO.")
    parser.add_argument("--width", type=int, default=32, help="Width for FNO.")
    parser.add_argument("--in_channels", type=int, default=1, help="Number of input channels.")
    parser.add_argument("--out_channels", type=int, default=1, help="Number of output channels.")
    parser.add_argument("--model_output_path", type=str, default="models/fno_model.pt", help="Path to save the trained model.")

    args = parser.parse_args()

    # Create models directory if it doesn't exist
    Path("models").mkdir(parents=True, exist_ok=True)
    Path("metrics").mkdir(parents=True, exist_ok=True)

    train_fno(
        train_data_path=args.train_data_path,
        val_data_path=args.val_data_path,
        fluid_type=args.fluid_type,
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        n_modes=args.n_modes,
        width=args.width,
        in_channels=args.in_channels,
        out_channels=args.out_channels,
        model_output_path=args.model_output_path
    )
