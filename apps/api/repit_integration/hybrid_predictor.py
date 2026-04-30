"""
Hybrid CFD-ML Predictor Module – Version industrielle
- Ajout du contrôle CFL
- Calcul du score de crédibilité
- Stockage du credibility_score dans le résultat
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import logging
import numpy as np
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class HybridSimulationConfig:
    case_path: str
    ml_model_path: Optional[str] = None
    cfd_solver: str = "buoyantBoussinesqPimpleFoam"
    n_processors: int = 1
    max_iterations: int = 100
    residual_threshold: float = 0.01
    ml_acceleration_factor: float = 0.5
    fields_to_monitor: List[str] = field(default_factory=lambda: ["U", "p", "T"])


@dataclass
class HybridSimulationResult:
    status: str
    iteration: int
    cfd_time: float
    ml_time: float
    residuals: Dict[str, float]
    predictions: Dict[str, np.ndarray]
    timestamp: datetime
    log: str
    credibility_score: float = 0.0   # PATCH 3
    error_message: Optional[str] = None


class BaseHybridPredictor:
    def __init__(self, config: HybridSimulationConfig):
        self.config = config
        self.case_path = Path(config.case_path)
        self.history = []
        self.logger = logging.getLogger(self.__class__.__name__)

    def predict_step(self, current_state: Dict[str, np.ndarray], time_step: float, use_ml: bool = False):
        raise NotImplementedError

    def compute_residuals(self, state1: Dict[str, np.ndarray], state2: Dict[str, np.ndarray]) -> Dict[str, float]:
        residuals = {}
        for field in self.config.fields_to_monitor:
            if field in state1 and field in state2:
                diff = np.abs(state2[field] - state1[field])
                residuals[field] = float(np.mean(diff))
            else:
                residuals[field] = 0.0
        return residuals

    def should_use_ml(self, residuals: Dict[str, float]) -> bool:
        max_residual = max(residuals.values()) if residuals else 0.0
        return max_residual < self.config.residual_threshold

    # ========== PATCH 2 : Contrôle CFL ==========
    def check_cfl(self, velocity_field: np.ndarray, dx: float, dt: float) -> float:
        """Vérifie la condition de Courant-Friedrichs-Lewy (CFL)."""
        # velocity_field peut être de shape (..., 3) ou (..., ) scalaire
        if velocity_field.ndim >= 2 and velocity_field.shape[-1] == 3:
            U_max = np.max(np.linalg.norm(velocity_field, axis=-1))
        else:
            U_max = np.max(np.abs(velocity_field))
        cfl = U_max * dt / dx
        if cfl > 0.8:
            raise ValueError(f"CFL = {cfl:.2f} > 0.8 → simulation instable. Réduire dt ou raffiner le maillage.")
        self.logger.info(f"CFL check passed: {cfl:.3f}")
        return cfl

    def estimate_dx(self, mesh_path: Path) -> float:
        """Estime la taille de maille moyenne à partir du polyMesh."""
        try:
            import Ofpp
            points_file = mesh_path / "constant" / "polyMesh" / "points"
            if points_file.exists():
                pts = Ofpp.parse_points(str(points_file))
                # Estimation simple : moyenne des distances entre points voisins
                # (simplifié, en production utiliser mesh quality metrics)
                from scipy.spatial import KDTree
                tree = KDTree(pts)
                distances, _ = tree.query(pts, k=2)
                dx = np.mean(distances[:, 1])
                return dx
        except Exception as e:
            self.logger.warning(f"Could not estimate dx from mesh, using default 0.005: {e}")
        return 0.005  # fallback

    def run_hybrid_simulation(self, initial_state: Dict[str, np.ndarray], n_steps: int,
                              time_step: float = 0.01, dx: Optional[float] = None) -> HybridSimulationResult:
        current_state = initial_state.copy()
        total_cfd_time = 0.0
        total_ml_time = 0.0
        all_residuals = []
        predictions_history = []
        logs = []

        # Charger ou estimer dx
        if dx is None:
            dx = self.estimate_dx(self.case_path)
        # Vérifier CFL sur l'état initial (PATCH 2)
        if "U" in current_state:
            self.check_cfl(current_state["U"], dx, time_step)

        try:
            for iteration in range(n_steps):
                residuals = self.compute_residuals(current_state, current_state)
                all_residuals.append(residuals)

                use_ml = self.should_use_ml(residuals)

                # Avant chaque pas CFD, re‑vérifier CFL (optionnel)
                if not use_ml and "U" in current_state:
                    self.check_cfl(current_state["U"], dx, time_step)

                next_state, comp_time = self.predict_step(current_state, time_step, use_ml=use_ml)

                if use_ml:
                    total_ml_time += comp_time
                    logs.append(f"Step {iteration}: ML prediction (t={comp_time:.4f}s)")
                else:
                    total_cfd_time += comp_time
                    logs.append(f"Step {iteration}: CFD simulation (t={comp_time:.4f}s)")

                current_state = next_state
                predictions_history.append(current_state.copy())

            # Calcul des résidus moyens
            avg_residuals = {}
            for field in self.config.fields_to_monitor:
                values = [r.get(field, 0.0) for r in all_residuals]
                avg_residuals[field] = float(np.mean(values)) if values else 0.0

            # ========== PATCH 3 : Score de crédibilité ==========
            mean_residual = np.mean(list(avg_residuals.values()))
            credibility_score = float(np.exp(-mean_residual / 0.01))   # score entre 0 et 1
            credibility_score = min(1.0, credibility_score) * 100.0    # en pourcentage

            return HybridSimulationResult(
                status="success",
                iteration=n_steps,
                cfd_time=total_cfd_time,
                ml_time=total_ml_time,
                residuals=avg_residuals,
                predictions=current_state,
                timestamp=datetime.utcnow(),
                log="\n".join(logs),
                credibility_score=credibility_score,
                error_message=None
            )
        except Exception as e:
            self.logger.error(f"Hybrid simulation failed: {str(e)}")
            return HybridSimulationResult(
                status="failed",
                iteration=0,
                cfd_time=total_cfd_time,
                ml_time=total_ml_time,
                residuals={},
                predictions={},
                timestamp=datetime.utcnow(),
                log="\n".join(logs),
                credibility_score=0.0,
                error_message=str(e)
            )


class MLAcceleratedPredictor(BaseHybridPredictor):
    def __init__(self, config: HybridSimulationConfig, ml_model=None):
        super().__init__(config)
        self.ml_model = ml_model

    def predict_step(self, current_state: Dict[str, np.ndarray], time_step: float, use_ml: bool = False):
        import time
        start_time = time.time()
        if use_ml and self.ml_model is not None:
            next_state = self._ml_predict(current_state, time_step)
        else:
            next_state = self._cfd_predict(current_state, time_step)
        comp_time = time.time() - start_time
        return next_state, comp_time

    def _ml_predict(self, current_state: Dict[str, np.ndarray], time_step: float) -> Dict[str, np.ndarray]:
        # Implémentation réelle – ici placeholder
        next_state = current_state.copy()
        for field in self.config.fields_to_monitor:
            if field in next_state:
                next_state[field] = next_state[field] * (1.0 + 0.001 * time_step)
        return next_state

    def _cfd_predict(self, current_state: Dict[str, np.ndarray], time_step: float) -> Dict[str, np.ndarray]:
        # Ici, appel à OpenFOAM via OpenFOAMUtils
        next_state = current_state.copy()
        for field in next_state:
            next_state[field] = next_state[field] * (1.0 + 0.002 * time_step)
        return next_state
