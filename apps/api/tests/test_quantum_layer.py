from __future__ import annotations

import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parents[1]))
from quantum_neural_network import QuantumHybridPINN, QuantumLayer  # noqa: E402


def make_inputs(batch: int = 3):
    torch.manual_seed(7)
    return [torch.randn(batch, 1, requires_grad=True) for _ in range(4)]


def test_real_quantum_layer_has_four_qubits_and_exact_shots():
    layer = QuantumLayer(n_qubits=4, n_layers=1, shots=None)
    assert layer.n_qubits == 4
    assert layer.shots is None
    assert layer.device_name == "default.qubit"


def test_real_quantum_hybrid_forward_and_first_gradient():
    model = QuantumHybridPINN(classical_layers=[4, 16, 5], n_qubits=4, n_quantum_layers=1, shots=None, seed=42)
    t, x, y, z = make_inputs()
    output = model(t, x, y, z)
    assert output.shape == (3, 5)
    assert torch.isfinite(output).all()
    grad_x = torch.autograd.grad(output[:, 0].sum(), x, create_graph=True)[0]
    assert grad_x.shape == x.shape
    assert torch.isfinite(grad_x).all()


def test_real_quantum_hybrid_supports_second_pin_n_derivative():
    model = QuantumHybridPINN(classical_layers=[4, 16, 5], n_qubits=4, n_quantum_layers=1, shots=None, seed=42)
    t, x, y, z = make_inputs(2)
    output = model(t, x, y, z)
    first = torch.autograd.grad(output[:, 0].sum(), x, create_graph=True)[0]
    second = torch.autograd.grad(first.sum(), x, create_graph=True)[0]
    assert second.shape == x.shape
    assert torch.isfinite(second).all()


def test_seed_reproduces_initial_forward():
    inputs = make_inputs(2)
    model_a = QuantumHybridPINN(classical_layers=[4, 16, 5], n_qubits=4, n_quantum_layers=1, shots=None, seed=123)
    out_a = model_a(*inputs)
    inputs_b = [item.detach().clone().requires_grad_(True) for item in inputs]
    model_b = QuantumHybridPINN(classical_layers=[4, 16, 5], n_qubits=4, n_quantum_layers=1, shots=None, seed=123)
    out_b = model_b(*inputs_b)
    assert torch.allclose(out_a, out_b, atol=1e-7, rtol=1e-7)
