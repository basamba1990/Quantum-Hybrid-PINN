from __future__ import annotations

import os
from typing import List

import pennylane as qml
import torch
import torch.nn as nn


class QuantumLayer(nn.Module):
    """Real variational quantum layer backed by PennyLane.

    The default research configuration is ``default.qubit`` with ``shots=None``:
    exact expectation values and differentiable backpropagation. This is a
    simulator baseline, not evidence of quantum advantage or QPU performance.
    """

    def __init__(
        self,
        n_qubits: int = 4,
        n_layers: int = 2,
        shots: int | None = None,
        device_name: str = "default.qubit",
    ) -> None:
        super().__init__()
        if n_qubits < 2:
            raise ValueError("n_qubits doit être >= 2")
        if shots is not None and shots <= 0:
            raise ValueError("shots doit être None ou un entier positif")
        if device_name != "default.qubit":
            raise ValueError("Le prototype reproductible utilise uniquement default.qubit")

        self.n_qubits = n_qubits
        self.n_layers = n_layers
        self.shots = shots
        self.device_name = device_name
        self.qdevice = qml.device(device_name, wires=n_qubits, shots=shots)

        @qml.qnode(
            self.qdevice,
            interface="torch",
            diff_method="backprop" if shots is None else "parameter-shift",
        )
        def circuit(inputs: torch.Tensor, weights: torch.Tensor):
            qml.AngleEmbedding(inputs, wires=range(n_qubits), rotation="Y")
            qml.StronglyEntanglingLayers(weights, wires=range(n_qubits))
            return [qml.expval(qml.PauliZ(wire)) for wire in range(n_qubits)]

        self.qnode = circuit
        self.layer = qml.qnn.TorchLayer(
            circuit,
            weight_shapes={"weights": (n_layers, n_qubits, 3)},
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.ndim != 2:
            raise ValueError(f"QuantumLayer attend [batch, features], reçu {tuple(x.shape)}")
        if x.shape[-1] != self.n_qubits:
            raise ValueError(f"Le circuit attend {self.n_qubits} variables, mais reçoit {x.shape[-1]}")
        return self.layer(x)


class QuantumHybridPINN(nn.Module):
    """Classical preprocessing -> real QNode -> classical reconstruction."""

    def __init__(
        self,
        classical_layers: List[int],
        n_qubits: int = 4,
        n_quantum_layers: int = 2,
        shots: int | None = None,
        device_name: str = "default.qubit",
        seed: int | None = 42,
    ) -> None:
        super().__init__()
        if not classical_layers or classical_layers[0] != 4:
            raise ValueError("Le modèle attend quatre entrées : t, x, y, z")
        if n_qubits != 4:
            raise ValueError("Le prototype reproductible de phase 1 impose n_qubits=4")
        if seed is not None:
            torch.manual_seed(seed)

        self.input_dim = classical_layers[0]
        self.output_dim = classical_layers[-1]
        self.n_qubits = n_qubits
        self.seed = seed
        self.shots = shots

        self.pre_processing = nn.Sequential(
            nn.Linear(self.input_dim, 32),
            nn.Tanh(),
            nn.Linear(32, n_qubits),
            nn.Tanh(),
        )
        self.quantum_core = QuantumLayer(
            n_qubits=n_qubits,
            n_layers=n_quantum_layers,
            shots=shots,
            device_name=device_name,
        )
        self.post_processing = nn.Sequential(
            nn.Linear(n_qubits, 32),
            nn.Tanh(),
            nn.Linear(32, self.output_dim),
        )

    def forward(self, t: torch.Tensor, x: torch.Tensor, y: torch.Tensor, z: torch.Tensor) -> torch.Tensor:
        inputs = torch.cat([t, x, y, z], dim=-1)
        quantum_inputs = self.pre_processing(inputs)
        quantum_features = self.quantum_core(quantum_inputs)
        return self.post_processing(quantum_features)


def integrate_qnn_to_v8(
    v8_model=None,
    n_qubits: int = 4,
    n_quantum_layers: int = 2,
    seed: int | None = 42,
) -> QuantumHybridPINN:
    """Construct the phase-1 quantum PINN; caller must explicitly train it."""
    return QuantumHybridPINN(
        classical_layers=[4, 32, 32, 5],
        n_qubits=n_qubits,
        n_quantum_layers=n_quantum_layers,
        shots=None,
        device_name=os.getenv("QML_DEVICE", "default.qubit"),
        seed=seed,
    )


if __name__ == "__main__":
    model = integrate_qnn_to_v8()
    t, x, y, z = [torch.randn(8, 1, requires_grad=True) for _ in range(4)]
    output = model(t, x, y, z)
    pressure = output[:, 0].sum()
    dp_dx = torch.autograd.grad(pressure, x, create_graph=True, retain_graph=True)[0]
    print({"output_shape": tuple(output.shape), "dp_dx_shape": tuple(dp_dx.shape), "device": model.quantum_core.device_name, "shots": model.shots})
