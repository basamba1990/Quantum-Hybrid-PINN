import torch
import torch.nn as nn
import torch.nn.functional as F
from fluid_properties import FLUID_CONFIGS, get_eos

class SpectralConv3d(nn.Module):
    def __init__(self, in_channels, out_channels, modes1, modes2, modes3):
        super(SpectralConv3d, self).__init__()
        """
        3D Fourier layer. It does FFT, linear transform, and Inverse FFT.    
        """
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.modes1 = modes1 # Number of Fourier modes to multiply, at most floor(N/2) + 1
        self.modes2 = modes2
        self.modes3 = modes3

        self.scale = (1 / (in_channels * out_channels))
        self.weights1 = nn.Parameter(self.scale * torch.rand(in_channels, out_channels, self.modes1, self.modes2, self.modes3, dtype=torch.cfloat))
        self.weights2 = nn.Parameter(self.scale * torch.rand(in_channels, out_channels, self.modes1, self.modes2, self.modes3, dtype=torch.cfloat))
        self.weights3 = nn.Parameter(self.scale * torch.rand(in_channels, out_channels, self.modes1, self.modes2, self.modes3, dtype=torch.cfloat))
        self.weights4 = nn.Parameter(self.scale * torch.rand(in_channels, out_channels, self.modes1, self.modes2, self.modes3, dtype=torch.cfloat))

    # Complex multiplication
    def compl_mul3d(self, input, weights):
        # (batch, in_channel, x,y,t), (in_channel, out_channel, x,y,t) -> (batch, out_channel, x,y,t)
        return torch.einsum("bixyz,ioxyz->boxyz", input, weights)

    def forward(self, x):
        batchsize = x.shape[0]
        # Compute Fourier coeff. up to factor of 1/sqrt(N)
        x_ft = torch.fft.rfftn(x, dim=[-3, -2, -1])

        # Multiply relevant Fourier modes
        out_ft = torch.zeros(batchsize, self.out_channels, x.size(-3), x.size(-2), x.size(-1)//2 + 1, dtype=torch.cfloat, device=x.device)
        
        out_ft[:, :, :self.modes1, :self.modes2, :self.modes3] = \
            self.compl_mul3d(x_ft[:, :, :self.modes1, :self.modes2, :self.modes3], self.weights1)
        out_ft[:, :, -self.modes1:, :self.modes2, :self.modes3] = \
            self.compl_mul3d(x_ft[:, :, -self.modes1:, :self.modes2, :self.modes3], self.weights2)
        out_ft[:, :, :self.modes1, -self.modes2:, :self.modes3] = \
            self.compl_mul3d(x_ft[:, :, :self.modes1, -self.modes2:, :self.modes3], self.weights3)
        out_ft[:, :, -self.modes1:, -self.modes2:, :self.modes3] = \
            self.compl_mul3d(x_ft[:, :, -self.modes1:, -self.modes2:, :self.modes3], self.weights4)

        # Return to physical space
        x = torch.fft.irfftn(out_ft, s=(x.size(-3), x.size(-2), x.size(-1)))
        return x

class FNO3D(nn.Module):
    def __init__(self, modes1, modes2, modes3, width, fluid_type='H2'):
        super(FNO3D, self).__init__()
        """
        The overall network. It contains 4 layers of the Fourier layer.
        1. Lift the input to a high dimensional space by a linear layer.
        2. 4 layers of Fourier layers [SpectralConv3d + skip connection + nonlinearity].
        3. Project the output to the target space by another linear layer.
        
        input: the solution at initial condition (rho, u, v, w, T) [batch, 5, x, y, z]
        output: the solution at later time [batch, 5, x, y, z]
        """
        self.modes1 = modes1
        self.modes2 = modes2
        self.modes3 = modes3
        self.width = width
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])

        self.p = nn.Linear(5, self.width) # input has 5 channels: rho, u, v, w, T
        self.conv0 = SpectralConv3d(self.width, self.width, self.modes1, self.modes2, self.modes3)
        self.conv1 = SpectralConv3d(self.width, self.width, self.modes1, self.modes2, self.modes3)
        self.conv2 = SpectralConv3d(self.width, self.width, self.modes1, self.modes2, self.modes3)
        self.conv3 = SpectralConv3d(self.width, self.width, self.modes1, self.modes2, self.modes3)
        self.w0 = nn.Conv3d(self.width, self.width, 1)
        self.w1 = nn.Conv3d(self.width, self.width, 1)
        self.w2 = nn.Conv3d(self.width, self.width, 1)
        self.w3 = nn.Conv3d(self.width, self.width, 1)

        self.q = nn.Linear(self.width, 128)
        self.fc = nn.Linear(128, 5)

    def forward(self, x):
        # x shape: [batch, x, y, z, 5]
        x = self.p(x)
        x = x.permute(0, 4, 1, 2, 3) # [batch, width, x, y, z]

        x1 = self.conv0(x)
        x2 = self.w0(x)
        x = x1 + x2
        x = F.gelu(x)

        x1 = self.conv1(x)
        x2 = self.w1(x)
        x = x1 + x2
        x = F.gelu(x)

        x1 = self.conv2(x)
        x2 = self.w2(x)
        x = x1 + x2
        x = F.gelu(x)

        x1 = self.conv3(x)
        x2 = self.w3(x)
        x = x1 + x2

        x = x.permute(0, 2, 3, 4, 1) # [batch, x, y, z, width]
        x = self.q(x)
        x = F.gelu(x)
        x = self.fc(x)
        
        # Denormalize outputs (consistent with PINN implementation)
        rho = x[..., 0:1] * 100 + 0.1
        u   = x[..., 1:2] * 100
        v   = x[..., 2:3] * 100
        w   = x[..., 3:4] * 100
        T   = x[..., 4:5] * (500.0 - 14.0) + 14.0
        
        return torch.cat([rho, u, v, w, T], dim=-1)

