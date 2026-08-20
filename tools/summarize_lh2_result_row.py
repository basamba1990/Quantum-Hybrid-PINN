import json
from pathlib import Path

path = Path('/home/ubuntu/Quantum-Hybrid-PINN/docs/lh2_analysis_result_row.json')
data = json.loads(path.read_text())
if isinstance(data, dict):
    print('response_type=dict')
    print(data)
    raise SystemExit(0)
print('rows', len(data))
for row in data:
    predictions = row.get('pinn_predictions')
    print('id', row.get('id'))
    print('created_at', row.get('created_at'))
    print('point_count', len(predictions) if isinstance(predictions, list) else type(predictions).__name__)
    print('has_mesh', bool(row.get('mesh')))
    print('has_geometry', bool(row.get('geometry')))
    print('residuals', row.get('residuals'))
    print('validation_checks', row.get('validation_checks'))
    print('prediction_sample', predictions[:1] if isinstance(predictions, list) else None)
    print('---')
