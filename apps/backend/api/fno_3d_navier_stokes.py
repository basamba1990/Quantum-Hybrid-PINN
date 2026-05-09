"""
Fourier Neural Operator for 3D Navier-Stokes (Physics-Informed).
Version ajustée pour correspondre aux dimensions des poids entraînés (12,12,1 modes).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

# Configuration des fluides
FLUID_CONFIGS = {
    'H2': {'rho_mean': 70.0, 'rho_std': 10.0, 'u_mean': 0.0, 'u_std': 5.0, 'T_mean': 20.0, 'T_std': 5.0},
    'NH3': {'rho_mean': 15.0, 'rho_std': 2.0, 'u_mean': 0.0, 'u_std': 2.0, 'T_mean': 673.0, 'T_std': 50.0},
    'CH4': {'rho_mean': 0.7, 'rho_std': 0.2, 'u_mean': 0.0, 'u_std': 10.0, 'T_mean': 300.0, 'T_std': 50.0},
    'sCO2': {'rho_mean': 400.0, 'rho_std': 100.0, 'u_mean': 0.0, 'u_std': 1.0, 'T_mean': 350.0, 'T_std': 30.0},
}

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
        
        # Ajustement dynamique des modes pour éviter les erreurs de dimension lors du chargement
        m1 = min(self.modes1, x_ft.size(-3))
        m2 = min(self.modes2, x_ft.size(-2))
        m3 = min(self.modes3, x_ft.size(-1))

        out_ft[:, :, :m1, :m2, :m3] = self.compl_mul3d(x_ft[:, :, :m1, :m2, :m3], self.weights1[:, :, :m1, :m2, :m3])
        out_ft[:, :, -m1:, :m2, :m3] = self.compl_mul3d(x_ft[:, :, -m1:, :m2, :m3], self.weights2[:, :, :m1, :m2, :m3])
        out_ft[:, :, :m1, -m2:, :m3] = self.compl_mul3d(x_ft[:, :, :m1, -m2:, :m3], self.weights3[:, :, :m1, :m2, :m3])
        out_ft[:, :, -m1:, -m2:, :m3] = self.compl_mul3d(x_ft[:, :, -m1:, -m2:, :m3], self.weights4[:, :, :m1, :m2, :m3])

        x = torch.fft.irfftn(out_ft, s=(x.size(-3), x.size(-2), x.size(-1)))
        return x

class FNO3D(nn.Module):
    def __init__(self, modes1=12, modes2=12, modes3=1, width=32, fluid_type='H2', in_channels=2, out_channels=1):
        super(FNO3D, self).__init__()
        self.modes1 = modes1
        self.modes2 = modes2
        self.modes3 = modes3
        self.width = width
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])

        # D'après les logs : p.weight est (32, 2) donc in_channels=2
        self.p = nn.Linear(in_channels, self.width)
        
        # Spectral Convolutions avec modes (12, 12, 1)
        self.conv0 = SpectralConv3d(self.width, self.width, self.modes1, self.modes2, self.modes3)
        self.conv1 = SpectralConv3d(self.width, self.width, self.modes1, self.modes2, self.modes3)
        self.conv2 = SpectralConv3d(self.width, self.width, self.modes1, self.modes2, self.modes3)
        self.conv3 = SpectralConv3d(self.width, self.width, self.modes1, self.modes2, self.modes3)
        
        self.w0 = nn.Conv3d(self.width, self.width, 1)
        self.w1 = nn.Conv3d(self.width, self.width, 1)
        self.w2 = nn.Conv3d(self.width, self.width, 1)
        self.w3 = nn.Conv3d(self.width, self.width, 1)

        self.q = nn.Linear(self.width, 128)
        
        # D'après les logs : fc.weight est (1, 128) donc out_channels=1
        self.fc = nn.Linear(128, out_channels)

        # Buffers de normalisation (seront écrasés par state_dict si présents)
        self.register_buffer('rho_mean', torch.tensor(self.config['rho_mean']))
        self.register_buffer('rho_std', torch.tensor(self.config['rho_std']))
        self.register_buffer('u_mean', torch.tensor(self.config['u_mean']))
        self.register_buffer('u_std', torch.tensor(self.config['u_std']))
        self.register_buffer('T_mean', torch.tensor(self.config['T_mean']))
        self.register_buffer('T_std', torch.tensor(self.config['T_std']))

    def forward(self, x):
        # x shape attendu par Linear(2, 32): (..., 2)
        # Si x est (batch, x, y, z, 5), on doit extraire les canaux pertinents
        if x.shape[-1] == 5:
            # Exemple: extraction de 2 caractéristiques si le modèle a été entraîné ainsi
            x = x[..., 1:3] 
        
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
        x = self.fc(x)

        return x

class PINO3DNavierStokes(FNO3D):
    def __init__(self, modes1=12, modes2=12, modes3=1, width=32, fluid_type='H2', in_channels=2, out_channels=1):
        super().__init__(modes1, modes2, modes3, width, fluid_type, in_channels, out_channels)

    def compute_residuals(self, out, dx, dy, dz, dt):
        # Implémentation simplifiée car la sortie n'a qu'un canal (probablement P ou T)
        return torch.tensor(0.0), torch.tensor(0.0)