class PINO3DNavierStokes(FNO3D):
    """
    Physics-Informed Neural Operator for 3D Navier-Stokes.
    Inherits from FNO3D and adds residual computation for PINO loss.
    """
    def __init__(self, modes1, modes2, modes3, width, fluid_type='H2'):
        super().__init__(modes1, modes2, modes3, width, fluid_type)

    def compute_residuals(self, out, dx, dy, dz, dt):
        """
        Compute residuals using finite differences on the FNO output grid.
        out: [batch, x, y, z, 5] (rho, u, v, w, T)
        """
        rho = out[..., 0]
        u = out[..., 1]
        v = out[..., 2]
        w = out[..., 3]
        T = out[..., 4]

        # Use central differences for spatial derivatives
        def grad_x(f): return (torch.roll(f, -1, 1) - torch.roll(f, 1, 1)) / (2 * dx)
        def grad_y(f): return (torch.roll(f, -1, 2) - torch.roll(f, 1, 2)) / (2 * dy)
        def grad_z(f): return (torch.roll(f, -1, 3) - torch.roll(f, 1, 3)) / (2 * dz)
        
        # Simplified time derivative (if out is a sequence, here we assume steady state or single step)
        # For PINO, we usually compute residuals on the predicted field.
        
        rho_x = grad_x(rho)
        u_x = grad_x(u)
        v_x = grad_x(v)
        w_x = grad_x(w)
        T_x = grad_x(T)
        
        # ... (similar for y and z)
        # Pressure via EOS
        p = get_eos(self.fluid_type, rho.unsqueeze(-1), T.unsqueeze(-1)).squeeze(-1)
        p_x = grad_x(p)
        
        # Continuity residual (example)
        mass_res = (rho_x * u + rho * u_x) # simplified for brevity
        
        return mass_res

if __name__ == "__main__":
    model = PINO3DNavierStokes(modes1=8, modes2=8, modes3=8, width=20)
    # Input: initial condition grid [batch, x, y, z, 5]
    x_in = torch.randn(1, 16, 16, 16, 5)
    x_out = model(x_in)
    print(f"FNO Output Shape: {x_out.shape}")
