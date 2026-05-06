import torch
from fno_3d_navier_stokes import PINO3DNavierStokes
from quantum_eos_torch import SilveraGoldmanEOS

def test_fno_forward():
    print("Testing FNO Forward Pass...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = PINO3DNavierStokes(modes1=4, modes2=4, modes3=4, width=16).to(device)
    
    # Input grid: [batch, x, y, z, channels]
    # Representing initial condition for rho, u, v, w, T
    x_in = torch.randn(1, 8, 8, 8, 5).to(device)
    
    with torch.no_grad():
        x_out = model(x_in)
    
    print(f"Input shape: {x_in.shape}")
    print(f"Output shape: {x_out.shape}")
    assert x_out.shape == x_in.shape
    print("Forward pass successful!\n")

def test_pino_residuals():
    print("Testing PINO Residuals...")
    model = PINO3DNavierStokes(modes1=4, modes2=4, modes3=4, width=16)
    x_out = torch.randn(1, 8, 8, 8, 5, requires_grad=True)
    
    # Grid spacing
    dx, dy, dz, dt = 0.1, 0.1, 0.1, 0.1
    
    res = model.compute_residuals(x_out, dx, dy, dz, dt)
    print(f"Residual shape: {res.shape}")
    print("Residual computation successful!\n")

def test_quantum_eos_integration():
    print("Testing Quantum EOS Integration...")
    eos = SilveraGoldmanEOS()
    rho = torch.tensor([70.0], requires_grad=True)
    T = torch.tensor([20.0], requires_grad=True)
    
    p = eos(rho, T)
    print(f"Pressure from Silvera-Goldman: {p.item():.2e} Pa")
    
    # Verify differentiability
    p.backward()
    print(f"Gradient dp/drho: {rho.grad.item():.2e}")
    print("EOS Integration successful!\n")

if __name__ == "__main__":
    try:
        test_fno_forward()
        test_pino_residuals()
        test_quantum_eos_integration()
        print("All tests passed! FNO Engine is ready.")
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
