#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import sys
import yaml

path = Path('.github/workflows/validate-industrial-cad.yml')
data = yaml.safe_load(path.read_text(encoding='utf-8'))
if not isinstance(data, dict):
    raise SystemExit('Workflow root must be a mapping')
on_key_present = 'on' in data or True in data
for key in ('permissions', 'jobs'):
    if key not in data:
        raise SystemExit(f'Missing workflow key: {key}')
if not on_key_present:
    raise SystemExit('Missing workflow key: on')
if 'validate-ap242' not in data['jobs']:
    raise SystemExit('Missing validate-ap242 job')
print('workflow_yaml_valid')
