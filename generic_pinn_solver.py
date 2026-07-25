import torch
import torch.nn as nn

class GenericPINNSolver(nn.Module):
    def __init__(self, layers):
        super(GenericPINNSolver, self).__init__()
        self.layers = layers
        self.pinn_model = self.build_model(layers)

    def build_model(self, layers):
        modules = []
        for i in range(len(layers) - 2):
            modules.append(nn.Linear(layers[i], layers[i+1]))
            modules.append(nn.Tanh())
        modules.append(nn.Linear(layers[-2], layers[-1]))
        return nn.Sequential(*modules)

    def forward(self, t, x, y, z):
        # Correction de l'IndexError: Dimension out of range
        # S'assurer que les entrées ont au moins 2 dimensions pour torch.cat(..., dim=1)
        if t.dim() == 1: t = t.unsqueeze(1)
        if x.dim() == 1: x = x.unsqueeze(1)
        if y.dim() == 1: y = y.unsqueeze(1)
        if z.dim() == 1: z = z.unsqueeze(1)
        
        inputs = torch.cat([t, x, y, z], dim=1)
        out = self.pinn_model(inputs)
        
        # Sorties typiques: rho, u, v, w, T
        rho = out[:, 0:1]
        u = out[:, 1:2]
        v = out[:, 2:3]
        w = out[:, 3:4]
        T = out[:, 4:5]
        
        return rho, u, v, w, T
