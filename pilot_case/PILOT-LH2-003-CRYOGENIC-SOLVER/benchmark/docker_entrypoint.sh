#!/usr/bin/env bash
set -euo pipefail
OUT="${OUT_DIR:-/workspace/output}"
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp /workspace/source/frame_*.vtu /workspace/source/sidecar.json "$OUT/"
python3 /workspace/scripts/generate_sidecar.py "$OUT"
python3 /workspace/scripts/verify_sidecar.py "$OUT"
printf 'Docker benchmark terminé: %s\n' "$OUT"
