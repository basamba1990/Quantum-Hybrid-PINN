import torch
import torch.nn as nn
from typing import List, Dict, Any, Tuple

# Importations locales
try:
    from fluid_properties import FLUID_CONFIGS, get_eos
    from geometry_handler import GeometryHandler
except ImportError:
    from .fluid_properties import FLUID_CONFIGS, get_eos
    from .geometry_handler import GeometryHandler

class PINNModel(nn.Module):
    def __init__(self, layers: List[int]):
        super(PINNModel, self).__init__()
        self.layers = layers
        self.activation = nn.Tanh()
        self.linear_layers = nn.ModuleList()
        for i in range(len(layers) - 1):
            self.linear_layers.append(nn.Linear(layers[i], layers[i+1]))
        
        for m in self.linear_layers:
            if isinstance(m, nn.Linear):
                nn.init.xavier_normal_(m.weight, gain=nn.init.calculate_gain("tanh"))
                nn.init.zeros_(m.bias)

    def forward(self, t, x, y, z):
        # --- ROBUSTESSE INDUSTRIELLE : GESTION DES DIMENSIONS ---
        def ensure_2d(tensor):
            if not isinstance(tensor, torch.Tensor):
                tensor = torch.tensor(tensor, dtype=torch.float32)
            if tensor.dim() == 0:
                return tensor.view(1, 1)
            if tensor.dim() == 1:
                return tensor.unsqueeze(1)
            return tensor

        t = ensure_2d(t)
        x = ensure_2d(x)
        y = ensure_2d(y)
        z = ensure_2d(z)
        
        # S'assurer que tous les tenseurs ont la même taille sur la dimension 0
        batch_size = max(t.size(0), x.size(0), y.size(0), z.size(0))
        if t.size(0) == 1 and batch_size > 1: t = t.expand(batch_size, 1)
        if x.size(0) == 1 and batch_size > 1: x = x.expand(batch_size, 1)
        if y.size(0) == 1 and batch_size > 1: y = y.expand(batch_size, 1)
        if z.size(0) == 1 and batch_size > 1: z = z.expand(batch_size, 1)

        inputs = torch.cat([t, x, y, z], dim=1)
        
        for i in range(len(self.linear_layers) - 1):
            inputs = self.activation(self.linear_layers[i](inputs))
        outputs = self.linear_layers[-1](inputs)
        
        return outputs[:, 0:1], outputs[:, 1:2], outputs[:, 2:3], outputs[:, 3:4], outputs[:, 4:5]

