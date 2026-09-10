import pytest
from pydantic import ValidationError

from hydrogen_api_v2 import TrainRequestV8


def base_request():
    return dict(
        layers=[4, 64, 64, 64, 5],
        input_order=['t', 'x', 'y', 'z'],
        output_order=['pressure', 'u', 'v', 'w', 'temperature'],
        normalization={'coordinates': 'map_to[-1,1]', 'time': 'map_to[-1,1]', 'outputs': 'standardize_training_only'},
        schedule={'warmup_epochs': 10, 'reduce_lr_on_plateau': {'factor': 0.5, 'patience': 5, 'min_learning_rate': 1e-6}, 'early_stopping': {'patience': 10, 'min_delta': 1e-6}},
        acceptance={'report_residuals_as': 'N/D', 'do_not_promote_to_validated': True, 'required_artifacts': ['config.json']},
    )


def test_contract_accepts_scheduler_normalization_and_acceptance():
    request = TrainRequestV8(**base_request())
    assert request.acceptance.do_not_promote_to_validated is True
    assert request.normalization.coordinates == 'map_to[-1,1]'


def test_contract_rejects_incoherent_architecture():
    payload = base_request()
    payload['layers'] = [3, 64, 5]
    with pytest.raises(ValidationError):
        TrainRequestV8(**payload)


def test_synthetic_status_is_not_promoted():
    request = TrainRequestV8(**base_request())
    candidate = 'VALIDATION_CANDIDATE' if request.acceptance.do_not_promote_to_validated else 'VALIDATED'
    assert candidate != 'VALIDATED'
