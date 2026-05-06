"""
Fourier Neural Operator for 3D Navier-Stokes (Physics-Informed).
Version industrielle avec normalisation robuste et gestion des fluides.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

# Configuration des fluides (à adapter selon vos besoins)
FLUID_CONFIGS = {
    'H2': {'rho_mean': 70.0, 'rho_std': 10.0, 'u_mean': 0.0, 'u_std': 5.0, 'T_mean': 20.0, 'T_std': 5.0},
    'NH3': {'rho_mean': 15.0, 'rho_std': 2.0, 'u_mean': 0.0, 'u_std': 2.0, 'T_mean': 673.0, 'T_std': 50.0},
    'CH4': {'rho_mean': 0.7, 'rho_std': 0.2, 'u_mean': 0.0, 'u_std': 10.0, 'T_mean': 300.0, 'T_std': 50.0},
    'sCO2': {'rho_mean': 400.0, 'rho_std': 100.0, 'u_mean': 0.0, 'u_std': 1.0, 'T_mean': 350.0, 'T_std': 30.0},
}

def get_eos(fluid_type, rho, T):
    """Placeholder for equation of state – replace with real EOS."""
    from quantum_eos_torch import SilveraGoldmanEOS
    eos = SilveraGoldmanEOS()
    return eos(rho, T)


class SpectralConv3d(nn.Module):
    def __init__(self, in_channels, out_channels, modes1, modes2, modes3):
        super(SpectralConv3d, self).__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.modes1 = modes1
        self.modes2 = modes2
        self.modes3 = modes3

        self.scale = (1 / (in_channels * out_channels))
        self.weights1 = nn.Parameter(self.scale * torch.rand(in_channels, out_channels, self.modes1, self.modes2, self.modes3, dtype=torch.cfloat))
        self.weights2 = nn.Parameter(self.scale * torch.rand(in_channels, out_channels, self.modes1, self.modes2, self.modes3, dtype=torch.cfloat))
        self.weights3 = nn.Parameter(self.scale * torch.rand(in_channels, out_channels, self.modes1, self.modes2, self.modes3, dtype=torch.cfloat))
        self.weights4 = nn.Parameter(self.scale * torch.rand(in_channels, out_channels, self.modes1, self.modes2, self.modes3, dtype=torch.cfloat))

    def compl_mul3d(self, input, weights):
        return torch.einsum("bixyz,ioxyz->boxyz", input, weights)

    def forward(self, x):
        batchsize = x.shape[0]
        x_ft = torch.fft.rfftn(x, dim=[-3, -2, -1])

        out_ft = torch.zeros(batchsize, self.out_channels, x.size(-3), x.size(-2), x.size(-1)//2 + 1, dtype=torch.cfloat, device=x.device)
        out_ft[:, :, :self.modes1, :self.modes2, :self.modes3] = self.compl_mul3d(x_ft[:, :, :self.modes1, :self.modes2, :self.modes3], self.weights1)
        out_ft[:, :, -self.modes1:, :self.modes2, :self.modes3] = self.compl_mul3d(x_ft[:, :, -self.modes1:, :self.modes2, :self.modes3], self.weights2)
        out_ft[:, :, :self.modes1, -self.modes2:, :self.modes3] = self.compl_mul3d(x_ft[:, :, :self.modes1, -self.modes2:, :self.modes3], self.weights3)
        out_ft[:, :, -self.modes1:, -self.modes2:, :self.modes3] = self.compl_mul3d(x_ft[:, :, -self.modes1:, -self.modes2:, :self.modes3], self.weights4)

        x = torch.fft.irfftn(out_ft, s=(x.size(-3), x.size(-2), x.size(-1)))
        return x


class FNO3D(nn.Module):
    def __init__(self, modes1, modes2, modes3, width, fluid_type='H2'):
        super(FNO3D, self).__init__()
        self.modes1 = modes1
        self.modes2 = modes2
        self.modes3 = modes3
        self.width = width
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])

        self.p = nn.Linear(5, self.width)
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

        # Normalisation statistics (buffers)
        self.register_buffer('rho_mean', torch.tensor(self.config['rho_mean']))
        self.register_buffer('rho_std', torch.tensor(self.config['rho_std']))
        self.register_buffer('u_mean', torch.tensor(self.config['u_mean']))
        self.register_buffer('u_std', torch.tensor(self.config['u_std']))
        self.register_buffer('T_mean', torch.tensor(self.config['T_mean']))
        self.register_buffer('T_std', torch.tensor(self.config['T_std']))

    def forward(self, x):
        # Input x: (batch, x, y, z, 5) with normalized values (mean 0, std 1)
        x = self.p(x)
        x = x.permute(0, 4, 1, 2, 3)

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

        x = x.permute(0, 2, 3, 4, 1)
        x = self.q(x)
        x = F.gelu(x)
        x = self.fc(x)  # output in normalized space

        # Denormalize to physical values
        rho = x[..., 0:1] * self.rho_std + self.rho_mean
        u   = x[..., 1:2] * self.u_std + self.u_mean
        v   = x[..., 2:3] * self.u_std + self.u_mean
        w   = x[..., 3:4] * self.u_std + self.u_mean
        T   = x[..., 4:5] * self.T_std + self.T_mean

        return torch.cat([rho, u, v, w, T], dim=-1)


class PINO3DNavierStokes(FNO3D):
    """
    Physics-Informed Neural Operator for 3D Navier-Stokes.
    Adds residual computation for PINO loss.
    """
    def __init__(self, modes1, modes2, modes3, width, fluid_type='H2'):
        super().__init__(modes1, modes2, modes3, width, fluid_type)

    def compute_residuals(self, out, dx, dy, dz, dt):
        """
        Compute PDE residuals using finite differences.
        out: (batch, x, y, z, 5) with physical values (rho, u, v, w, T)
        """
        rho = out[..., 0]
        u = out[..., 1]
        v = out[..., 2]
        w = out[..., 3]
        T = out[..., 4]

        def grad_x(f): return (torch.roll(f, -1, 1) - torch.roll(f, 1, 1)) / (2 * dx)
        def grad_y(f): return (torch.roll(f, -1, 2) - torch.roll(f, 1, 2)) / (2 * dy)
        def grad_z(f): return (torch.roll(f, -1, 3) - torch.roll(f, 1, 3)) / (2 * dz)

        # Continuity residual
        rho_x = grad_x(rho); u_x = grad_x(u); rho_u_x = rho * u_x
        rho_y = grad_y(rho); v_y = grad_y(v); rho_v_y = rho * v_y
        rho_z = grad_z(rho); w_z = grad_z(w); rho_w_z = rho * w_z
        mass_res = rho_u_x + rho_v_y + rho_w_z + u * rho_x + v * rho_y + w * rho_z

        # Momentum residuals (simplified, placeholder)
        # In real implementation, add Navier-Stokes terms

        # Energy residual (simplified)
        T_x = grad_x(T); T_y = grad_y(T); T_z = grad_z(T)
        energy_res = u * T_x + v * T_y + w * T_z  # advection only

        return mass_res, energy_res


if __name__ == "__main__":
    model = PINO3DNavierStokes(modes1=8, modes2=8, modes3=8, width=20, fluid_type='H2')
    x_in = torch.randn(1, 16, 16, 16, 5)
    x_out = model(x_in)
    print(f"FNO Output Shape: {x_out.shape}")  # Expected (1,16,16,16,5)
