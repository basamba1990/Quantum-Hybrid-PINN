#!/usr/bin/env python3
"""Small analytic benchmark: u_xx + pi^2 sin(pi x)=0, u(0)=u(1)=0.

This benchmark tests software behavior and quantitative error, not industrial
validity. The quantum model uses the exact default.qubit simulator.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from quantum_neural_network import QuantumHybridPINN  # noqa: E402


def classical_model() -> nn.Module:
    return nn.Sequential(nn.Linear(4, 32), nn.Tanh(), nn.Linear(32, 32), nn.Tanh(), nn.Linear(32, 5))


def inputs(x: torch.Tensor) -> tuple[torch.Tensor, ...]:
    zeros = torch.zeros_like(x)
    return zeros, x, zeros, zeros


def metrics(model, x: torch.Tensor, is_quantum: bool) -> dict[str, float]:
    xx = x.detach().clone().requires_grad_(True)
    output = model(*inputs(xx)) if is_quantum else model(torch.cat(inputs(xx), dim=-1))
    # Boundary-constrained ansatz: u=x(1-x)N(x), so u(0)=u(1)=0 exactly.
    u = xx * (1.0 - xx) * output[:, 0:1]
    first = torch.autograd.grad(u.sum(), xx, create_graph=True)[0]
    second = torch.autograd.grad(first.sum(), xx, create_graph=True)[0]
    target = torch.sin(math.pi * xx)
    pde = second + (math.pi**2) * target
    return {
        "relative_l2": float((torch.linalg.vector_norm(u - target) / (torch.linalg.vector_norm(target) + 1e-12)).detach()),
        "max_abs": float((u - target).abs().max().detach()),
        "pde_rms": float(torch.sqrt(torch.mean(pde**2)).detach()),
        "boundary_abs": float(torch.stack([u[0].abs(), u[-1].abs()]).max().detach()),
    }


def train(model, x: torch.Tensor, is_quantum: bool, steps: int, lr: float) -> dict[str, float]:
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    target = torch.sin(math.pi * x)
    for _ in range(steps):
        xx = x.detach().clone().requires_grad_(True)
        output = model(*inputs(xx)) if is_quantum else model(torch.cat(inputs(xx), dim=-1))
        u = xx * (1.0 - xx) * output[:, 0:1]
        first = torch.autograd.grad(u.sum(), xx, create_graph=True)[0]
        second = torch.autograd.grad(first.sum(), xx, create_graph=True)[0]
        pde = second + (math.pi**2) * target
        data_loss = torch.mean((u - target) ** 2)
        boundary_loss = (u[0] ** 2 + u[-1] ** 2).mean()
        loss = data_loss + 0.1 * torch.mean(pde**2) + boundary_loss
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
    return metrics(model, x, is_quantum)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=int, default=60)
    parser.add_argument("--points", type=int, default=16)
    parser.add_argument("--output", type=Path, default=Path("artifacts/quantum_vs_classical_benchmark.json"))
    args = parser.parse_args()
    torch.set_num_threads(1)
    torch.manual_seed(2026)
    x = torch.linspace(0.0, 1.0, args.points).reshape(-1, 1)
    classical = classical_model()
    classical_initial = metrics(classical, x, False)
    classical_final = train(classical, x, False, args.steps, 2e-3)
    quantum = QuantumHybridPINN(classical_layers=[4, 16, 5], n_qubits=4, n_quantum_layers=1, shots=None, seed=2026)
    quantum_initial = metrics(quantum, x, True)
    quantum_final = train(quantum, x, True, args.steps, 2e-3)
    result = {
        "benchmark": "analytic_poisson_1d_sine",
        "equation": "u_xx + pi^2 sin(pi x) = 0",
        "reference": "u(x)=sin(pi x)",
        "points": args.points,
        "steps": args.steps,
        "models": {
            "classical_pinn": {"initial": classical_initial, "final": classical_final},
            "quantum_hybrid_pinn": {"initial": quantum_initial, "final": quantum_final, "qubits": 4, "device": "default.qubit", "shots": None, "seed": 2026},
        },
        "interpretation": "software benchmark only; no claim of quantum advantage or industrial validation",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
