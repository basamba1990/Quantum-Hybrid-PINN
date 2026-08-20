import json
from pathlib import Path

path = Path('/home/ubuntu/Quantum-Hybrid-PINN/docs/lh2_project_analyses.json')
data = json.loads(path.read_text())
if isinstance(data, dict):
    print(data)
    raise SystemExit(0)
print('rows', len(data))
for row in data:
    results = row.get('results') or {}
    if isinstance(results, str):
        try:
            results = json.loads(results)
        except json.JSONDecodeError:
            results = {}
    points = results.get('points')
    predictions = results.get('predictions3d') or results.get('pinn_predictions')
    fields = results.get('fields') or (results.get('metadata') or {}).get('fields')
    print('id', row.get('id'))
    print('created_at', row.get('created_at'))
    print('name', row.get('name'))
    print('status', row.get('status'))
    print('results_keys', sorted(results.keys()))
    print('points', len(points) if isinstance(points, list) else None, 'predictions', len(predictions) if isinstance(predictions, list) else None)
    print('fields_keys', sorted(fields) if isinstance(fields, dict) else None)
    print('validation_status', results.get('validation_status'))
    print('---')
