import pennylane as qml
from pennylane import numpy as np
import torch
import torch.nn as nn

class QuantumRobustKernel(nn.Module):
    """
    Noyau Quantique pour améliorer la robustesse des PINNs face aux données bruitées.
    Utilise un circuit variationnel comme extracteur de caractéristiques robustes.
    """
    def __init__(self, n_qubits=4, n_layers=2):
        super().__init__()
        self.n_qubits = n_qubits
        self.dev = qml.device("default.qubit", wires=n_qubits)
        
        @qml.qnode(self.dev, interface="torch")
        def circuit(inputs, weights):
            # Encodage des données (Angle Embedding)
            qml.AngleEmbedding(inputs, wires=range(self.n_qubits))
            # Couches variationnelles
            qml.StronglyEntanglingLayers(weights, wires=range(self.n_qubits))
            return [qml.expval(qml.PauliZ(i)) for i in range(self.n_qubits)]
            
        self.qlayer = qml.qnn.TorchLayer(circuit, {"weights": (n_layers, n_qubits, 3)})
        self.post_process = nn.Linear(n_qubits, n_qubits)

    def forward(self, x):
        # x shape: (batch, 4) -> [t, x, y, z]
        # Normalisation pour l'encodage quantique (0 to pi)
        x_norm = torch.sigmoid(x) * np.pi
        q_out = self.qlayer(x_norm)
        return self.post_process(q_out)
