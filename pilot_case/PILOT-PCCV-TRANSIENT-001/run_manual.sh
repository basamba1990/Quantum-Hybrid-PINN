#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 validate_pilot.py
