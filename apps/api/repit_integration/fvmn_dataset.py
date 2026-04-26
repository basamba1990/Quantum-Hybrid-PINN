from typing import List, Union, Literal, Optional
from pathlib import Path
import numpy as np

from .baseline import BaseDataset
from .utils import hard_constraint_bc, add_feature


class FVMNDataset(BaseDataset):
    """
    Dataset pour les données issues de volumes finis (OpenFOAM).
    """
    def __init__(
        self,
        start_time: Union[int, float],
        end_time: Union[int, float],
        time_step: Union[int, float],
        dataset_dir: Union[str, Path],
        first_training: bool = False,
        vars_list: Optional[List[str]] = ["T", "U"],
        extended_vars_list: Optional[List[str]] = ["T", "U_x", "U_y"],
        dims: int = 2,
        round_to: int = 2,
        grid_x: int = 200,
        grid_y: int = 200,
        grid_z: int = 1,
        grid_step: float = 0.005,
        output_dims: Literal["BD", "BCD", "BCHW"] = "BD",
        do_normalize: bool = True,
        left_wall_temperature: float = 288.15,
        right_wall_temperature: float = 307.75,
        bc_type: str = "enforced",
        do_feature_selection: bool = True
    ):
        self.left_wall_temperature = left_wall_temperature
        self.right_wall_temperature = right_wall_temperature
        self.bc_type = bc_type
        self.do_feature_selection = do_feature_selection

        super().__init__(
            start_time=start_time,
            end_time=end_time,
            time_step=time_step,
            dataset_dir=dataset_dir,
            first_training=first_training,
            vars_list=vars_list,
            extended_vars_list=extended_vars_list,
            dims=dims,
            round_to=round_to,
            grid_x=grid_x,
            grid_y=grid_y,
            grid_z=grid_z,
            grid_step=grid_step,
            output_dims=output_dims,
            do_normalize=do_normalize,
        )

        self.inputs, self.labels = self._inputs_labels()

    def _prepare_input(self, time) -> np.ndarray:
        temp = super()._prepare_input(time)  # shape: (nvars, H, W)
        if not self.do_feature_selection:
            return temp

        if self.bc_type == "enforced":
            temp = hard_constraint_bc(
                temp,
                self.extended_vars_list,
                self.left_wall_temperature,
                self.right_wall_temperature
            )
        # Applique l'ajout de caractéristiques à chaque variable
        data = [add_feature(var_data) for var_data in temp]
        return np.concatenate(data, axis=0)

    def _prepare_label(self, data_t: np.ndarray, data_t_next: np.ndarray) -> np.ndarray:
        if self.do_feature_selection:
            skip_step = (2 * self.dims) + 1
            return data_t_next[::skip_step] - data_t[::skip_step]
        return data_t_next - data_t