class GenericPINNSolver(nn.Module):
    def __init__(self, layers: List[int], fluid_type: str = 'H2', geometry_handler: GeometryHandler = None, salt_cavern_physics: Any = None):
        super().__init__()
        self.pinn_model = PINNModel(layers)
        self.fluid_type = fluid_type
        self.config = FLUID_CONFIGS.get(fluid_type, FLUID_CONFIGS['H2'])
        self.geometry_handler = geometry_handler
        self.salt_cavern_physics = salt_cavern_physics
        self.device = next(self.pinn_model.parameters()).device

    def forward(self, t, x, y, z):
        rho, u, v, w, T = self.pinn_model(t, x, y, z)
        if self.geometry_handler:
            rho, u, v, w, T = self.geometry_handler.apply_boundary_conditions(t, x, y, z, rho, u, v, w, T)
        return rho, u, v, w, T

    def _safe_grad(self, y: torch.Tensor, x: torch.Tensor, create_graph: bool = True) -> torch.Tensor:
        grads = torch.autograd.grad(y.sum(), x, create_graph=create_graph, allow_unused=True)
        if grads[0] is None:
            return torch.zeros_like(x, requires_grad=create_graph)
        return grads[0]

    def compute_residuals(self, t, x, y, z, rho, u, v, w, T, scale_dict=None):
        if not t.requires_grad: t.requires_grad_(True)
        if not x.requires_grad: x.requires_grad_(True)
        if not y.requires_grad: y.requires_grad_(True)
        if not z.requires_grad: z.requires_grad_(True)

        rho = rho.clone().requires_grad_(True)
        u = u.clone().requires_grad_(True)
        v = v.clone().requires_grad_(True)
        w = w.clone().requires_grad_(True)
        T = T.clone().requires_grad_(True)

        rho_t = self._safe_grad(rho, t)
        rho_x = self._safe_grad(rho, x)
        rho_y = self._safe_grad(rho, y)
        rho_z = self._safe_grad(rho, z)

        u_t = self._safe_grad(u, t)
        u_x = self._safe_grad(u, x)
        u_y = self._safe_grad(u, y)
        u_z = self._safe_grad(u, z)

        v_t = self._safe_grad(v, t)
        v_x = self._safe_grad(v, x)
        v_y = self._safe_grad(v, y)
        v_z = self._safe_grad(v, z)

        w_t = self._safe_grad(w, t)
        w_x = self._safe_grad(w, x)
        w_y = self._safe_grad(w, y)
        w_z = self._safe_grad(w, z)

        T_t = self._safe_grad(T, t)
        T_x = self._safe_grad(T, x)
        T_y = self._safe_grad(T, y)
        T_z = self._safe_grad(T, z)

        p = get_eos(self.fluid_type, rho, T)
        p_x = self._safe_grad(p, x)
        p_y = self._safe_grad(p, y)
        p_z = self._safe_grad(p, z)

        mu = self.config['mu']
        Cp = self.config['Cp']
        k_therm = self.config['k']

        mass_residual = rho_t + (rho_x * u + rho * u_x) + (rho_y * v + rho * v_y) + (rho_z * w + rho * w_z)
        
        convective_u = rho * (u_t + u * u_x + v * u_y + w * u_z)
        convective_v = rho * (v_t + u * v_x + v * v_y + w * v_z)
        convective_w = rho * (w_t + u * w_x + v * w_y + w * w_z)
        
        mom_x_residual = convective_u + p_x - mu * (self._safe_grad(u_x, x) + self._safe_grad(u_y, y) + self._safe_grad(u_z, z))
        mom_y_residual = convective_v + p_y - mu * (self._safe_grad(v_x, x) + self._safe_grad(v_y, y) + self._safe_grad(v_z, z))
        mom_z_residual = convective_w + p_z - mu * (self._safe_grad(w_x, x) + self._safe_grad(w_y, y) + self._safe_grad(w_z, z))

        energy_residual = rho * Cp * (T_t + u * T_x + v * T_y + w * T_z) - k_therm * (self._safe_grad(T_x, x) + self._safe_grad(T_y, y) + self._safe_grad(T_z, z))

        if scale_dict is not None:
            return mass_residual / scale_dict['mass'], mom_x_residual / scale_dict['mom'], mom_y_residual / scale_dict['mom'], mom_z_residual / scale_dict['mom'], energy_residual / scale_dict['energy']
        else:
            scales = {'mass': torch.std(mass_residual).item() + 1e-6, 'mom': torch.std(mom_x_residual).item() + 1e-6, 'energy': torch.std(energy_residual).item() + 1e-6}
            return mass_residual, mom_x_residual, mom_y_residual, mom_z_residual, energy_residual, scales

    def loss(self, t_pde, x_pde, y_pde, z_pde, scale_dict):
        rho, u, v, w, T = self.forward(t_pde, x_pde, y_pde, z_pde)
        mass, mom_x, mom_y, mom_z, energy = self.compute_residuals(t_pde, x_pde, y_pde, z_pde, rho, u, v, w, T, scale_dict=scale_dict)
        loss_pde = (mass**2).mean() + (mom_x**2).mean() + (mom_y**2).mean() + (mom_z**2).mean() + (energy**2).mean()
        loss_positivity = torch.mean(torch.relu(-rho)) + torch.mean(torch.relu(-T))
        loss_bc = self.geometry_handler.compute_boundary_conditions_loss(self, self.fluid_type, self.device) if self.geometry_handler else torch.tensor(0.0)
        return loss_pde + 10.0 * loss_positivity + loss_bc
